import { localYmd } from "../../gen/daily";
import { formatClock, hintGate, isExpired, TIER_LABELS, tierRanges, timeLeftMs } from "../../platform/levels";
import { setBackHandler } from "../../platform/router";
import { EVENTS } from "../../platform/services/telemetry";
import type { GameContext } from "../../platform/types";
import type { PrismSave } from "../../save/schema";
import { ICON_HINT, ICON_LOCK, ICON_UNDO } from "../../ui/icons";
import {
  PRISM_DAILY_ID,
  PRISM_LEVELS,
  levelTimeLimitMs,
  levelTier,
  puzzleById,
  starsForMoves,
  type PrismPuzzle,
} from "./generate";
import {
  canPour,
  cloneTubes,
  createState,
  isSolved,
  pour,
  reset,
  undo,
  type PrismMove,
  type PrismState,
  type Tube,
} from "./logic";
import {
  attachPrism,
  drawPrism,
  emptyFx,
  prismLayout,
  tubeFromPoint,
  unitFromClient,
  type PrismFx,
  type PrismLayout,
  type PrismView,
} from "./render";
import { hint } from "./solver";
import {
  prismBumpAttempt,
  prismIsLevelSolved,
  prismIsLevelUnlocked,
  prismLevelId,
  prismRecordWin,
} from "./progress";

type Screen = "choose" | "play" | "over";

const MAX_PARTICLES = 240;

let app: HTMLElement;
let ctx: GameContext<PrismSave> | null = null;
let puzzle: PrismPuzzle | null = null;
let state: PrismState | null = null;
let initialTubes: Tube[] = [];
let view: PrismView | null = null;
let layout: PrismLayout | null = null;
let selected: number | null = null;
let invalid: number | null = null;
let invalidAt = 0;
let hintMove: PrismMove | null = null;
let unsolvable = false;
let won: { moves: number; par: number; stars: number; best: number; id: string; timeMs: number; hints: number; first: boolean } | null = null;
let timedOut = false;
let hintsUsed = 0;
let timeLimit = 0;
let startedAt = 0;
let elapsedMs = 0;
let timerEl: HTMLElement | null = null;
let screen: Screen = "choose";
let moving = false;
let fx: PrismFx = emptyFx();
let rafId = 0;
let ac: AbortController | null = null;
let lastMs = 0;
let canvasEl: HTMLCanvasElement | null = null;
let overlayEl: HTMLElement | null = null;
let fxRng: (() => number) | null = null;

function reduced(): boolean {
  return ctx?.settings.reduceMotion() ?? false;
}

function today(): string {
  return localYmd();
}

function solvedIds(): string[] {
  return ctx?.save.solved ?? [];
}

function bestFor(id: string): number | null {
  const best = ctx?.save.bestMoves[id];
  return typeof best === "number" ? best : null;
}

function isDailyId(id: string): boolean {
  return id.startsWith(PRISM_DAILY_ID);
}

function levelId(level: number): string {
  return prismLevelId(level);
}

function isLevelSolved(level: number): boolean {
  return ctx ? prismIsLevelSolved(ctx.save, level) : false;
}

function isLevelUnlocked(level: number): boolean {
  return ctx ? prismIsLevelUnlocked(ctx.save, level) : level <= 1;
}

function bumpAttempt(level: number): void {
  if (ctx) ctx.updateSave(prismBumpAttempt(ctx.save, level));
}

function currentElapsed(): number {
  if (timeLimit > 0 && startedAt > 0) return Math.min(performance.now() - startedAt, timeLimit);
  return elapsedMs;
}

function startTimer(limit: number): void {
  timeLimit = limit;
  elapsedMs = 0;
  startedAt = limit > 0 ? performance.now() : 0;
}

function stopTimer(): void {
  startedAt = 0;
}

function starDots(stars: number): string {
  const cells = [0, 1, 2].map((i) => `<i class="${i < stars ? "on" : ""}"></i>`).join("");
  return `<span class="prism-tile-stars" aria-hidden="true">${cells}</span>`;
}

