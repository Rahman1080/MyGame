import type { ArrowsMode, ArrowsState } from "./logic";
import { availableIndices, dirName, isLocked, laneInfo } from "./logic";

const ICON_BACK = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" /></svg>`;
const ICON_RESTART = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 11a8 8 0 1 0-2.4 5.7" /><path d="M20 5v6h-6" /></svg>`;
const ICON_HINT = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.8.5-1.1 1-1.1 1.8v.4" /><path d="M12 17.2v.1" /></svg>`;
const ICON_UNDO = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 7H5v-4" /><path d="M5 7a7 7 0 1 1 2 5" /></svg>`;
const ARROW_TIP = `<svg class="nar-tip" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.5l7.5 13H4.5z" /></svg>`;
const LOCK_MARK = `<svg class="nar-lock" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>`;

export interface BoardView {
  focus?: number | null;
  hint?: number | null;
  press?: number | null;
}

export interface LanePreview {
  cells: number[];
  blocked: boolean;
  blocker: number;
}

export function laneCells(state: ArrowsState, index: number): LanePreview {
  const info = laneInfo(state, index);
  return { cells: info.cells, blocked: info.blocked, blocker: info.blocker };
}

/** Lock tier 0-3 drives the arrow tint: 0 free, then 1, 2 and 3+ escapes. */
export function lockTier(lock: number): number {
  return Math.max(0, Math.min(3, Math.floor(lock)));
}

function cellLabel(state: ArrowsState, index: number, cell: number): string {
  const row = Math.floor(cell / state.size) + 1;
  const col = (cell % state.size) + 1;
  const arrow = state.arrows[index];
  if (!arrow || state.alive[index] !== true) return `Empty at row ${row} column ${col}`;
  const lock = isLocked(state, index) ? ", locked" : "";
  const length = arrow.length > 1 ? `, ${arrow.length} cells long` : "";
  return `Arrow at row ${row} column ${col}, pointing ${dirName(arrow.dir)}${length}${lock}, tap to launch`;
}

export function boardHtml(state: ArrowsState, view: BoardView = {}): string {
  const moves = new Set(availableIndices(state));
  const occupied = new Map<number, { arrow: number; offset: number }>();
  for (let i = 0; i < state.arrows.length; i += 1) {
    if (state.alive[i] !== true) continue;
    const arrow = state.arrows[i]!;
    const cells: number[] = [];
    let cell = arrow.head;
    for (let n = 0; n < arrow.length && cell >= 0; n += 1) {
      cells.push(cell);
      cell = stepBack(state.size, cell, arrow.dir);
    }
    cells.forEach((body, offset) => occupied.set(body, { arrow: i, offset }));
  }

  const preview = view.press != null ? laneInfo(state, view.press) : null;
  const laneSet = new Set(preview?.cells ?? []);
  const laneBlock = preview?.blocked ? preview.blocker : -1;

  const rows: string[] = [];
  for (let row = 0; row < state.size; row += 1) {
    const cells: string[] = [];
    for (let col = 0; col < state.size; col += 1) {
      const index = row * state.size + col;
      const part = occupied.get(index);
      if (!part) {
        const classes = ["nar-cell"];
        if (laneSet.has(index)) classes.push("lane");
        cells.push(`<div class="${classes.join(" ")}" role="gridcell" data-cell="${index}"></div>`);
        continue;
      }
      const arrow = state.arrows[part.arrow]!;
      const locked = isLocked(state, part.arrow);
      const classes = ["nar-tile", `d${arrow.dir}`, `len${arrow.length}`, `tier${lockTier(arrow.lock)}`];
      classes.push(part.offset === 0 ? "head" : "tail");
      if (arrow.length > 1) classes.push("long");
      if (locked) classes.push("locked");
      classes.push(moves.has(part.arrow) ? "ready" : "held");
      if (laneSet.has(index)) classes.push("lane");
      if (index === laneBlock) classes.push("lane-block");
      if (view.focus === part.arrow && part.offset === 0) classes.push("focus");
      if (view.hint === part.arrow) classes.push("hint");
      const glyph = part.offset === 0 ? ARROW_TIP : "";
      const lockRemaining = Math.max(0, arrow.lock - state.escaped);
      const lockMark =
        locked && part.offset === 0
          ? `<span class="nar-lock-badge">${LOCK_MARK}<span class="nar-lock-num">${lockRemaining}</span></span>`
          : "";
      cells.push(
        `<button type="button" role="gridcell" tabindex="-1" class="${classes.join(" ")}" data-arrow="${
          part.arrow
        }" data-cell="${index}" aria-label="${cellLabel(state, part.arrow, index)}">${glyph}${lockMark}</button>`,
      );
    }
    rows.push(`<div role="row" class="nar-row">${cells.join("")}</div>`);
  }
  const dim = `style="--nar-size:${state.size}"`;
  return `<div class="nar-board" role="grid" tabindex="0" ${dim} aria-label="Arrow board, ${state.size} by ${state.size}">${rows.join(
    "",
  )}</div>`;
}

