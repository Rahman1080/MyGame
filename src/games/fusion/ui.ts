import { localYmd } from "../../gen/daily";
import { dailySeed } from "../../platform/dailySeed";
import { setBackHandler } from "../../platform/router";
import { EVENTS } from "../../platform/services/telemetry";
import { formatClock, hintGate, isExpired, TIER_LABELS, tierRanges, timeLeftMs, type Tier } from "../../platform/levels";
import type { GameContext } from "../../platform/types";
import type { FusionSave } from "../../save/schema";
import {
  BIN_HEIGHT,
  BIN_WIDTH,
  COL_WIDTH,
  COLS,
  columnFromX,
  createState,
  drop,
  dropsUsed,
  isOver,
  objectiveMet,
  starsForScore,
  step,
  type FusionState,
  type MergeEvent,
} from "./logic";
import {
  FUSION_LEVELS,
  fusionLevelConfig,
  fusionStarsForDrops,
  type FusionLevelConfig,
} from "./levels";
import { fusionIsLevelSolved, fusionIsLevelUnlocked, fusionNextLevel, fusionRecordWin } from "./progress";
import { hintColumn } from "./solver";
import { ICON_LOCK } from "../../ui/icons";
import {
  attachFusion,
  drawFusion,
  tierColor,
  unitFromClient,
  type FusionFx,
  type FusionView,
} from "./render";

type Screen = "choose" | "levels" | "play" | "paused" | "over";
type Mode = "endless" | "daily" | "level";

interface LevelResult {
  score: number;
  stars: number;
  isBest: boolean;
  maxTier: number;
  merges: number;
  mode: Mode;
  win: boolean;
  drops: number;
  reason: string;
}

const TICK_MS = 20;
const MAX_TICKS_PER_FRAME = 8;
const MAX_PARTICLES = 280;

let app: HTMLElement;
let ctx: GameContext<FusionSave> | null = null;
let state: FusionState | null = null;
let view: FusionView | null = null;
let screen: Screen = "choose";
let mode: Mode = "endless";
let aimCol = Math.floor(COLS / 2);
let aiming = false;
let fx: FusionFx = { particles: [], flashes: [], shake: 0 };
let fxRng: (() => number) | null = null;
let lastMs = 0;
let acc = 0;
let rafId = 0;
let ac: AbortController | null = null;
let runDate: string | null = null;
let lastResult: LevelResult | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let scoreEl: HTMLElement | null = null;
let bestEl: HTMLElement | null = null;
let nextEl: HTMLElement | null = null;
let overlayEl: HTMLElement | null = null;
let objectiveEl: HTMLElement | null = null;
let dropsEl: HTMLElement | null = null;
let timerEl: HTMLElement | null = null;

let level = 1;
let levelConfig: FusionLevelConfig | null = null;
let hintsUsed = 0;
let hintCol: number | null = null;
let levelElapsed = 0;
let timedUp = false;
let activeTier: Tier = "easy";

function reduced(): boolean {
  return ctx?.settings.reduceMotion() ?? false;
}

function best(): number {
  return ctx?.save.best ?? 0;
}

function chip(tier: number, cls = ""): string {
  return `<span class="fusion-chip${cls}" style="--chip:${tierColor(tier)}">${tier}</span>`;
}

function starRow(stars: number): string {
  return `<div class="stars" aria-label="${stars} of 3 stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</div>`;
}

function starDots(stars: number): string {
  return [0, 1, 2].map((i) => `<i class="dot${i < stars ? " on" : ""}"></i>`).join("");
}

function chooseHtml(): string {
  const today = localYmd();
  const dailyBest = ctx?.save.dailyBest[today] ?? 0;
  const runs = ctx?.save.runs ?? 0;
  const cleared = clearedLevels();
  const legend = Array.from({ length: 10 }, (_, t) => chip(t)).join("");
  return `<div class="shell fusion-shell">
    <div class="fusion-top">
      <button class="icon-btn" data-act="exit" aria-label="Back to arcade">‹</button>
      <div class="fusion-word">FUSION</div>
      <span class="fusion-best">BEST <b>${best()}</b></span>
    </div>
    <div class="fusion-choose">
      <p class="fusion-blurb">Aim and drop orbs. Equal tiers fuse into the next one up. Keep the stack below the dashed line.</p>
      <div class="fusion-legend" aria-hidden="true">${legend}</div>
      <button class="cta-play fusion-cta" data-act="levels">LEVELS · ${cleared}/${FUSION_LEVELS}</button>
      <button class="ghost-btn fusion-cta" data-act="endless">ENDLESS</button>
      <button class="ghost-btn fusion-cta" data-act="daily">DAILY · ${dailyBest > 0 ? `BEST ${dailyBest}` : "TODAY"}</button>
      <p class="fusion-note">${runs} run${runs === 1 ? "" : "s"} played</p>
    </div>
  </div>`;
}