function levelTileHtml(level: number): string {
  const done = isLevelSolved(level);
  const unlocked = isLevelUnlocked(level);
  const best = bestFor(levelId(level));
  const tier = TIER_LABELS[levelTier(level)];
  const stars = ctx?.save.levels[String(level)]?.stars ?? 0;
  const label = done
    ? `Level ${level}, ${tier}, solved${best !== null ? `, best ${best} moves` : ""}`
    : unlocked
      ? `Level ${level}, ${tier}, unlocked`
      : `Level ${level}, ${tier}, locked`;
  const cls = `prism-tile${done ? " done" : ""}${unlocked ? "" : " locked"}`;
  const inner = unlocked
    ? `<span class="prism-tile-n">${level}</span><span class="prism-tile-b">${done ? "✓" : ""}</span>${done ? starDots(stars) : ""}`
    : `<span class="prism-tile-lock">${ICON_LOCK}</span>`;
  return `<button class="${cls}" data-act="level" data-level="${level}"${unlocked ? "" : " disabled"} aria-label="${label}">${inner}</button>`;
}

function chooseHtml(): string {
  const date = today();
  const dailyDone = solvedIds().includes(`${PRISM_DAILY_ID}-${date}`);
  const dailyBest = bestFor(`${PRISM_DAILY_ID}-${date}`);
  const total = solvedIds().filter((id) => !id.startsWith(PRISM_DAILY_ID)).length;
  const sections = tierRanges(PRISM_LEVELS)
    .map((range) => {
      const tiles: string[] = [];
      for (let level = range.from; level <= range.to; level += 1) tiles.push(levelTileHtml(level));
      return `<section class="prism-tier" aria-label="${TIER_LABELS[range.tier]} tier">
        <div class="prism-tier-name">${TIER_LABELS[range.tier]}</div>
        <div class="prism-grid">${tiles.join("")}</div>
      </section>`;
    })
    .join("");
  return `<div class="shell prism-shell">
    <div class="prism-top">
      <button class="icon-btn" data-act="exit" aria-label="Back to arcade">‹</button>
      <div class="prism-word">PRISM</div>
      <span class="prism-best">${total}/${PRISM_LEVELS}</span>
    </div>
    <div class="prism-choose">
      <button class="daily-card prism-daily" data-act="daily">
        <div>
          <div class="k">Daily Prism</div>
          <div class="sub">${dailyDone ? "Complete today" : "6 colors · Today"}</div>
        </div>
        <div class="streak-pill">${dailyBest !== null ? `BEST ${dailyBest}` : "NEW"}</div>
      </button>
      ${sections}
    </div>
  </div>`;
}

function playHtml(): string {
  if (!puzzle) return "";
  return `<div class="shell prism-shell">
    <div class="prism-top">
      <button class="icon-btn" data-act="back" aria-label="Back to puzzle list">‹</button>
      <div class="prism-hud">
        <div class="prism-title" id="prism-title"></div>
        <div class="prism-sub" id="prism-sub"></div>
        <div class="prism-timer" id="prism-timer" role="timer"></div>
      </div>
      <div class="prism-tools">
        <button class="icon-btn sm" data-act="hint" aria-label="Hint">${ICON_HINT}</button>
        <button class="icon-btn sm" data-act="undo" aria-label="Undo">${ICON_UNDO}</button>
        <button class="icon-btn sm" data-act="restart" aria-label="Restart">⟲</button>
      </div>
    </div>
    <div class="prism-stage">
      <canvas id="prism-canvas" role="img" aria-label="Colour sorting puzzle. Tap a tube to pick it up, then tap another to pour."></canvas>
      <div class="prism-overlay" id="prism-overlay"></div>
      <div class="prism-toast" id="prism-toast" role="status" aria-live="polite"></div>
    </div>
  </div>`;
}

function titleFor(): string {
  if (!puzzle) return "";
  if (isDailyId(puzzle.id)) return `DAILY`;
  const match = /^prism-(\d+)$/.exec(puzzle.id);
  if (!match) return puzzle.id.toUpperCase();
  const level = Number(match[1]);
  return `LEVEL ${level} · ${TIER_LABELS[levelTier(level)]}`;
}

