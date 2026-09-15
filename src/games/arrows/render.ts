import type { ArrowsCell, ArrowsMode, ArrowsState } from "./logic";
import { dirName, traceAll, traceCheckpointsMet } from "./logic";

const ICON_BACK = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" /></svg>`;
const ICON_RESTART = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 11a8 8 0 1 0-2.4 5.7" /><path d="M20 5v6h-6" /></svg>`;
const ICON_HINT = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.8.5-1.1 1-1.1 1.8v.4" /><path d="M12 17.2v.1" /></svg>`;
const ARROW_GLYPH = `<svg class="nar-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4l6 8h-3.4v8h-5.2v-8H6z" /></svg>`;
const EXIT_GLYPH = `<svg class="nar-exit" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3l7 9-7 9-7-9z" /><path d="M12 7.5l3.6 4.5L12 16.5 8.4 12z" /></svg>`;

export interface BoardView {
  focus?: number | null;
  hint?: number | null;
}

function cellClasses(cell: ArrowsCell, onPath: boolean): string[] {
  const parts = ["nar-cell", cell.kind];
  if (onPath) parts.push("on");
  if (cell.locked) parts.push("locked");
  return parts;
}

function cellLabel(state: ArrowsState, index: number, cell: ArrowsCell): string {
  const row = Math.floor(index / state.size) + 1;
  const col = (index % state.size) + 1;
  const source = state.sources.find((s) => s.cell === index);
  if (source) return `Energy source at row ${row} column ${col}, launching ${dirName(source.dir)}`;
  if (cell.kind === "wall") return `Wall at row ${row} column ${col}`;
  if (cell.kind === "exit") return `Exit portal at row ${row} column ${col}`;
  if (cell.kind === "checkpoint") return `Checkpoint at row ${row} column ${col}, locked pointing ${dirName(cell.dir)}`;
  if (cell.kind === "arrow") {
    return `Arrow at row ${row} column ${col}, pointing ${dirName(cell.dir)}${cell.locked ? ", locked" : ", activate to rotate"}`;
  }
  return `Empty at row ${row} column ${col}`;
}

export function boardHtml(state: ArrowsState, view: BoardView = {}): string {
  const traces = traceAll(state);
  const onPath = new Set<number>();
  const reached = new Set<number>();
  for (const trace of traces) {
    for (const cell of trace.path) onPath.add(cell);
    if (trace.status === "exit") {
      const last = trace.path[trace.path.length - 1];
      if (last !== undefined) reached.add(last);
    }
  }
  const rows: string[] = [];
  for (let row = 0; row < state.size; row += 1) {
    const cells: string[] = [];
    for (let col = 0; col < state.size; col += 1) {
      const index = row * state.size + col;
      const cell = state.cells[index];
      if (!cell) continue;
      const parts = cellClasses(cell, onPath.has(index));
      if (index === view.focus) parts.push("focus");
      if (index === view.hint) parts.push("hint");
      if (reached.has(index)) parts.push("ok");
      const isSource = state.sources.some((s) => s.cell === index);
      if (isSource) parts.push("source");
      let glyph = "";
      if (cell.kind === "arrow" || cell.kind === "checkpoint") {
        glyph = `<span class="nar-glyph d${cell.dir}">${ARROW_GLYPH}</span>`;
      } else if (cell.kind === "exit") {
        glyph = `<span class="nar-glyph">${EXIT_GLYPH}</span>`;
      } else if (isSource) {
        const source = state.sources.find((s) => s.cell === index);
        glyph = `<span class="nar-glyph d${source?.dir ?? 0} nar-source-mark">${ARROW_GLYPH}</span>`;
      }
      const interactive = (cell.kind === "arrow" || cell.kind === "checkpoint") && !cell.locked;
      const tag = interactive ? "button" : "div";
      const extra = interactive ? ` type="button"` : "";
      cells.push(
        `<${tag}${extra} role="gridcell" tabindex="-1" class="${parts.join(" ")}" data-cell="${index}" aria-label="${cellLabel(
          state,
          index,
          cell,
        )}">${glyph}</${tag}>`,
      );
    }
    rows.push(`<div role="row" class="nar-row">${cells.join("")}</div>`);
  }
  return `<div class="nar-board" role="grid" tabindex="0" aria-label="Arrow board, ${state.size} by ${state.size}">${rows.join(
    "",
  )}</div>`;
}

