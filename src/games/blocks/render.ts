import type { Board, BlocksState, PaletteColor } from "./logic";
import { BLOCKS_PALETTE, colorName, idx, shapeHeight, shapeWidth } from "./logic";
import type { ShapeDef } from "./generate";
import type { BlocksDailyRecord } from "../../save/schema";

export type PatternId = 1 | 2 | 3 | 4 | 5;

function palette(color: number): PaletteColor {
  return BLOCKS_PALETTE.find((c) => c.id === color) ?? BLOCKS_PALETTE[0]!;
}

const ICON_BACK = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" /></svg>`;
const ICON_RESTART = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 11a8 8 0 1 0-2.4 5.7" /><path d="M20 5v6h-6" /></svg>`;
const ICON_HELP = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.8.5-1.1 1-1.1 1.8v.4" /><path d="M12 17.2v.1" /></svg>`;

/** A tiny labelled swatch grid used for tray pieces and help examples. */
export function pieceShapeHtml(shape: ShapeDef): string {
  const w = shapeWidth(shape);
  const h = shapeHeight(shape);
  const set = new Set(shape.cells.map(([r, c]) => `${r},${c}`));
  const cells: string[] = [];
  for (let r = 0; r < h; r += 1) {
    for (let c = 0; c < w; c += 1) {
      const on = set.has(`${r},${c}`);
      cells.push(`<span class="neon-mini${on ? ` p${shape.color} pat${shape.color}` : " off"}" aria-hidden="true"></span>`);
    }
  }
  return `<span class="neon-shape" data-shape="${shape.id}" data-color="${shape.color}" style="grid-template-columns:repeat(${w},1fr)" aria-hidden="true">${cells.join(
    "",
  )}</span>`;
}

export interface BoardView {
  /** Cell indices to highlight as a valid placement. */
  preview?: number[] | null;
  /** Cell indices of valid placement origins (subtle dots). */
  origins?: number[] | null;
  /** Cell indices to highlight when the focused placement is illegal. */
  invalidPreview?: number[] | null;
  /** Cell indices currently animating out after a line clear. */
  clearing?: number[] | null;
  /** Cell indices that were just filled by the latest placement. */
  placed?: number[] | null;
  /** Keyboard cursor cell index, when the board has focus. */
  cursor?: number | null;
}

function cellClasses(
  color: number,
  opts: { preview: boolean; origin: boolean; invalid: boolean; clearing: boolean; placed: boolean; cursor: boolean },
): string {
  const parts = ["neon-cell"];
  if (color > 0) {
    parts.push(`p${color}`, `pat${color}`);
  } else {
    parts.push("empty");
  }
  if (opts.preview) parts.push("preview");
  if (opts.origin) parts.push("origin");
  if (opts.invalid) parts.push("invalid");
  if (opts.clearing) parts.push("clearing");
  if (opts.placed) parts.push("settle");
  if (opts.cursor) parts.push("cursor");
  return parts.join(" ");
}

export function boardHtml(state: BlocksState, view: BoardView = {}, displayBoard?: Board): string {
  const board = displayBoard ?? state.board;
  const preview = new Set(view.preview ?? []);
  const origins = new Set(view.origins ?? []);
  const invalid = new Set(view.invalidPreview ?? []);
  const clearing = new Set(view.clearing ?? []);
  const placed = new Set(view.placed ?? []);
  const rows: string[] = [];
  for (let row = 0; row < state.size; row += 1) {
    const cells: string[] = [];
    for (let col = 0; col < state.size; col += 1) {
      const i = idx(state.size, row, col);
      const color = board[i] ?? 0;
      const label = color > 0 ? `${colorName(color)} block` : "empty";
      const classes = cellClasses(color, {
        preview: preview.has(i),
        origin: origins.has(i),
        invalid: invalid.has(i),
        clearing: clearing.has(i),
        placed: placed.has(i),
        cursor: view.cursor === i,
      });
      cells.push(`<div role="gridcell" class="${classes}" data-cell="${i}" aria-label="${label}"></div>`);
    }
    rows.push(`<div role="row" class="neon-row">${cells.join("")}</div>`);
  }
  return `<div class="neon-board" role="grid" tabindex="0" aria-label="Board, ${state.size} by ${state.size}">${rows.join(
    "",
  )}</div>`;
}