function winCard(): string {
  if (!won) return "";
  const badge = isDailyId(won.id)
    ? `<div class="prism-practice">RANKED DAILY</div>`
    : won.first
      ? `<div class="prism-practice reward">FIRST CLEAR +XP</div>`
      : `<div class="prism-practice">PRACTICE - NO REWARDS</div>`;
  const time = won.timeMs > 0 ? ` · ${formatClock(won.timeMs)}` : "";
  return `<div class="overlay">
    <div class="win-card">
      <h2>COMPLETE</h2>
      ${badge}
      <div class="stars" aria-label="${won.stars} of 3 stars">${"★".repeat(won.stars)}${"☆".repeat(3 - won.stars)}</div>
      <div class="win-meta">${won.moves} MOVES · PAR ${won.par} · BEST ${won.best} · ${won.hints} HINTS${time}</div>
      <div class="win-actions">
        <button class="cta-play" data-act="next">Next</button>
        <button class="ghost-btn" data-act="restart">Replay</button>
        <button class="ghost-btn" data-act="choose">Puzzles</button>
      </div>
    </div>
  </div>`;
}

function timeoutCard(): string {
  return `<div class="overlay">
    <div class="win-card">
      <h2>TIME UP</h2>
      <p class="prism-warn">The clock ran out. Reset the board to try again.</p>
      <div class="win-actions">
        <button class="cta-play" data-act="restart">Try again</button>
        <button class="ghost-btn" data-act="choose">Puzzles</button>
      </div>
    </div>
  </div>`;
}

function unsolvableCard(): string {
  return `<div class="overlay">
    <div class="win-card">
      <h2>NO SOLUTION</h2>
      <p class="prism-warn">This position cannot be solved from here. Reset the board to try again.</p>
      <div class="win-actions">
        <button class="cta-play" data-act="restart">Reset</button>
        <button class="ghost-btn" data-act="undo">Undo</button>
        <button class="ghost-btn" data-act="choose">Puzzles</button>
      </div>
    </div>
  </div>`;
}

function overlayHtml(): string {
  if (screen === "over" && timedOut) return timeoutCard();
  if (screen === "over" && unsolvable) return unsolvableCard();
  if (screen === "over") return winCard();
  return "";
}

function renderOverlay(): void {
  if (overlayEl) overlayEl.innerHTML = overlayHtml();
}

function updateTimerDom(): void {
  if (!timerEl) return;
  if (timeLimit <= 0) {
    timerEl.textContent = "";
    timerEl.classList.remove("low");
    return;
  }
  const left = timeLeftMs(timeLimit, currentElapsed());
  const text = formatClock(left);
  if (timerEl.textContent !== text) timerEl.textContent = text;
  timerEl.classList.toggle("low", left <= timeLimit * 0.25);
  if (timerEl.getAttribute("aria-label") !== `Time left ${text}`) {
    timerEl.setAttribute("aria-label", `Time left ${text}`);
  }
}

function renderHud(): void {
  const title = app.querySelector<HTMLElement>("#prism-title");
  const sub = app.querySelector<HTMLElement>("#prism-sub");
  if (title) title.textContent = titleFor();
  if (sub && state && puzzle) {
    const best = bestFor(puzzle.id);
    const parts = [`${state.moves.length} MOVES`, `PAR ${puzzle.solution.length}`];
    if (best !== null) parts.push(`BEST ${best}`);
    if (hintsUsed > 0) parts.push(`${hintsUsed} HINTS`);
    sub.textContent = parts.join(" · ");
  }
  updateTimerDom();
}

function canvasWidth(): number {
  const maxW = Math.min(432, Math.max(220, app.clientWidth - 24));
  const stage = app.querySelector<HTMLElement>(".prism-stage");
  const availH = stage?.clientHeight ?? 0;
  if (layout && availH > 140) {
    const byHeight = Math.floor((availH * layout.logicalW) / layout.logicalH);
    return Math.max(200, Math.min(maxW, byHeight));
  }
  return maxW;
}