function clearedLevels(): number {
  const levels = ctx?.save.levels ?? {};
  let n = 0;
  for (let i = 1; i <= FUSION_LEVELS; i += 1) if (levels[String(i)]?.won) n += 1;
  return n;
}

function levelsHtml(): string {
  const ranges = tierRanges(FUSION_LEVELS);
  const range = ranges.find((r) => r.tier === activeTier) ?? ranges[0]!;
  const tiles: string[] = [];
  for (let l = range.from; l <= range.to; l += 1) {
    const solved = ctx ? fusionIsLevelSolved(ctx.save, l) : false;
    const unlocked = ctx ? fusionIsLevelUnlocked(ctx.save, l) : l <= 1;
    const record = ctx?.save.levels[String(l)];
    const stars = record?.stars ?? 0;
    const cls = ["lv-tile", solved ? "solved" : "", l === level ? "current" : "", unlocked ? "" : "locked"];
    const body = unlocked
      ? `<span class="lv-n">${l}</span><span class="lv-dots">${starDots(stars)}</span>`
      : `<span class="lv-lock" aria-hidden="true">${ICON_LOCK}</span>`;
    tiles.push(
      `<button class="${cls.join(" ")}" data-act="level" data-level="${l}" ${unlocked ? "" : "disabled"} aria-label="Level ${l}${solved ? `, ${stars} stars` : ""}">${body}</button>`,
    );
  }
  return `<div class="shell fusion-shell">
    <div class="fusion-top">
      <button class="icon-btn" data-act="choose" aria-label="Back to modes">‹</button>
      <div class="fusion-word">LEVELS</div>
      <span class="fusion-best">${clearedLevels()}/${FUSION_LEVELS}</span>
    </div>
    <div class="fusion-levels">
      <div class="mode-switch" role="tablist" aria-label="Level tiers">
        ${ranges.map((r) => `<button class="mode-opt${r.tier === range.tier ? " active" : ""}" data-act="tier" data-tier="${r.tier}" role="tab">${TIER_LABELS[r.tier]}</button>`).join("")}
      </div>
      <div class="fusion-tier">
        <div class="glyph-tier-name">${TIER_LABELS[range.tier]} · ${range.from}–${range.to}</div>
        <div class="level-grid">${tiles.join("")}</div>
      </div>
    </div>
  </div>`;
}

function playHtml(): string {
  if (!state) return "";
  const isLevel = mode === "level" && levelConfig;
  const levelBar = isLevel
    ? `<div class="fusion-level-bar">
        <span class="gt-tier-chip">${TIER_LABELS[levelConfig!.tier]}</span>
        <span id="fusion-objective">REACH TIER ${levelConfig!.target}</span>
        <span id="fusion-drops">DROPS 0 / ${levelConfig!.budget}</span>
        ${levelConfig!.timed ? `<span id="fusion-timer" class="fusion-timer" role="timer"></span>` : ""}
        <button class="fusion-hint" data-act="hint" aria-label="Hint">HINT</button>
      </div>`
    : "";
  return `<div class="shell fusion-shell">
    <div class="fusion-top">
      <button class="icon-btn" data-act="pause" aria-label="Pause">II</button>
      <div class="fusion-hud">
        <div class="fusion-score" id="fusion-score">0</div>
        <div class="fusion-sub" id="fusion-best"></div>
      </div>
      <div class="fusion-next" id="fusion-next" aria-label="Upcoming orbs"></div>
    </div>
    ${levelBar}
    <div class="fusion-stage">
      <canvas id="fusion-canvas" role="img" aria-label="Fusion bin. Drag to aim, release to drop."></canvas>
      <div class="fusion-overlay" id="fusion-overlay"></div>
    </div>
  </div>`;
}