export function trayHtml(state: BlocksState, selected: number | null): string {
  const slots: string[] = [];
  for (let i = 0; i < state.pieces.length; i += 1) {
    const shape = state.pieces[i];
    if (!shape) {
      slots.push(`<span class="neon-piece-slot empty" aria-hidden="true"></span>`);
      continue;
    }
    const isSelected = selected === i;
    const color = palette(shape.color);
    const label = `${shape.label}, ${color.name}${isSelected ? ", selected" : ""}`;
    slots.push(
      `<button type="button" class="neon-piece-slot p${shape.color}${isSelected ? " selected" : ""}" data-piece="${i}" aria-pressed="${isSelected}" aria-label="${label}">${pieceShapeHtml(
        shape,
      )}</button>`,
    );
  }
  return `<div class="neon-tray" role="group" aria-label="Pieces">${slots.join("")}</div>`;
}

export function hudHtml(state: BlocksState, best: number): string {
  return `<div class="neon-hud" role="group" aria-label="Run stats">
    <div class="neon-stat"><span class="k">SCORE</span><span class="v" data-hud="score">${state.score}</span></div>
    <div class="neon-stat"><span class="k">BEST</span><span class="v" data-hud="best">${Math.max(best, state.score)}</span></div>
    <div class="neon-stat"><span class="k">LINES</span><span class="v" data-hud="lines">${state.lines}</span></div>
    <div class="neon-stat combo${state.combo > 1 ? " hot" : ""}"><span class="k">COMBO</span><span class="v" data-hud="combo">${
      state.combo > 1 ? `x${state.combo}` : "-"
    }</span></div>
  </div>`;
}

export function liveStatusHtml(message: string): string {
  return `<div class="neon-status" id="blocks-status" role="status" aria-live="polite">${message}</div>`;
}

export function starsText(stars: number): string {
  const clamped = Math.max(0, Math.min(3, Math.floor(stars)));
  return `${"★".repeat(clamped)}${"☆".repeat(3 - clamped)}`;
}

export interface MenuView {
  date: string;
  best: number;
  bestCombo: number;
  runs: number;
  dailyRecord: BlocksDailyRecord | null;
  dailyStreak: number;
  dailyBest: number;
}

function dailyCardHtml(view: MenuView): string {
  const done = view.dailyRecord;
  const status = done
    ? `TODAY ${done.score} PTS · ${done.lines} LINES`
    : `TODAY'S SEEDED RUN${view.dailyStreak > 0 ? ` · ${view.dailyStreak} DAY STREAK` : ""}`;
  return `<button type="button" class="neon-daily-card${done ? " done" : ""}" data-act="daily">
    <span class="neon-daily-mark" aria-hidden="true"></span>
    <span class="neon-daily-text">
      <span class="neon-daily-label">NEON BLOCKS DAILY</span>
      <span class="neon-daily-date">${view.date}</span>
      <span class="neon-daily-status">${status}</span>
      ${view.dailyBest > 0 ? `<span class="neon-daily-best">DAILY BEST ${view.dailyBest}</span>` : ""}
    </span>
    <span class="neon-daily-arrow" aria-hidden="true">›</span>
  </button>`;
}

export function menuHtml(view: MenuView, reduced: boolean): string {
  return `<div class="shell neon-shell${reduced ? " reduce" : ""}">
    <div class="neon-top">
      <button class="icon-btn neon-back" data-act="arcade" aria-label="Back to arcade">${ICON_BACK}</button>
      <div class="neon-head">
        <div class="neon-word">NEON BLOCKS</div>
        <span class="neon-badge">BLOCK PUZZLE</span>
      </div>
      <button class="icon-btn neon-help" data-act="help" aria-label="How to play">${ICON_HELP}</button>
    </div>
    <div class="neon-menu-body">
      <div class="neon-hero" aria-hidden="true">
        ${pieceShapeHtml({ id: "hero-line", label: "3 across", cells: [[0, 0], [0, 1], [0, 2]], tier: "medium", color: 1 })}
        ${pieceShapeHtml({ id: "hero-square", label: "2 by 2", cells: [[0, 0], [0, 1], [1, 0], [1, 1]], tier: "medium", color: 2 })}
        ${pieceShapeHtml({ id: "hero-corner", label: "corner", cells: [[0, 0], [1, 0], [2, 0], [2, 1]], tier: "large", color: 3 })}
      </div>
      ${dailyCardHtml(view)}
      <button type="button" class="cta-play neon-endless" data-act="endless">
        <span class="neon-endless-k">ENDLESS</span>
        <span class="neon-endless-sub">${view.runs > 0 ? `${view.runs} RUNS · BEST ${view.best}` : "NO TIME PRESSURE · SCORE ATTACK"}</span>
      </button>
      <div class="neon-menu-stats">
        <span>BEST <b>${view.best}</b></span>
        <span>COMBO <b>x${Math.max(1, view.bestCombo)}</b></span>
        <span>RUNS <b>${view.runs}</b></span>
      </div>
    </div>
  </div>`;
}