function bindCanvas(canvas: HTMLCanvasElement): void {
  if (!state) return;
  layout = prismLayout(state.tubes.length, state.capacity);
  view = attachPrism(canvas, layout, canvasWidth());
  const opts = ac ? { signal: ac.signal } : undefined;
  canvas.addEventListener("pointerdown", onPointerDown, opts);
}

function build(): void {
  app.innerHTML = screen === "choose" ? chooseHtml() : playHtml();
  canvasEl = null;
  overlayEl = null;
  timerEl = null;
  if (screen === "choose") {
    view = null;
    layout = null;
    return;
  }
  canvasEl = app.querySelector<HTMLCanvasElement>("#prism-canvas");
  overlayEl = app.querySelector<HTMLElement>("#prism-overlay");
  timerEl = app.querySelector<HTMLElement>("#prism-timer");
  if (canvasEl) bindCanvas(canvasEl);
  renderOverlay();
  renderHud();
}

function setToast(message: string): void {
  const toast = app.querySelector<HTMLElement>("#prism-toast");
  if (toast) toast.textContent = message;
}

function openPuzzle(id: string): void {
  try {
    const p = puzzleById(id, today());
    if (!p) return;
    const match = /^prism-(\d+)$/.exec(p.id);
    const level = match ? Number(match[1]) : 0;
    if (level > 0 && !isLevelUnlocked(level)) return;
    puzzle = p;
    initialTubes = cloneTubes(p.tubes);
    state = createState(p.seed, p.tubes, p.colors, p.capacity);
    selected = null;
    invalid = null;
    hintMove = null;
    unsolvable = false;
    won = null;
    timedOut = false;
    hintsUsed = 0;
    moving = false;
    fx = emptyFx();
    startTimer(level > 0 ? levelTimeLimitMs(level) : 0);
    if (level > 0) bumpAttempt(level);
    screen = "play";
    build();
    setToast("");
  } catch (err) {
    console.error("Prism puzzle load error:", err);
    setToast("Could not load puzzle. Please select another level.");
  }
}

function backToChoose(): void {
  stopTimer();
  timeLimit = 0;
  elapsedMs = 0;
  screen = "choose";
  puzzle = null;
  state = null;
  view = null;
  layout = null;
  timerEl = null;
  selected = null;
  hintMove = null;
  unsolvable = false;
  won = null;
  timedOut = false;
  moving = false;
  build();
}

function invalidFeedback(index: number): void {
  if (!ctx) return;
  invalid = index;
  invalidAt = performance.now();
  fx.shake = Math.min(1, fx.shake + 0.4);
  ctx.audio.invalid();
  ctx.haptics.fail();
  setToast("That tube can't take that colour.");
}

function doPour(from: number, to: number): void {
  if (!state || !ctx) return;
  const move = pour(state, from, to);
  if (!move) return;
  selected = null;
  hintMove = null;
  invalid = null;
  ctx.audio.select();
  ctx.haptics.select();
  renderHud();
  if (!reduced()) {
    fx.pour = { from, to, count: move.count, color: move.color, t: 0, duration: 280 };
    moving = true;
    draw();
  } else if (isSolved(state)) {
    finishWin();
  } else {
    draw();
  }
}

function finishPour(): void {
  const anim = fx.pour;
  fx.pour = null;
  moving = false;
  if (anim && layout && !reduced()) {
    const dst = layout.rects[anim.to];
    if (dst) {
      const cx = dst.x + dst.w / 2;
      const cy = dst.y + layout.bottomPad;
      fx.flashes.push({ x: cx, y: cy, life: 280, max: 280, color: anim.color });
      const rng = fxRng ?? Math.random;
      for (let i = 0; i < 8; i += 1) {
        const a = rng() * Math.PI * 2;
        fx.particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * (30 + rng() * 50),
          vy: Math.sin(a) * (30 + rng() * 50) - 20,
          life: 420,
          max: 420,
          color: anim.color,
        });
      }
      if (fx.particles.length > MAX_PARTICLES) fx.particles.splice(0, fx.particles.length - MAX_PARTICLES);
    }
  }
  if (state && isSolved(state)) {
    finishWin();
    return;
  }
  draw();
}

