import { localYmd } from "../../gen/daily";
import { dailySeed } from "../../platform/dailySeed";
import { setBackHandler } from "../../platform/router";
import { EVENTS } from "../../platform/services/telemetry";
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
  isOver,
  starsForScore,
  step,
  type FusionState,
  type MergeEvent,
} from "./logic";
import {
  attachFusion,
  drawFusion,
  tierColor,
  unitFromClient,
  type FusionFx,
  type FusionView,
} from "./render";

type Screen = "choose" | "play" | "paused" | "over";
type Mode = "endless" | "daily";

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
let lastResult: { score: number; stars: number; isBest: boolean; maxTier: number; merges: number } | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let scoreEl: HTMLElement | null = null;
let bestEl: HTMLElement | null = null;
let nextEl: HTMLElement | null = null;
let overlayEl: HTMLElement | null = null;

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

function chooseHtml(): string {
  const today = localYmd();
  const dailyBest = ctx?.save.dailyBest[today] ?? 0;
  const runs = ctx?.save.runs ?? 0;
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
      <button class="cta-play fusion-cta" data-act="endless">ENDLESS</button>
      <button class="ghost-btn fusion-cta" data-act="daily">DAILY · ${dailyBest > 0 ? `BEST ${dailyBest}` : "TODAY"}</button>
      <p class="fusion-note">${runs} run${runs === 1 ? "" : "s"} played</p>
    </div>
  </div>`;
}

function playHtml(): string {
  if (!state) return "";
  return `<div class="shell fusion-shell">
    <div class="fusion-top">
      <button class="icon-btn" data-act="pause" aria-label="Pause">II</button>
      <div class="fusion-hud">
        <div class="fusion-score" id="fusion-score">0</div>
        <div class="fusion-sub" id="fusion-best"></div>
      </div>
      <div class="fusion-next" id="fusion-next" aria-label="Upcoming orbs"></div>
    </div>
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
        <button class="ghost-btn" data-act="choose">Change mode</button>
        <button class="ghost-btn" data-act="exit">Arcade</button>
      </div>
    </div>
  </div>`;
}

function overCard(): string {
  const r = lastResult;
  if (!r) return "";
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
  if (bestEl) bestEl.textContent = `${mode === "daily" ? "DAILY" : "ENDLESS"} · BEST ${best()}`;
  if (nextEl && state) nextEl.innerHTML = `${chip(state.nextTier)}${chip(state.previewTier, " small")}`;
}

function doDrop(col: number): void {
  if (!state || !ctx || screen !== "play" || state.status !== "playing") return;
  if (drop(state, col)) {
    ctx.audio.move();
    ctx.haptics.tap();
  } else {
    ctx.audio.invalid();
  }
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
  app.innerHTML = screen === "choose" ? chooseHtml() : playHtml();
  canvasEl = null;
  scoreEl = null;
  bestEl = null;
  nextEl = null;
  overlayEl = null;
  if (screen === "choose") {
    view = null;
    return;
  }
  canvasEl = app.querySelector<HTMLCanvasElement>("#fusion-canvas");
  scoreEl = app.querySelector<HTMLElement>("#fusion-score");
  bestEl = app.querySelector<HTMLElement>("#fusion-best");
  nextEl = app.querySelector<HTMLElement>("#fusion-next");
  overlayEl = app.querySelector<HTMLElement>("#fusion-overlay");
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
  };
  if (mode === "daily" && runDate) {
    next.dailyBest[runDate] = Math.max(next.dailyBest[runDate] ?? 0, score);
  }
  lastResult = { score, stars, isBest, maxTier: state.maxTier, merges: state.merges };
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
  if (!state) return;
  enterPlay(mode);
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
  });
}

function loop(now: number): void {
  rafId = requestAnimationFrame(loop);
  const dt = Math.max(0, Math.min(120, now - lastMs));
  lastMs = now;
  updateFx(dt);
  if (state && screen === "play") {
    acc += dt;
    let ticks = 0;
    while (acc >= TICK_MS && ticks < MAX_TICKS_PER_FRAME) {
      acc -= TICK_MS;
      ticks += 1;
    }
    if (acc > TICK_MS * MAX_TICKS_PER_FRAME) acc = TICK_MS * MAX_TICKS_PER_FRAME;
    if (ticks > 0 && state.status === "playing") {
      const before = state.merges;
      step(state, ticks);
      if (state.merges > before && state.lastMerge) onMerge(state.lastMerge);
      if (isOver(state)) endRun();
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
  fx = { particles: [], flashes: [], shake: 0 };
  aimCol = Math.floor(COLS / 2);
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
