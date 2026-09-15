import type { ArrowsMode, ArrowsState } from "./logic";
import { bodyCells, dirName, isLocked, movableIndices, occupiedAt, stepCell } from "./logic";

const ICON_BACK = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" /></svg>`;
const ICON_RESTART = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 11a8 8 0 1 0-2.4 5.7" /><path d="M20 5v6h-6" /></svg>`;
const ICON_HINT = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.8.5-1.1 1-1.1 1.8v.4" /><path d="M12 17.2v.1" /></svg>`;
const ICON_UNDO = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 7H5v-4" /><path d="M5 7a7 7 0 1 1 2 5" /></svg>`;
const ARROW_TIP = `<svg class="nar-tip" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.5l7.5 13H4.5z" /></svg>`;
const LOCK_MARK = `<svg class="nar-lock" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>`;

export interface BoardView {
  focus?: number | null;
  hint?: number | null;
  /** Arrow currently being pressed, for lane preview. */
  press?: number | null;
}

export interface LanePreview {
  cells: number[];
  blocked: boolean;
}

/** Cells in front of an arrow until the edge or the first obstruction. */
export function laneCells(state: ArrowsState, index: number): LanePreview {
  const arrow = state.arrows[index];
  if (!arrow || (state.bodies[index] ?? 0) <= 0) return { cells: [], blocked: false };
  const occupied = occupiedAt(state.size, state.arrows, state.heads, state.bodies, index);
  const cells: number[] = [];
  let cell = state.heads[index]!;
  for (;;) {
    const next = stepCell(state.size, cell, arrow.dir);
    if (next < 0) return { cells, blocked: false };
    cells.push(next);
    if (occupied.has(next)) return { cells, blocked: true };
    cell = next;
  }
}

function cellLabel(state: ArrowsState, index: number): string {
  const row = Math.floor(index / state.size) + 1;
  const col = (index % state.size) + 1;
  const arrow = state.arrows[index];
  if (!arrow || (state.bodies[index] ?? 0) <= 0) return `Empty at row ${row} column ${col}`;
  const lock = isLocked(state, index) ? ", locked" : "";
  const long = arrow.length > 1 ? `, ${arrow.length} cells long` : "";
  return `Arrow at row ${row} column ${col}, pointing ${dirName(arrow.dir)}${long}${lock}, tap to launch`;
}

export function boardHtml(state: ArrowsState, view: BoardView = {}): string {
  const moves = new Set(movableIndices(state.size, state.arrows, state.heads, state.bodies));
  const occupied = new Map<number, { arrow: number; offset: number }>();
  for (let i = 0; i < state.arrows.length; i += 1) {
    const body = state.bodies[i] ?? 0;
    if (body <= 0) continue;
    const arrow = state.arrows[i]!;
    bodyCells(state.size, arrow.dir, state.heads[i]!, body).forEach((cell, offset) => {
      occupied.set(cell, { arrow: i, offset });
    });
  }

  const lane = view.press != null ? laneCells(state, view.press) : null;
  const laneSet = new Set(lane?.cells ?? []);
  const laneBlock = lane?.blocked ? lane.cells[lane.cells.length - 1] : -1;

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
      const classes = ["nar-tile", `d${arrow.dir}`];
      classes.push(part.offset === 0 ? "head" : "tail");
      if (arrow.length > 1) classes.push("long");
      if (locked) classes.push("locked");
      classes.push(moves.has(part.arrow) ? "ready" : "held");
      if (laneSet.has(index)) classes.push("lane");
      if (index === laneBlock) classes.push("lane-block");
      if (view.focus === part.arrow && part.offset === 0) classes.push("focus");
      if (view.hint === part.arrow) classes.push("hint");
      const glyph = part.offset === 0 ? ARROW_TIP : "";
      const lockMark = locked && part.offset === 0 ? LOCK_MARK : "";
      cells.push(
        `<button type="button" role="gridcell" tabindex="-1" class="${classes.join(" ")}" data-arrow="${part.arrow}" data-cell="${index}" aria-label="${cellLabel(
          state,
          part.arrow,
        )}">${glyph}${lockMark}</button>`,
      );
    }
    rows.push(`<div role="row" class="nar-row">${cells.join("")}</div>`);
  }
  const dim = `style="--nar-size:${state.size}"`;
  return `<div class="nar-board" role="grid" tabindex="0" ${dim} aria-label="Arrow board, ${state.size} by ${state.size}">${rows.join(
    "",
  )}</div>`;
}

export function remainingArrows(state: ArrowsState): number {
  return state.bodies.reduce((count, body) => (body > 0 ? count + 1 : count), 0);
}