function finishWin(): void {
  if (!state || !ctx || !puzzle) return;
  screen = "over";
  moving = false;
  fx.pour = null;
  stopTimer();
  const moves = state.moves.length;
  const par = puzzle.solution.length;
  const stars = starsForMoves(moves, par);
  const id = puzzle.id;
  const match = /^prism-(\d+)$/.exec(id);
  const level = match ? Number(match[1]) : 0;
  const timeMs = level > 0 ? currentElapsed() : 0;
  const prevBest = ctx.save.bestMoves[id];
  const best = prevBest === undefined ? moves : Math.min(prevBest, moves);
  const already = level > 0 ? prismIsLevelSolved(ctx.save, level) : ctx.save.solved.includes(id);
  if (level > 0) {
    ctx.updateSave(prismRecordWin(ctx.save, level, { moves, stars, timeMs, hints: hintsUsed }));
  } else {
    const solved = already ? ctx.save.solved.slice() : [...ctx.save.solved, id];
    ctx.updateSave({ ...ctx.save, solved, bestMoves: { ...ctx.save.bestMoves, [id]: best } });
  }
  const first = level > 0 && !already;
  won = { moves, par, stars, best, id, timeMs, hints: hintsUsed, first };
  fx.winT = 1;
  if (isDailyId(id) || first) {
    ctx.report({
      solved: true,
      score: Math.max(1, par + 40 - moves - hintsUsed * 5),
      stars,
      stats: { moves, par, hints: hintsUsed },
    });
  }
  if (isDailyId(id)) {
    ctx.analytics.track(EVENTS.dailyStarted, { game: "prism" });
    ctx.analytics.track(EVENTS.dailyCompleted, { game: "prism", moves });
  } else if (first) {
    ctx.analytics.track(EVENTS.gameCompleted, { game: "prism", level, moves });
  }
  ctx.audio.levelComplete();
  ctx.haptics.success();
  renderOverlay();
  renderHud();
  draw();
}

async function useHint(): Promise<void> {
  if (!state || !ctx || moving || screen !== "play" || state.status !== "playing") return;
  const result = hint(state);
  if (result.kind === "solved") return;
  if (result.kind === "unsolvable" && !result.certain) {
    setToast("No obvious solution from this position. Try undoing a move!");
    ctx.audio.invalid();
    return;
  }
  const adStart = performance.now();
  const granted = ctx.ads.enabled ? await ctx.ads.rewarded().show() : true;
  const adElapsed = performance.now() - adStart;
  startedAt += adElapsed;

  if (!hintGate(ctx.ads.enabled, granted)) {
    setToast("Finish the ad to unlock the hint.");
    return;
  }
  if (!state || screen !== "play") return;
  if (result.kind === "move") {
    hintsUsed += 1;
    hintMove = result.move;
    selected = result.move.from;
    invalid = null;
    ctx.audio.select();
    ctx.haptics.select();
    ctx.analytics.track(EVENTS.hintUsed, { game: "prism", hints: hintsUsed });
    setToast(`Hint ${hintsUsed}: pour the glowing tube.`);
    renderHud();
    draw();
  } else if (result.kind === "unsolvable") {
    if (result.certain) {
      hintMove = null;
      unsolvable = true;
      screen = "over";
      ctx.audio.invalid();
      ctx.haptics.fail();
      renderOverlay();
      draw();
    } else {
      setToast("No path found from here. Try undoing a move!");
      ctx.audio.invalid();
    }
  }
}

function doUndo(): void {
  if (!state || !ctx || moving || state.moves.length === 0) return;
  undo(state);
  selected = null;
  hintMove = null;
  unsolvable = false;
  won = null;
  screen = "play";
  ctx.audio.tap();
  ctx.haptics.tap();
  renderOverlay();
  renderHud();
  draw();
}