function pauseCard(): string {
  return `<div class="overlay">
    <div class="win-card">
      <h2>PAUSED</h2>
      <div class="win-actions">
        <button class="cta-play" data-act="resume">Resume</button>
        <button class="ghost-btn" data-act="restart">Restart</button>
        ${mode === "level" ? `<button class="ghost-btn" data-act="levels">Level map</button>` : `<button class="ghost-btn" data-act="choose">Change mode</button>`}
        <button class="ghost-btn" data-act="exit">Arcade</button>
      </div>
    </div>
  </div>`;
}

function overCard(): string {
  const r = lastResult;
  if (!r) return "";
  if (r.mode === "level") {
    const cfg = levelConfig;
    const title = r.win
      ? "LEVEL COMPLETE"
      : r.reason === "timeout"
        ? "TIME UP"
        : r.reason === "drops"
          ? "OUT OF DROPS"
          : "OVERFLOW";
    const meta = `REACH TIER ${cfg?.target ?? "?"} · DROPS ${r.drops} / ${cfg?.budget ?? "?"}`;
    const actions = r.win
      ? `<button class="cta-play" data-act="next-level">Next level</button>
         <button class="ghost-btn" data-act="levels">Level map</button>
         <button class="ghost-btn" data-act="restart">Replay</button>`
      : `<button class="cta-play" data-act="restart">Try again</button>
         <button class="ghost-btn" data-act="levels">Level map</button>`;
    return `<div class="overlay">
      <div class="win-card">
        <h2>${title}</h2>
        ${r.win ? starRow(r.stars) : ""}
        <div class="win-meta">${meta}</div>
        <div class="win-actions">${actions}</div>
      </div>
    </div>`;
  }
  return `<div class="overlay">
    <div class="win-card">
      <h2>${r.isBest ? "NEW BEST" : "RUN OVER"}</h2>
      ${starRow(r.stars)}
      <div class="win-meta">SCORE ${r.score} · TOP TIER ${r.maxTier} · MERGES ${r.merges}</div>
      <div class="win-actions">
        <button class="cta-play" data-act="restart">Play again</button>
        <button class="ghost-btn" data-act="choose">Change mode</button>
        <button class="ghost-btn" data-act="exit">Arcade</button>
      </div>
    </div>
  </div>`;
}

function overlayHtml(): string {
  if (screen === "paused") return pauseCard();
  if (screen === "over") return overCard();
  return "";
}

function renderOverlay(): void {
  if (overlayEl) overlayEl.innerHTML = overlayHtml();
}

function renderHud(): void {
  if (scoreEl) scoreEl.textContent = String(state?.score ?? 0);
  if (bestEl) {
    if (mode === "level" && levelConfig) {
      const record = ctx?.save.levels[String(level)];
      bestEl.textContent = record?.best ? `LEVEL ${level} · BEST ${record.best} DROPS` : `LEVEL ${level} · FIRST CLEAR`;
    } else {
      bestEl.textContent = `${mode === "daily" ? "DAILY" : "ENDLESS"} · BEST ${best()}`;
    }
  }
  if (nextEl && state) nextEl.innerHTML = `${chip(state.nextTier)}${chip(state.previewTier, " small")}`;
  if (objectiveEl && levelConfig && state) {
    objectiveEl.textContent = objectiveMet(state, levelConfig.target) ? "TIER REACHED" : `REACH TIER ${levelConfig.target}`;
  }
  if (dropsEl && levelConfig && state) dropsEl.textContent = `DROPS ${dropsUsed(state)} / ${levelConfig.budget}`;
  updateTimer();
}

function updateTimer(): void {
  if (!timerEl || !levelConfig || !levelConfig.timed) return;
  const left = timedUp ? 0 : timeLeftMs(levelConfig.timeLimitMs, levelElapsed);
  timerEl.textContent = formatClock(left);
  timerEl.classList.toggle("low", left <= levelConfig.timeLimitMs * 0.25);
}

function doDrop(col: number): void {
  if (!state || !ctx || screen !== "play" || state.status !== "playing") return;
  if (mode === "level" && levelConfig && dropsUsed(state) >= levelConfig.budget) return;
  if (drop(state, col)) {
    hintCol = null;
    ctx.audio.move();
    ctx.haptics.tap();
  } else {
    ctx.audio.invalid();
  }
  renderHud();
  draw();
}