export interface BeamSummary {
  connected: number;
  total: number;
  blocked: number;
  loop: number;
  out: number;
  checkpointsMissing: number;
}

export function beamSummary(state: ArrowsState): BeamSummary {
  const traces = traceAll(state);
  const summary: BeamSummary = { connected: 0, total: traces.length, blocked: 0, loop: 0, out: 0, checkpointsMissing: 0 };
  for (const trace of traces) {
    if (trace.status === "exit") {
      summary.connected += 1;
      if (!traceCheckpointsMet(state, trace)) summary.checkpointsMissing += 1;
    } else if (trace.status === "blocked") summary.blocked += 1;
    else if (trace.status === "loop") summary.loop += 1;
    else summary.out += 1;
  }
  return summary;
}

export function statusText(state: ArrowsState): string {
  const summary = beamSummary(state);
  if (summary.total === 0) return "No energy source on this board.";
  if (summary.blocked > 0) return "A beam is blocked by a wall.";
  if (summary.loop > 0) return "A beam is looping back on itself.";
  if (summary.out > 0) return "A beam is escaping the grid.";
  if (summary.checkpointsMissing > 0) return "A beam must pass through the checkpoint.";
  if (summary.connected === summary.total) return "All beams locked in.";
  return "Route every beam to its portal.";
}

export function hudHtml(state: ArrowsState): string {
  const summary = beamSummary(state);
  const left = state.maxRotations === null ? "FREE" : String(Math.max(0, state.maxRotations - state.rotations));
  const tight = state.maxRotations !== null && state.maxRotations - state.rotations <= 1;
  return `<div class="nar-hud" role="group" aria-label="Run stats">
    <div class="nar-stat"><span class="k">BEAMS</span><span class="v" data-hud="beams">${summary.connected}<i>/${summary.total}</i></span></div>
    <div class="nar-stat"><span class="k">ROTATIONS</span><span class="v" data-hud="rotations">${state.rotations}</span></div>
    <div class="nar-stat"><span class="k">PAR</span><span class="v" data-hud="par">${state.par}</span></div>
    <div class="nar-stat${tight ? " hot" : ""}"><span class="k">BUDGET</span><span class="v" data-hud="left">${left}</span></div>
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
    const label = locked
      ? `Level ${option.level}, locked`
      : `Level ${option.level}, ${option.stars} of 3 stars`;
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
        <span class="nar-badge">STEER THE BEAM</span>
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
  score: number;
  rotations: number;
  par: number;
  hints: number;
  stars: number;
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
      ? "DAILY COMPLETE"
      : view.mode === "endless"
        ? "RUN OVER"
        : view.solved
          ? "BOARD SOLVED"
          : "OUT OF ROTATIONS";
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
  const next = view.mode === "level" && view.solved && view.hasNext ? `<button class="cta-play" data-act="level-next">NEXT LEVEL</button>` : "";
  return `<div class="overlay nar-overlay">
    <div class="win-card nar-card">
      <div class="nar-card-glow" aria-hidden="true"></div>
      <h2>${title}</h2>
      ${badge}
      <div class="stars" aria-label="${view.stars} of 3 stars">${starsText(view.stars)}</div>
      <div class="nar-result-grid">
        ${resultStat("SCORE", String(view.score), "wide")}
        ${resultStat("ROTATIONS", String(view.rotations))}
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
      <p><b>Rotate</b> the arrow tiles until every beam reaches its portal. Tap a tile to spin it a quarter turn clockwise.</p>
      <p><b>Read</b> the trail: your live beams glow cyan. A beam that escapes the grid, hits a wall, or loops back on itself is drawn as a warning.</p>
      <ul class="nar-legend">
        <li><span class="nar-legend-cell source" aria-hidden="true"></span> Energy source — the launch point.</li>
        <li><span class="nar-legend-cell arrow" aria-hidden="true"></span> Arrow — rotate this.</li>
        <li><span class="nar-legend-cell exit" aria-hidden="true"></span> Portal — the beam must land here.</li>
        <li><span class="nar-legend-cell locked" aria-hidden="true"></span> Locked tile — cannot rotate.</li>
      </ul>
      <p>The <b>par</b> is the fewest rotations the board needs. Beat it for three stars. Some boards cap your rotations, shown as <b>budget</b>.</p>
      <p class="nar-dim">Keyboard: focus the board, move with the arrow keys, and press Enter to rotate the focused tile.</p>
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