function doRestart(): void {
  if (!state || !ctx || !puzzle) return;
  reset(state, initialTubes);
  selected = null;
  hintMove = null;
  unsolvable = false;
  won = null;
  timedOut = false;
  hintsUsed = 0;
  screen = "play";
  moving = false;
  fx = emptyFx();
  const match = /^prism-(\d+)$/.exec(puzzle.id);
  startTimer(match ? levelTimeLimitMs(Number(match[1])) : 0);
  ctx.audio.tap();
  ctx.haptics.tap();
  renderOverlay();
  renderHud();
  setToast("");
  draw();
}

function handleTap(index: number): void {
  if (!state || screen !== "play" || moving) return;
  invalid = null;
  hintMove = null;
  if (selected === null) {
    if (state.tubes[index]!.length === 0) {
      invalidFeedback(index);
      draw();
      return;
    }
    selected = index;
    ctx?.audio.tap();
    ctx?.haptics.tap();
    draw();
    return;
  }
  if (index === selected) {
    selected = null;
    ctx?.audio.tap();
    draw();
    return;
  }
  if (canPour(state, selected, index)) {
    setToast("");
    doPour(selected, index);
    return;
  }
  if (state.tubes[index]!.length > 0) {
    selected = index;
    ctx?.audio.tap();
    ctx?.haptics.tap();
    draw();
    return;
  }
  invalidFeedback(index);
  draw();
}

function onPointerDown(e: PointerEvent): void {
  if (!state || !view || !layout || screen !== "play") return;
  e.preventDefault();
  const p = unitFromClient(view, e.clientX, e.clientY);
  const index = tubeFromPoint(layout, p.x, p.y);
  if (index >= 0) handleTap(index);
}

function draw(): void {
  if (!view || !state || !layout) return;
  const s = state;
  const legalTargets =
    screen === "play" && selected !== null
      ? s.tubes.map((_, i) => i).filter((i) => canPour(s, selected!, i))
      : [];
  if (hintMove && !legalTargets.includes(hintMove.to)) legalTargets.push(hintMove.to);
  drawPrism(view, s, {
    selected,
    legalTargets,
    hintSource: hintMove?.from ?? null,
    hintTarget: hintMove?.to ?? null,
    invalid,
    fx,
    reduced: reduced(),
    now: performance.now(),
  });
}

function updateFx(dt: number): void {
  const s = dt / 1000;
  if (fx.particles.length) {
    for (const p of fx.particles) {
      p.life -= dt;
      p.vy += 420 * s;
      p.x += p.vx * s;
      p.y += p.vy * s;
    }
    fx.particles = fx.particles.filter((p) => p.life > 0);
  }
  if (fx.flashes.length) {
    for (const f of fx.flashes) f.life -= dt;
    fx.flashes = fx.flashes.filter((f) => f.life > 0);
  }
  if (fx.shake > 0) fx.shake = Math.max(0, fx.shake - dt / 220);
  if (fx.winT > 0) fx.winT += dt;
  if (fx.winT > 1300) fx.winT = 0;
}

function failTimeout(): void {
  if (!state || !ctx) return;
  elapsedMs = timeLimit;
  stopTimer();
  timedOut = true;
  unsolvable = false;
  won = null;
  screen = "over";
  moving = false;
  fx.pour = null;
  ctx.audio.invalid();
  ctx.haptics.fail();
  ctx.analytics.track(EVENTS.gameFailed, { game: "prism", timed_out: 1 });
  renderOverlay();
  renderHud();
  draw();
}

function loop(now: number): void {
  rafId = requestAnimationFrame(loop);
  const dt = Math.max(0, Math.min(64, now - lastMs));
  lastMs = now;
  updateFx(dt);
  if (screen === "play" && state && timeLimit > 0 && state.status === "playing" && startedAt > 0) {
    elapsedMs = performance.now() - startedAt;
    updateTimerDom();
    if (isExpired(timeLimit, elapsedMs)) {
      failTimeout();
      return;
    }
  }
  if (moving && fx.pour) {
    fx.pour.t += dt;
    if (fx.pour.t >= fx.pour.duration) finishPour();
  }
  if (invalid !== null && now - invalidAt > 460) invalid = null;
  draw();
}