/** One cell backwards (opposite the arrow direction), or -1 off board. */
function stepBack(size: number, cell: number, dir: number): number {
  const dr = [-1, 0, 1, 0][dir] ?? 0;
  const dc = [0, 1, 0, -1][dir] ?? 0;
  const row = Math.floor(cell / size) - dr;
  const col = (cell % size) - dc;
  if (row < 0 || col < 0 || row >= size || col >= size) return -1;
  return row * size + col;
}

export function remainingArrows(state: ArrowsState): number {
  return state.alive.reduce((count, live) => (live ? count + 1 : count), 0);
}

export function readyCount(state: ArrowsState): number {
  return state.status === "playing" ? availableIndices(state).length : 0;
}

export function statusText(state: ArrowsState): string {
  if (state.status === "solved") return "Clean exit. Every arrow escaped.";
  const ready = availableIndices(state).length;
  if (ready === 0) return "No arrow can launch — undo a tap.";
  const word = ready === 1 ? "1 arrow is ready" : `${ready} arrows are ready`;
  return `${word}. Launch one with a clear lane.`;
}

export function hudHtml(state: ArrowsState): string {
  if (state.mode === "endless") {
    return `<div class="nar-hud" role="group" aria-label="Run stats">
    <div class="nar-stat"><span class="k">BOARD</span><span class="v" data-hud="boards">${state.boardIndex + 1}</span></div>
    <div class="nar-stat"><span class="k">LEFT</span><span class="v" data-hud="left">${remainingArrows(state)}</span></div>
    <div class="nar-stat"><span class="k">READY</span><span class="v" data-hud="ready">${readyCount(state)}</span></div>
    <div class="nar-stat"><span class="k">HINTS</span><span class="v" data-hud="hints">${state.hints}</span></div>
  </div>`;
  }
  return `<div class="nar-hud" role="group" aria-label="Run stats">
    <div class="nar-stat"><span class="k">LEFT</span><span class="v" data-hud="left">${remainingArrows(state)}</span></div>
    <div class="nar-stat"><span class="k">READY</span><span class="v" data-hud="ready">${readyCount(state)}</span></div>
    <div class="nar-stat"><span class="k">MISSTEPS</span><span class="v" data-hud="missteps">${state.missteps}</span></div>
    <div class="nar-stat"><span class="k">HINTS</span><span class="v" data-hud="hints">${state.hints}</span></div>
  </div>`;
}

export function liveStatusHtml(message: string): string {
  return `<div class="nar-status" id="arrows-status" role="status" aria-live="polite">${message}</div>`;
}

export function starsText(stars: number): string {
  const clamped = Math.max(0, Math.min(3, Math.floor(stars)));
  return `${"★".repeat(clamped)}${"☆".repeat(3 - clamped)}`;
}

export interface LevelOption {
  level: number;
  stars: number;
  unlocked: boolean;
}

export interface MenuView {
  date: string;
  levels: LevelOption[];
  totalStars: number;
  nextLevel: number;
  perfect: number;
  bestRun: number;
  boards: number;
  dailyDone: boolean;
  dailyStreak: number;
  dailyBest: number;
}

function dailyCardHtml(view: MenuView): string {
  const status = view.dailyDone
    ? view.dailyBest > 0
      ? `TODAY · ${"★".repeat(Math.max(0, Math.min(3, view.dailyBest)))}`
      : "TODAY · PLAYED"
    : `TODAY'S SEEDED BOARD${view.dailyStreak > 0 ? ` · ${view.dailyStreak} DAY STREAK` : ""}`;
  return `<button type="button" class="nar-daily-card${view.dailyDone ? " done" : ""}" data-act="daily">
    <span class="nar-daily-mark" aria-hidden="true"></span>
    <span class="nar-daily-text">
      <span class="nar-daily-label">NEON ARROWS DAILY</span>
      <span class="nar-daily-date">${view.date}</span>
      <span class="nar-daily-status">${status}</span>
    </span>
    <span class="nar-daily-arrow" aria-hidden="true">›</span>
  </button>`;
}