async function requestHint(): Promise<void> {
  if (!ctx || !state || !levelConfig || screen !== "play" || state.falling || state.status !== "playing") return;
  if (ctx.ads.enabled) {
    const granted = await ctx.ads.rewarded().show();
    if (!hintGate(ctx.ads.enabled, granted)) return;
  }
  const col = hintColumn(state, levelConfig.target, levelConfig.budget - dropsUsed(state), 24);
  hintsUsed += 1;
  hintCol = col;
  ctx.analytics.track(EVENTS.hintUsed, { game: "fusion", level, col: col ?? -1 });
  if (col === null) ctx.audio.invalid();
  else ctx.audio.select();
  renderHud();
  draw();
}

function aimAt(clientX: number): void {
  if (!view) return;
  aimCol = columnFromX(unitFromClient(view, clientX, 0).x);
}

function onPointerDown(e: PointerEvent): void {
  if (screen !== "play" || !state || state.status !== "playing") return;
  e.preventDefault();
  aiming = true;
  aimAt(e.clientX);
  (e.currentTarget as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
  draw();
}

function onPointerMove(e: PointerEvent): void {
  if (!aiming) return;
  e.preventDefault();
  aimAt(e.clientX);
  draw();
}

function onPointerUp(e: PointerEvent): void {
  if (!aiming) return;
  e.preventDefault();
  aiming = false;
  doDrop(aimCol);
}

function onPointerCancel(): void {
  aiming = false;
}

function canvasWidth(): number {
  const maxW = Math.min(432, Math.max(200, app.clientWidth - 24));
  const stage = app.querySelector<HTMLElement>(".fusion-stage");
  const availH = stage?.clientHeight ?? 0;
  if (availH > 80) {
    const byHeight = Math.floor((availH * BIN_WIDTH) / BIN_HEIGHT);
    return Math.max(200, Math.min(maxW, byHeight));
  }
  return maxW;
}

function bindCanvas(canvas: HTMLCanvasElement): void {
  view = attachFusion(canvas, canvasWidth());
  const opts = ac ? { signal: ac.signal } : undefined;
  canvas.addEventListener("pointerdown", onPointerDown, opts);
  canvas.addEventListener("pointermove", onPointerMove, opts);
  canvas.addEventListener("pointerup", onPointerUp, opts);
  canvas.addEventListener("pointercancel", onPointerCancel, opts);
}

function build(): void {
  app.innerHTML = screen === "choose" ? chooseHtml() : screen === "levels" ? levelsHtml() : playHtml();
  canvasEl = null;
  scoreEl = null;
  bestEl = null;
  nextEl = null;
  overlayEl = null;
  objectiveEl = null;
  dropsEl = null;
  timerEl = null;
  if (screen !== "play" && screen !== "paused" && screen !== "over") {
    view = null;
    return;
  }
  canvasEl = app.querySelector<HTMLCanvasElement>("#fusion-canvas");
  scoreEl = app.querySelector<HTMLElement>("#fusion-score");
  bestEl = app.querySelector<HTMLElement>("#fusion-best");
  nextEl = app.querySelector<HTMLElement>("#fusion-next");
  overlayEl = app.querySelector<HTMLElement>("#fusion-overlay");
  objectiveEl = app.querySelector<HTMLElement>("#fusion-objective");
  dropsEl = app.querySelector<HTMLElement>("#fusion-drops");
  timerEl = app.querySelector<HTMLElement>("#fusion-timer");
  if (canvasEl) bindCanvas(canvasEl);
  renderOverlay();
  renderHud();
}

function newRun(selected: Mode): void {
  mode = selected;
  lastResult = null;
  fx = { particles: [], flashes: [], shake: 0 };
  acc = 0;
  if (selected === "daily") {
    runDate = localYmd();
    state = createState(dailySeed(runDate, "fusion"));
    ctx?.analytics.track(EVENTS.dailyStarted, { game: "fusion", date: runDate });
  } else {
    runDate = null;
    const runs = ctx?.save.runs ?? 0;
    state = createState(`endless:${runs}:${Date.now()}`);
  }
  aimCol = Math.floor(COLS / 2);
  ctx?.analytics.track(EVENTS.gameStarted, { game: "fusion", mode: selected });
}

function enterPlay(selected: Mode): void {
  newRun(selected);
  screen = "play";
  build();
  lastMs = performance.now();
}

function endRun(): void {
  if (!state || !ctx) return;
  screen = "over";
  aiming = false;
  const score = state.score;
  const stars = starsForScore(score);
  const isBest = score > ctx.save.best;
  const next: FusionSave = {
    best: Math.max(ctx.save.best, score),
    runs: ctx.save.runs + 1,
    dailyBest: { ...ctx.save.dailyBest },
    levels: { ...(ctx.save.levels ?? {}) },
  };
  if (mode === "daily" && runDate) {
    next.dailyBest[runDate] = Math.max(next.dailyBest[runDate] ?? 0, score);
  }
  lastResult = { score, stars, isBest, maxTier: state.maxTier, merges: state.merges, mode, win: true, drops: 0, reason: "over" };
  ctx.updateSave(next);
  ctx.report({ score, stars, solved: true, stats: { merges: state.merges, maxTier: state.maxTier } });
  if (mode === "daily") {
    ctx.analytics.track(EVENTS.dailyCompleted, { game: "fusion", score, stars });
  }
  if (isBest) {
    ctx.audio.perfect();
    ctx.haptics.success();
  } else {
    ctx.audio.invalid();
    ctx.haptics.fail();
  }
  renderOverlay();
  draw();
}

function beginLevel(selected: number): void {
  level = Math.min(FUSION_LEVELS, Math.max(1, selected));
  if (ctx && !fusionIsLevelUnlocked(ctx.save, level)) return;
  levelConfig = fusionLevelConfig(level);
  mode = "level";
  lastResult = null;
  hintsUsed = 0;
  hintCol = null;
  timedUp = false;
  levelElapsed = 0;
  fx = { particles: [], flashes: [], shake: 0 };
  acc = 0;
  state = createState(levelConfig.seed, levelConfig.queue);
  aimCol = Math.floor(COLS / 2);
  screen = "play";
  ctx?.analytics.track(EVENTS.gameStarted, { game: "fusion", mode: "level", level });
  build();
  lastMs = performance.now();
}

function winLevel(): void {
  if (!ctx || !state || !levelConfig || screen === "over") return;
  screen = "over";
  aiming = false;
  const drops = dropsUsed(state);
  const stars = fusionStarsForDrops(drops, levelConfig.par);
  const timeMs = levelConfig.timed ? Math.round(levelElapsed) : 0;
  const firstWin = !fusionIsLevelSolved(ctx.save, level);
  const recorded = fusionRecordWin(ctx.save, level, { drops, stars, timeMs, hints: hintsUsed });
  ctx.updateSave({ ...recorded, runs: ctx.save.runs ?? 0, best: Math.max(ctx.save.best, state.score) });
  lastResult = {
    score: state.score,
    stars,
    isBest: state.score > ctx.save.best,
    maxTier: state.maxTier,
    merges: state.merges,
    mode: "level",
    win: true,
    drops,
    reason: "win",
  };
  if (firstWin) {
    ctx.report({ score: state.score, stars, solved: true, stats: { level, drops, hints: hintsUsed } });
  }
  ctx.audio.perfect();
  ctx.haptics.success();
  renderOverlay();
  draw();
}

function failLevel(reason: "overflow" | "drops" | "timeout"): void {
  if (!ctx || !state || !levelConfig || screen === "over") return;
  screen = "over";
  aiming = false;
  const drops = dropsUsed(state);
  lastResult = {
    score: state.score,
    stars: 0,
    isBest: false,
    maxTier: state.maxTier,
    merges: state.merges,
    mode: "level",
    win: false,
    drops,
    reason,
  };
  ctx.audio.invalid();
  ctx.haptics.fail();
  ctx.analytics.track(EVENTS.gameFailed, { game: "fusion", mode: "level", level, reason });
  renderOverlay();
  draw();
}

function togglePause(): void {
  if (screen === "play") {
    screen = "paused";
    renderOverlay();
    draw();
  } else if (screen === "paused") {
    resume();
  }
}

function resume(): void {
  if (screen !== "paused") return;
  screen = "play";
  lastMs = performance.now();
  acc = 0;
  renderOverlay();
}

function restart(): void {
  if (mode === "level") {
    beginLevel(level);
    return;
  }
  if (!state) return;
  enterPlay(mode);
}

function syncActiveTier(): void {
  if (!ctx) return;
  const levels = ctx.save.levels ?? {};
  let target = FUSION_LEVELS;
  for (let i = 1; i <= FUSION_LEVELS; i += 1) {
    if (!levels[String(i)]?.won) {
      target = i;
      break;
    }
  }
  activeTier = fusionLevelConfig(target).tier;
}

function backToLevels(): void {
  state = null;
  view = null;
  screen = "levels";
  lastResult = null;
  syncActiveTier();
  build();
}

function backToChoose(): void {
  state = null;
  view = null;
  screen = "choose";
  lastResult = null;
  build();
}

function onMerge(m: MergeEvent): void {
  if (!ctx) return;
  if (!reduced()) {
    const rng = fxRng ?? Math.random;
    const x = (m.col + 0.5) * COL_WIDTH;
    const count = Math.min(34, 10 + m.combo * 4);
    for (let i = 0; i < count; i += 1) {
      const a = rng() * Math.PI * 2;
      const sp = 40 + rng() * 90;
      fx.particles.push({
        x,
        y: m.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        life: 480,
        max: 480,
        tier: m.tier,
      });
    }
    if (fx.particles.length > MAX_PARTICLES) {
      fx.particles.splice(0, fx.particles.length - MAX_PARTICLES);
    }
    fx.flashes.push({ x, y: m.y, life: 300, max: 300, tier: m.tier });
    fx.shake = Math.min(1, fx.shake + (m.combo >= 2 || m.tier >= 5 ? 0.45 : 0.14));
  }
  ctx.audio.combo(m.combo);
  ctx.haptics.select();
  renderHud();
}

function updateFx(dt: number): void {
  const s = dt / 1000;
  if (fx.particles.length) {
    for (const p of fx.particles) {
      p.life -= dt;
      p.vy += 520 * s;
      p.vx *= 0.99;
      p.x += p.vx * s;
      p.y += p.vy * s;
    }
    fx.particles = fx.particles.filter((p) => p.life > 0);
  }
  if (fx.flashes.length) {
    for (const flash of fx.flashes) flash.life -= dt;
    fx.flashes = fx.flashes.filter((flash) => flash.life > 0);
  }
  if (fx.shake > 0) fx.shake = Math.max(0, fx.shake - dt / 240);
}

function draw(): void {
  if (!view || !state) return;
  drawFusion(view, state, {
    now: performance.now(),
    reduced: reduced(),
    aimCol: screen === "play" && !state.falling ? aimCol : null,
    fx,
    dimmed: screen !== "play",
    hintCol: screen === "play" ? hintCol : null,
  });
}

function loop(now: number): void {
  rafId = requestAnimationFrame(loop);
  const dt = Math.max(0, Math.min(120, now - lastMs));
  lastMs = now;
  updateFx(dt);
  if (state && screen === "play") {
    if (mode === "level" && levelConfig) {
      levelElapsed += dt;
      if (levelConfig.timed && !timedUp && isExpired(levelConfig.timeLimitMs, levelElapsed)) {
        timedUp = true;
        failLevel("timeout");
      }
      updateTimer();
    }
    acc += dt;
    let ticks = 0;
    while (acc >= TICK_MS && ticks < MAX_TICKS_PER_FRAME) {
      acc -= TICK_MS;
      ticks += 1;
    }
    if (acc > TICK_MS * MAX_TICKS_PER_FRAME) acc = TICK_MS * MAX_TICKS_PER_FRAME;
    if (ticks > 0 && state.status === "playing" && screen === "play") {
      const before = state.merges;
      step(state, ticks);
      if (state.merges > before) {
        if (state.mergeEvents && state.mergeEvents.length > 0) {
          for (const me of state.mergeEvents) onMerge(me);
          state.mergeEvents = [];
        } else if (state.lastMerge) {
          onMerge(state.lastMerge);
        }
      }
      if (mode === "level" && levelConfig) {
        if (objectiveMet(state, levelConfig.target)) winLevel();
        else if (isOver(state)) failLevel("overflow");
        else if (!state.falling && dropsUsed(state) >= levelConfig.budget) failLevel("drops");
      } else if (isOver(state)) {
        endRun();
      }
    }
  } else {
    acc = 0;
  }
  draw();
}

function onClick(e: MouseEvent): void {
  const target = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
  if (!target || !ctx) return;
  const act = target.dataset.act;
  if (act === "exit") {
    ctx.audio.tap();
    ctx.exit();
  } else if (act === "endless") {
    ctx.audio.tap();
    ctx.haptics.tap();
    enterPlay("endless");
  } else if (act === "daily") {
    ctx.audio.tap();
    ctx.haptics.tap();
    enterPlay("daily");
  } else if (act === "pause") {
    ctx.audio.tap();
    togglePause();
  } else if (act === "resume") {
    ctx.audio.tap();
    resume();
  } else if (act === "restart") {
    ctx.audio.tap();
    ctx.haptics.tap();
    restart();
  } else if (act === "levels") {
    ctx.audio.tap();
    ctx.haptics.tap();
    backToLevels();
  } else if (act === "level") {
    ctx.audio.tap();
    ctx.haptics.tap();
    beginLevel(Number(target.dataset.level));
  } else if (act === "tier") {
    ctx.audio.tap();
    activeTier = (target.dataset.tier as Tier | undefined) ?? activeTier;
    build();
  } else if (act === "hint") {
    ctx.audio.tap();
    void requestHint();
  } else if (act === "next-level") {
    ctx.audio.tap();
    ctx.haptics.tap();
    const next = ctx ? fusionNextLevel(ctx.save, level) : level;
    if (next !== level) beginLevel(next);
    else backToLevels();
  } else if (act === "choose") {
    ctx.audio.tap();
    backToChoose();
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (!ctx || !state) return;
  if (e.key === "Escape") {
    e.preventDefault();
    if (screen === "play") togglePause();
    else if (screen === "paused") resume();
    else if (screen === "over") backToChoose();
    else ctx.exit();
    return;
  }
  if (screen !== "play") return;
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    aimCol = Math.max(0, aimCol - 1);
    draw();
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    aimCol = Math.min(COLS - 1, aimCol + 1);
    draw();
  } else if (e.key === "ArrowDown" || e.key === " " || e.key === "Enter") {
    e.preventDefault();
    doDrop(aimCol);
  } else if (e.key.toLowerCase() === "p") {
    e.preventDefault();
    togglePause();
  }
}

function onResize(): void {
  if (screen === "choose" || !canvasEl) return;
  view = attachFusion(canvasEl, canvasWidth());
  draw();
}

function handleBack(): boolean {
  if (screen === "play") {
    togglePause();
    return true;
  }
  if (screen === "paused") {
    resume();
    return true;
  }
  if (screen === "over") {
    if (mode === "level") backToLevels();
    else backToChoose();
    return true;
  }
  if (screen === "levels") {
    backToChoose();
    return true;
  }
  return false;
}

export function mountFusion(root: HTMLElement, context: GameContext<FusionSave>): void {
  app = root;
  ctx = context;
  fxRng = context.rng("fusion:fx");
  context.audio.setMuted(context.settings.muted());
  screen = "choose";
  state = null;
  view = null;
  lastResult = null;
  level = 1;
  levelConfig = null;
  hintsUsed = 0;
  hintCol = null;
  timedUp = false;
  levelElapsed = 0;
  fx = { particles: [], flashes: [], shake: 0 };
  aimCol = Math.floor(COLS / 2);
  syncActiveTier();
  ac = new AbortController();
  const { signal } = ac;
  app.addEventListener("click", onClick, { signal });
  window.addEventListener("keydown", onKeydown, { signal });
  window.addEventListener("resize", onResize, { signal });
  setBackHandler(handleBack);
  build();
  lastMs = performance.now();
  rafId = requestAnimationFrame(loop);
}

export function startDailyFusion(root: HTMLElement, context: GameContext<FusionSave>): void {
  mountFusion(root, context);
  enterPlay("daily");
}

export function unmountFusion(): void {
  cancelAnimationFrame(rafId);
  ac?.abort();
  ac = null;
  setBackHandler(null);
  view = null;
  state = null;
  canvasEl = null;
  overlayEl = null;
  app.innerHTML = "";
}