function onClick(e: MouseEvent): void {
  const target = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
  if (!target || !ctx) return;
  const act = target.dataset.act;
  if (act === "exit") {
    ctx.audio.tap();
    ctx.exit();
  } else if (act === "back" || act === "choose") {
    ctx.audio.tap();
    backToChoose();
  } else if (act === "daily") {
    ctx.audio.tap();
    ctx.haptics.tap();
    openPuzzle(PRISM_DAILY_ID);
  } else if (act === "level") {
    const level = Number(target.dataset.level);
    if (!isLevelUnlocked(level)) return;
    ctx.audio.tap();
    ctx.haptics.tap();
    openPuzzle(levelId(level));
  } else if (act === "hint") {
    void useHint();
  } else if (act === "undo") {
    doUndo();
  } else if (act === "restart") {
    doRestart();
  } else if (act === "next") {
    ctx.audio.tap();
    if (puzzle && !isDailyId(puzzle.id)) {
      const match = /^prism-(\d+)$/.exec(puzzle.id);
      const next = match ? Number(match[1]) + 1 : PRISM_LEVELS + 1;
      if (next <= PRISM_LEVELS) {
        openPuzzle(`prism-${next}`);
        return;
      }
    }
    backToChoose();
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (!ctx) return;

  if (e.key === "Escape") {
    if (screen === "play" && selected !== null) {
      selected = null;
      draw();
      e.preventDefault();
      return;
    }
    if (handleBack()) e.preventDefault();
    return;
  }

  if (screen !== "play" || !state || moving) return;

  if (e.key >= "1" && e.key <= "9") {
    handleTap(Number(e.key) - 1);
    e.preventDefault();
  } else if (e.key === "0") {
    if (state.tubes.length >= 10) {
      handleTap(9);
      e.preventDefault();
    }
  } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    const n = state.tubes.length;
    const step = e.key === "ArrowRight" ? 1 : -1;
    let idx = selected === null ? (step === 1 ? -1 : 0) : selected;
    for (let i = 0; i < n; i++) {
      idx = (idx + step + n) % n;
      if (state.tubes[idx]!.length > 0) {
        selected = idx;
        ctx.audio.tap();
        draw();
        break;
      }
    }
    e.preventDefault();
  }
}

function onResize(): void {
  if (screen === "choose" || !canvasEl || !state) return;
  layout = prismLayout(state.tubes.length, state.capacity);
  view = attachPrism(canvasEl, layout, canvasWidth());
  draw();
}

function handleBack(): boolean {
  if (screen === "play" || screen === "over") {
    backToChoose();
    return true;
  }
  return false;
}

export function mountPrism(root: HTMLElement, context: GameContext<PrismSave>): void {
  app = root;
  ctx = context;
  fxRng = context.rng("prism:fx");
  context.audio.setMuted(context.settings.muted());
  screen = "choose";
  puzzle = null;
  state = null;
  view = null;
  layout = null;
  selected = null;
  hintMove = null;
  unsolvable = false;
  won = null;
  timedOut = false;
  hintsUsed = 0;
  timeLimit = 0;
  startedAt = 0;
  elapsedMs = 0;
  timerEl = null;
  moving = false;
  fx = emptyFx();
  ac = new AbortController();
  const { signal } = ac;
  app.addEventListener("click", onClick, { signal });
  window.addEventListener("resize", onResize, { signal });
  window.addEventListener("keydown", onKeyDown, { signal });
  setBackHandler(handleBack);
  build();
  lastMs = performance.now();
  rafId = requestAnimationFrame(loop);
}

export function unmountPrism(): void {
  cancelAnimationFrame(rafId);
  stopTimer();
  ac?.abort();
  ac = null;
  setBackHandler(null);
  view = null;
  layout = null;
  state = null;
  canvasEl = null;
  overlayEl = null;
  timerEl = null;
  app.innerHTML = "";
}