export interface ResultView {
  mode: "endless" | "daily";
  date: string;
  score: number;
  lines: number;
  bestCombo: number;
  stars: number;
  best: number;
  isBest: boolean;
  ranked: boolean;
  dailyBest: number;
}

function resultStat(k: string, v: string, accent = ""): string {
  return `<div class="neon-result-stat${accent ? ` ${accent}` : ""}"><span class="k">${k}</span><span class="v">${v}</span></div>`;
}

export function resultCardHtml(view: ResultView): string {
  const title = view.mode === "daily" ? "DAILY COMPLETE" : "GAME OVER";
  const badge = view.mode === "daily"
    ? view.ranked
      ? `<div class="neon-practice reward">RANKED · FIRST RUN TODAY</div>`
      : `<div class="neon-practice">PRACTICE · DAILY ALREADY SCORED</div>`
    : view.isBest
      ? `<div class="neon-practice reward">NEW BEST</div>`
      : "";
  const meta = view.mode === "daily" ? `<div class="win-meta">DAILY BEST ${Math.max(view.dailyBest, view.score)}</div>` : "";
  return `<div class="overlay neon-overlay">
    <div class="win-card neon-card">
      <div class="neon-card-glow" aria-hidden="true"></div>
      <h2>${title}</h2>
      ${badge}
      <div class="stars" aria-label="${view.stars} of 3 stars">${starsText(view.stars)}</div>
      <div class="neon-result-grid">
        ${resultStat("SCORE", String(view.score), "wide")}
        ${resultStat("BEST", String(view.best))}
        ${resultStat("LINES", String(view.lines))}
        ${resultStat("COMBO", `x${Math.max(1, view.bestCombo)}`)}
      </div>
      ${meta}
      <div class="win-actions">
        <button class="cta-play" data-act="${view.mode === "daily" ? "daily-again" : "endless"}">PLAY AGAIN</button>
        <button class="ghost-btn" data-act="arcade">BACK TO ARCADE</button>
        <button class="ghost-btn" data-act="menu">MODES</button>
      </div>
    </div>
  </div>`;
}

export function helpHtml(reduced: boolean): string {
  return `<div class="shell neon-shell${reduced ? " reduce" : ""}">
    <div class="neon-top">
      <button class="icon-btn neon-back" data-act="close-help" aria-label="Close help">${ICON_BACK}</button>
      <div class="neon-head"><div class="neon-word">HOW TO PLAY</div></div>
      <span class="neon-spacer"></span>
    </div>
    <div class="neon-help">
      <p><b>Place</b> all three neon pieces onto the grid. Tap a piece, then tap a cell to drop it — or drag it straight on.</p>
      <p><b>Clear</b> a full row or column. Clear several lines at once, or on back-to-back moves, for bigger combos.</p>
      <ul class="neon-legend">
        <li>${pieceShapeHtml({ id: "line3h", label: "3 across", cells: [[0, 0], [0, 1], [0, 2]], tier: "medium", color: 1 })} A full line clears.</li>
        <li><span class="neon-legend-preview"></span> Valid placement preview.</li>
        <li><span class="neon-legend-invalid"></span> Blocked or off the grid.</li>
      </ul>
      <p>No falling blocks and no clock. The run ends only when none of your pieces fit anywhere.</p>
      <p class="neon-dim">Keyboard: focus the board and use the arrow keys, then Enter to place.</p>
      <button class="cta-play" data-act="close-help">Got it</button>
    </div>
  </div>`;
}

export interface PlayBody {
  board: string;
  tray: string;
  status: string;
}

export function playShellHtml(
  state: BlocksState,
  best: number,
  modeLabel: string,
  body: PlayBody,
  reduced: boolean,
): string {
  return `<div class="shell neon-shell${reduced ? " reduce" : ""}">
    <div class="neon-top">
      <button class="icon-btn neon-back" data-act="menu" aria-label="Back to modes">${ICON_BACK}</button>
      <div class="neon-head">
        <div class="neon-word">NEON BLOCKS</div>
        <span class="neon-badge">${modeLabel}</span>
      </div>
      <button class="icon-btn neon-restart" data-act="restart" aria-label="Restart run">${ICON_RESTART}</button>
    </div>
    ${hudHtml(state, best)}
    <div class="neon-play">
      <div class="neon-stage">
        <div class="neon-board-frame">
          <div class="neon-board-wrap">${body.board}</div>
          <div class="neon-sparks" aria-hidden="true"></div>
        </div>
      </div>
      <div class="neon-tray-wrap">
        <div class="neon-tray-label" aria-hidden="true">YOUR PIECES</div>
        ${body.tray}
      </div>
      ${body.status}
    </div>
  </div>`;
}