function recordsHtml(view: MenuView): string {
  const solved = view.levels.filter((option) => option.stars > 0).length;
  return `<div class="nar-records" role="group" aria-label="Records">
    <div class="nar-record"><span class="k">SOLVED</span><span class="v">${solved} / ${view.levels.length}</span></div>
    <div class="nar-record"><span class="k">PERFECT</span><span class="v">${view.perfect}</span></div>
    <div class="nar-record"><span class="k">STARS</span><span class="v">${view.totalStars}</span></div>
    <div class="nar-record"><span class="k">BEST RUN</span><span class="v">${view.bestRun}</span></div>
  </div>`;
}

function levelGridHtml(view: MenuView): string {
  const cells = view.levels.map((option) => {
    const locked = !option.unlocked;
    const stars = Math.max(0, Math.min(3, Math.floor(option.stars)));
    const label = locked
      ? `Level ${option.level}, locked`
      : `Level ${option.level}, ${stars} of 3 stars`;
    return `<button type="button" class="nar-level${locked ? " locked" : ""}${
      stars > 0 ? " won" : ""
    }${stars >= 3 ? " perfect" : ""}" data-level="${option.level}"${locked ? " disabled" : ""} aria-label="${label}">
      <span class="nar-level-num">${option.level}</span>
      ${stars > 0 ? `<span class="nar-level-stars" aria-hidden="true">${"★".repeat(stars)}</span>` : ""}
    </button>`;
  });
  return `<div class="nar-levels" role="group" aria-label="Levels">${cells.join("")}</div>`;
}

export function menuHtml(view: MenuView, reduced: boolean): string {
  const nextLabel = view.nextLevel > 1 ? `CONTINUE · LEVEL ${view.nextLevel}` : "START · LEVEL 1";
  return `<div class="shell nar-shell${reduced ? " reduce" : ""}">
    <div class="nar-top">
      <button class="icon-btn nar-back" data-act="arcade" aria-label="Back to arcade">${ICON_BACK}</button>
      <div class="nar-head">
        <div class="nar-word">NEON ARROWS</div>
        <span class="nar-badge">ARROW ESCAPE</span>
      </div>
      <button class="icon-btn nar-help" data-act="help" aria-label="How to play">${ICON_HINT}</button>
    </div>
    <div class="nar-menu-body">
      ${dailyCardHtml(view)}
      <button type="button" class="cta-play nar-levels-cta" data-act="level">
        <span class="nar-cta-k">${nextLabel}</span>
        <span class="nar-cta-sub">${view.totalStars} / ${view.levels.length * 3} STARS</span>
      </button>
      <button type="button" class="nar-endless" data-act="endless">
        <span class="nar-endless-k">ENDLESS</span>
        <span class="nar-endless-sub">LARGE BOARDS · SCORE ATTACK</span>
      </button>
      ${recordsHtml(view)}
      <div class="nar-menu-label" aria-hidden="true">LEVELS</div>
      ${levelGridHtml(view)}
    </div>
  </div>`;
}

export interface ResultView {
  mode: ArrowsMode;
  level: number;
  date: string;
  solved: boolean;
  score: number;
  launches: number;
  missteps: number;
  hints: number;
  stars: number;
  arrows: number;
  boards: number;
  isBest: boolean;
  ranked: boolean;
  hasNext: boolean;
}

function resultStat(k: string, v: string, accent = ""): string {
  return `<div class="nar-result-stat${accent ? ` ${accent}` : ""}"><span class="k">${k}</span><span class="v">${v}</span></div>`;
}