export function statusText(state: ArrowsState): string {
  if (state.status === "solved") return "Clean exit. Every arrow escaped.";
  if (state.status === "stuck") return "Dead end — no arrow can launch.";
  const moves = movableIndices(state.size, state.arrows, state.heads, state.bodies);
  if (moves.length === 0) return "Dead end — no arrow can launch.";
  const ready = moves.length === 1 ? "1 arrow is ready to launch." : `${moves.length} arrows are ready to launch.`;
  return `${ready} Launch them in the right order.`;
}

export function hudHtml(state: ArrowsState): string {
  return `<div class="nar-hud" role="group" aria-label="Run stats">
    <div class="nar-stat"><span class="k">LEFT</span><span class="v" data-hud="left">${remainingArrows(state)}</span></div>
    <div class="nar-stat"><span class="k">LAUNCHES</span><span class="v" data-hud="launches">${state.launches}</span></div>
    <div class="nar-stat"><span class="k">PAR</span><span class="v" data-hud="par">${state.par}</span></div>
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

function levelGridHtml(view: MenuView): string {
  const cells = view.levels.map((option) => {
    const locked = !option.unlocked;
    const label = locked ? `Level ${option.level}, locked` : `Level ${option.level}, ${option.stars} of 3 stars`;
    return `<button type="button" class="nar-level${locked ? " locked" : ""}${option.stars > 0 ? " won" : ""}" data-level="${
      option.level
    }"${locked ? " disabled" : ""} aria-label="${label}">
      <span class="nar-level-num">${option.level}</span>
      ${option.stars > 0 ? `<span class="nar-level-stars" aria-hidden="true">${"★".repeat(option.stars)}</span>` : ""}
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
        <span class="nar-endless-sub">${
          view.bestRun > 0 ? `${view.bestRun} BOARD RUN · ${view.boards} CLEARED` : "CHAIN BOARDS · SCORE ATTACK"
        }</span>
      </button>
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
  stuck: boolean;
  score: number;
  launches: number;
  par: number;
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
        : "DEAD END"
      : view.mode === "endless"
        ? "RUN OVER"
        : view.solved
          ? "BOARD CLEARED"
          : "DEAD END";
  const badge =
    view.mode === "daily"
      ? view.ranked
        ? `<div class="nar-practice reward">RANKED · FIRST RUN TODAY</div>`
        : `<div class="nar-practice">PRACTICE · DAILY ALREADY SCORED</div>`
      : view.mode === "endless"
        ? view.isBest
          ? `<div class="nar-practice reward">NEW BEST</div>`
          : `<div class="nar-practice">${view.boards} BOARDS CLEARED</div>`
        : `<div class="nar-practice reward">LEVEL ${view.level}</div>`;
  const replay = view.mode === "daily" ? "daily-again" : view.mode === "endless" ? "endless" : "level";
  const next =
    view.mode === "level" && view.solved && view.hasNext ? `<button class="cta-play" data-act="level-next">NEXT LEVEL</button>` : "";
  return `<div class="overlay nar-overlay">
    <div class="win-card nar-card">
      <div class="nar-card-glow" aria-hidden="true"></div>
      <h2>${title}</h2>
      ${badge}
      <div class="stars" aria-label="${view.stars} of 3 stars">${starsText(view.stars)}</div>
      <div class="nar-result-grid">
        ${resultStat("SCORE", String(view.score), "wide")}
        ${resultStat("LAUNCHES", String(view.launches))}
        ${resultStat("PAR", String(view.par))}
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
      <p><b>Launch</b> an arrow by tapping it. It slides one cell in the direction it points — it can never turn.</p>
      <p>An arrow only moves when the cell in front of it is empty. Wall it in and it stays put. When an arrow reaches the edge it <b>escapes</b>.</p>
      <p>Clear every arrow to finish. If arrows remain and none can move, the board is a <b>dead end</b>.</p>
      <ul class="nar-legend">
        <li><span class="nar-legend-cell ready" aria-hidden="true"></span> Ready — a clear cell ahead.</li>
        <li><span class="nar-legend-cell held" aria-hidden="true"></span> Held — something blocks the way.</li>
        <li><span class="nar-legend-cell locked" aria-hidden="true"></span> Locked — wakes after enough escapes.</li>
        <li><span class="nar-legend-cell long" aria-hidden="true"></span> Long arrow — takes extra launches to clear.</li>
      </ul>
      <p>The <b>par</b> is the fewest launches the board can be cleared in. Finish without hints for three stars.</p>
      <p class="nar-dim">Keyboard: move with the arrow keys, press Enter to launch, U to undo, H for a hint.</p>
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