export function resultCardHtml(view: ResultView): string {
  const title =
    view.mode === "daily"
      ? view.solved
        ? "DAILY COMPLETE"
        : "DAILY OVER"
      : view.mode === "endless"
        ? "RUN OVER"
        : view.solved
          ? "BOARD CLEARED"
          : "BOARD OVER";
  const badge =
    view.mode === "daily"
      ? view.ranked
        ? `<div class="nar-practice reward">RANKED · FIRST RUN TODAY</div>`
        : `<div class="nar-practice">PRACTICE · DAILY ALREADY SCORED</div>`
      : view.mode === "endless"
        ? view.isBest
          ? `<div class="nar-practice reward">NEW BEST</div>`
          : `<div class="nar-practice">${view.boards} BOARDS CLEARED</div>`
        : `<div class="nar-practice reward">LEVEL ${view.level} · ${view.arrows} ARROWS</div>`;
  const replay = view.mode === "daily" ? "daily-again" : view.mode === "endless" ? "endless" : "level";
  const next =
    view.mode === "level" && view.solved && view.hasNext
      ? `<button class="cta-play" data-act="level-next">NEXT LEVEL</button>`
      : "";
  return `<div class="overlay nar-overlay">
    <div class="win-card nar-card">
      <div class="nar-card-glow" aria-hidden="true"></div>
      <h2>${title}</h2>
      ${badge}
      <div class="stars" aria-label="${view.stars} of 3 stars">${starsText(view.stars)}</div>
      <div class="nar-result-grid">
        ${resultStat("SCORE", String(view.score), "wide")}
        ${resultStat("LAUNCHES", String(view.launches))}
        ${resultStat("MISSTEPS", String(view.missteps))}
        ${resultStat("HINTS", String(view.hints))}
      </div>
      <div class="win-actions">
        ${next}
        <button class="cta-play" data-act="${replay}">PLAY AGAIN</button>
        <button class="ghost-btn" data-act="menu">LEVELS</button>
        <button class="ghost-btn" data-act="arcade">BACK TO ARCADE</button>
      </div>
    </div>
  </div>`;
}

export function helpHtml(reduced: boolean): string {
  return `<div class="shell nar-shell${reduced ? " reduce" : ""}">
    <div class="nar-top">
      <button class="icon-btn nar-back" data-act="close-help" aria-label="Close help">${ICON_BACK}</button>
      <div class="nar-head"><div class="nar-word">HOW TO PLAY</div></div>
      <span class="nar-spacer"></span>
    </div>
    <div class="nar-help">
      <p>Tap an arrow to <b>launch</b> it. It shoots straight in the direction it points and escapes off the edge.</p>
      <p>An arrow needs its <b>whole lane</b> to the edge clear. Hold an arrow to preview the lane: green means it can go, red stops at whatever blocks it.</p>
      <p><b>Long arrows</b> take up two or three cells, so they block more lanes and free more space when they leave.</p>
      <p><b>Locked arrows</b> wake only after a number of other arrows have escaped. The badge shows how many.</p>
      <p>Clear every arrow to finish the board. You can never dead end — every board has an order that works.</p>
      <ul class="nar-legend">
        <li><span class="nar-legend-cell ready" aria-hidden="true"></span> Ready — a clear lane to the edge.</li>
        <li><span class="nar-legend-cell held" aria-hidden="true"></span> Held — something sits in the lane.</li>
        <li><span class="nar-legend-cell locked" aria-hidden="true"></span> Locked — wakes after enough escapes.</li>
        <li><span class="nar-legend-cell long" aria-hidden="true"></span> Long arrow — fills two or three cells.</li>
      </ul>
      <p>Three stars need a clean run: no hints and no wasted taps.</p>
      <p class="nar-dim">Keyboard: arrows to move, Enter to launch, U to undo, H for a hint.</p>
      <button class="cta-play" data-act="close-help">Got it</button>
    </div>
  </div>`;
}

export interface PlayBody {
  board: string;
  status: string;
}

export function playShellHtml(state: ArrowsState, modeLabel: string, body: PlayBody, reduced: boolean): string {
  return `<div class="shell nar-shell${reduced ? " reduce" : ""}">
    <div class="nar-top">
      <button class="icon-btn nar-back" data-act="menu" aria-label="Back to modes">${ICON_BACK}</button>
      <div class="nar-head">
        <div class="nar-word">NEON ARROWS</div>
        <span class="nar-badge">${modeLabel}</span>
      </div>
      <div class="nar-top-actions">
        <button class="icon-btn nar-undo" data-act="undo" aria-label="Undo">${ICON_UNDO}</button>
        <button class="icon-btn nar-hint" data-act="hint" aria-label="Hint">${ICON_HINT}</button>
        <button class="icon-btn nar-restart" data-act="restart" aria-label="Restart board">${ICON_RESTART}</button>
      </div>
    </div>
    ${hudHtml(state)}
    <div class="nar-play">
      <div class="nar-stage">
        <div class="nar-board-frame">
          <div class="nar-board-wrap">${body.board}</div>
          <div class="nar-sparks" aria-hidden="true"></div>
        </div>
      </div>
      ${body.status}
    </div>
  </div>`;
}

export function modeLabel(mode: ArrowsMode, state: ArrowsState): string {
  if (mode === "daily") return `DAILY ${state.date}`;
  if (mode === "endless") return state.boardIndex > 0 ? `ENDLESS · BOARD ${state.boardIndex + 1}` : "ENDLESS";
  return `LEVEL ${state.level}`;
}
