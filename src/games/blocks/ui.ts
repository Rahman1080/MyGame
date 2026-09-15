import { localYmd } from "../../gen/daily";
import { setBackHandler } from "../../platform/router";
import { EVENTS } from "../../platform/services/telemetry";
import type { GameContext } from "../../platform/types";
import type { BlocksSave } from "../../save/schema";
import type { ShapeDef } from "./generate";
import {
  type BlocksResult,
  type BlocksState,
  createDailyState,
  createEndlessState,
  dailyBestScore,
  dailyRecordFor,
  dailyStreakOn,
  emptyBlocksSave,
  finalResult,
  idx,
  isDailyDone,
  placePiece,
  recordDailyRun,
  recordEndlessRun,
  shapeHeight,
  shapeWidth,
} from "./logic";
import {
  boardHtml,
  helpHtml,
  hudHtml,
  liveStatusHtml,
  menuHtml,
  pieceShapeHtml,
  playShellHtml,
  resultCardHtml,
  trayHtml,
  type BoardView,
  type MenuView,
  type PlayBody,
  type ResultView,
} from "./render";

type Screen = "menu" | "play" | "over" | "help";

interface DragState {
  pointerId: number;
  piece: number;
  startX: number;
  startY: number;
  active: boolean;
  ghost: HTMLElement | null;
  grabR: number;
  grabC: number;
  anchorRow: number | null;
  anchorCol: number | null;
}

let app: HTMLElement;
let ctx: GameContext<BlocksSave> | null = null;
let state: BlocksState | null = null;
let screen: Screen = "menu";
let helpFrom: Screen = "menu";
let selected: number | null = null;
let hover: number | null = null;
let cursor = 0;
let keyboardMode = false;
let animBoard: number[] | null = null;
let clearingCells: number[] = [];
let placedCells: number[] = [];
let animating = false;
let dragging: DragState | null = null;
let suppressClick = false;
let statusMessage = "";
let date = "";
let resultView: ResultView | null = null;
let aborter: AbortController | null = null;
let timers: number[] = [];
let endlessSeed = 0;

function reduced(): boolean {
  return ctx?.settings.reduceMotion() ?? false;
}

function schedule(fn: () => void, ms: number): void {
  const id = window.setTimeout(fn, ms);
  timers.push(id);
}

function clearTimers(): void {
  for (const id of timers) window.clearTimeout(id);
  timers = [];
}

function save(): BlocksSave {
  return ctx?.save ?? emptyBlocksSave();
}

function modeLabel(current: BlocksState): string {
  return current.mode === "daily" ? `DAILY ${current.date}` : "ENDLESS";
}

function setStatus(message: string): void {
  statusMessage = message;
  const el = app.querySelector<HTMLElement>("#blocks-status");
  if (el) el.textContent = message;
}

function boardElement(): HTMLElement | null {
  return app.querySelector<HTMLElement>(".neon-board");
}

function previewAt(shape: ShapeDef, row: number, col: number): { preview: number[]; invalid: number[] } {
  if (!state) return { preview: [], invalid: [] };
  const inside: number[] = [];
  let blocked = false;
  for (const [dr, dc] of shape.cells) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || c < 0 || r >= state.size || c >= state.size) {
      blocked = true;
      continue;
    }
    const i = idx(state.size, r, c);
    inside.push(i);
    if (state.board[i] !== 0) blocked = true;
  }
  return blocked ? { preview: [], invalid: inside } : { preview: inside, invalid: [] };
}

function boardView(): BoardView {
  if (!state) return {};
  const current = state;
  if (dragging?.active && dragging.anchorRow !== null && dragging.anchorCol !== null) {
    const shape = current.pieces[dragging.piece];
    if (shape) {
      const at = previewAt(shape, dragging.anchorRow, dragging.anchorCol);
      return { preview: at.preview, invalidPreview: at.invalid };
    }
  }
  if (selected !== null && current.pieces[selected]) {
    const shape = current.pieces[selected]!;
    const anchor = keyboardMode ? cursor : hover;
    if (anchor !== null) {
      const coord = cellCoord(anchor);
      if (coord) {
        const at = previewAt(shape, coord.row, coord.col);
        return { preview: at.preview, invalidPreview: at.invalid };
      }
    }
  }
  return {};
}

interface RefreshOptions {
  board?: boolean;
  tray?: boolean;
  hud?: boolean;
}

function refreshPlay(opts: RefreshOptions = {}): void {
  if (!state) return;
  const wantBoard = opts.board !== false;
  const wantTray = opts.tray !== false;
  const wantHud = opts.hud !== false;
  const refocus = keyboardMode;
  const view = boardView();
  if (wantBoard) {
    const wrap = app.querySelector<HTMLElement>(".neon-board-wrap");
    const board = animBoard ?? state.board;
    if (wrap) wrap.innerHTML = boardHtml(state, { ...view, clearing: clearingCells, placed: placedCells, cursor: keyboardMode ? cursor : null }, board);
  }
  if (wantTray) {
    const tray = app.querySelector<HTMLElement>(".neon-tray");
    if (tray) tray.outerHTML = trayHtml(state, selected);
  }
  if (wantHud) {
    const hud = app.querySelector<HTMLElement>(".neon-hud");
    if (hud) hud.outerHTML = hudHtml(state, save().best);
  }
  if (wantBoard && refocus) boardElement()?.focus();
}

function playBody(): PlayBody {
  if (!state) return { board: "", tray: "", status: "" };
  return {
    board: boardHtml(state, { ...boardView(), clearing: clearingCells, placed: placedCells, cursor: keyboardMode ? cursor : null }, animBoard ?? state.board),
    tray: trayHtml(state, selected),
    status: liveStatusHtml(statusMessage),
  };
}

function render(): void {
  if (!state && screen !== "menu" && screen !== "help") screen = "menu";
  if (screen === "menu") {
    const view: MenuView = {
      date,
      best: save().best,
      bestCombo: save().bestCombo,
      runs: save().runs,
      dailyRecord: dailyRecordFor(save(), date),
      dailyStreak: dailyStreakOn(save(), date),
      dailyBest: dailyBestScore(save(), date),
    };
    app.innerHTML = menuHtml(view, reduced());
    return;
  }
  if (screen === "help") {
    app.innerHTML = helpHtml(reduced());
    return;
  }
  if (!state) return;
  app.innerHTML = playShellHtml(state, save().best, modeLabel(state), playBody(), reduced());
  if (screen === "over" && resultView) {
    const shell = app.querySelector<HTMLElement>(".neon-shell");
    if (shell) shell.insertAdjacentHTML("beforeend", resultCardHtml(resultView));
  }
}

function spawnSparks(cells: readonly number[]): void {
  if (!state || reduced()) return;
  const sparks = app.querySelector<HTMLElement>(".neon-sparks");
  if (!sparks) return;
  const offsets = [
    [-18, -22],
    [16, -26],
    [-24, 8],
    [22, 12],
    [0, -30],
    [8, 24],
  ];
  for (const i of cells) {
    const row = Math.floor(i / state.size);
    const col = i % state.size;
    const left = ((col + 0.5) / state.size) * 100;
    const top = ((row + 0.5) / state.size) * 100;
    offsets.forEach(([dx, dy], k) => {
      const spark = document.createElement("span");
      spark.className = `neon-spark s${(k % 3) + 1}`;
      spark.style.left = `${left}%`;
      spark.style.top = `${top}%`;
      spark.style.setProperty("--dx", `${dx}px`);
      spark.style.setProperty("--dy", `${dy}px`);
      sparks.appendChild(spark);
    });
  }
  schedule(() => {
    sparks.innerHTML = "";
  }, 520);
}

function describePlacement(shape: ShapeDef, lines: number, gained: number, combo: number): string {
  if (lines <= 0) return `Placed ${shape.label}.`;
  const plural = lines === 1 ? "line" : "lines";
  const comboText = combo > 1 ? ` Combo x${combo}.` : "";
  return `Cleared ${lines} ${plural}! +${gained} points.${comboText}`;
}

function finishClearAnim(): void {
  animating = false;
  animBoard = null;
  clearingCells = [];
  placedCells = [];
  refreshPlay();
  if (state?.status === "over") finishRun();
}

function placementCells(shape: ShapeDef, row: number, col: number): number[] {
  if (!state) return [];
  const cells: number[] = [];
  for (const [dr, dc] of shape.cells) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || c < 0 || r >= state.size || c >= state.size) continue;
    cells.push(idx(state.size, r, c));
  }
  return cells;
}

function commit(lines: number, cells: readonly number[], stamped: number[] | null): void {
  if (!state) return;
  if (cells.length === 0 || !stamped || lines <= 0) {
    refreshPlay();
    if (state.status === "over") finishRun();
    return;
  }
  animBoard = stamped;
  clearingCells = cells.slice();
  animating = true;
  refreshPlay();
  spawnSparks(cells);
  if (reduced()) {
    finishClearAnim();
  } else {
    schedule(finishClearAnim, 240);
  }
}

function tryPlace(pieceIndex: number, row: number, col: number): boolean {
  if (!state || screen !== "play" || animating || state.status !== "playing") return false;
  const shape = state.pieces[pieceIndex];
  if (!shape) return false;
  const before = state.score;
  const outcome = placePiece(state, pieceIndex, row, col);
  if (outcome.illegal || !outcome.result) {
    ctx?.audio.invalid();
    ctx?.haptics.fail();
    setStatus("That piece does not fit there.");
    return false;
  }
  state = outcome.state;
  selected = null;
  placedCells = placementCells(shape, row, col);
  const result = outcome.result;
  const gained = state.score - before;
  if (result.lines > 0) {
    ctx?.haptics.success();
    if (result.lines > 1 || state.combo > 1) ctx?.audio.combo(Math.max(result.lines, state.combo));
    else ctx?.audio.success();
  } else {
    ctx?.haptics.tap();
    ctx?.audio.move();
  }
  const message = describePlacement(shape, result.lines, gained, state.combo);
  if (state.status === "over") {
    setStatus(`${message} No moves left.`);
  } else {
    setStatus(message);
  }
  commit(result.lines, result.cells, result.stamped);
  if (placedCells.length > 0) {
    schedule(() => {
      if (placedCells.length === 0) return;
      placedCells = [];
      refreshPlay({ tray: false, hud: false });
    }, reduced() ? 0 : 220);
  }
  return true;
}

function startRun(mode: "endless" | "daily"): void {
  if (!ctx) return;
  if (mode === "daily") {
    state = createDailyState(date);
  } else {
    endlessSeed += 1;
    state = createEndlessState(`blocks:endless:${Date.now()}:${endlessSeed}`);
  }
  selected = null;
  hover = null;
  cursor = 0;
  animBoard = null;
  clearingCells = [];
  placedCells = [];
  animating = false;
  resultView = null;
  statusMessage = mode === "daily" ? `Daily run for ${date}. Place a piece.` : "Place a piece to begin.";
  screen = "play";
  render();
  ctx.analytics.track(mode === "daily" ? EVENTS.dailyStarted : EVENTS.gameStarted, { game: "blocks" });
}

function finishRun(): void {
  if (!state || !ctx || screen === "over") return;
  const result: BlocksResult = finalResult(state);
  const wasDaily = state.mode === "daily";
  const ranked = wasDaily && !isDailyDone(ctx.save, state.date);
  const priorBest = ctx.save.best;
  if (wasDaily) {
    if (ranked) {
      ctx.updateSave(recordDailyRun(ctx.save, result));
      ctx.report({ score: result.score, stars: result.stars, solved: true, stats: { lines: result.lines, moves: result.moves, bestCombo: result.bestCombo } });
      ctx.analytics.track(EVENTS.dailyCompleted, { game: "blocks", score: result.score, lines: result.lines });
    }
  } else {
    ctx.updateSave(recordEndlessRun(ctx.save, result));
    ctx.report({ score: result.score, stars: result.stars, solved: true, stats: { lines: result.lines, moves: result.moves, bestCombo: result.bestCombo } });
    ctx.analytics.track(EVENTS.gameCompleted, { game: "blocks", score: result.score, lines: result.lines });
  }
  ctx.audio.levelComplete();
  ctx.haptics.success();
  const dailyBest = wasDaily ? Math.max(dailyBestScore(ctx.save, state.date), result.score) : 0;
  resultView = {
    mode: result.mode,
    date: result.date,
    score: result.score,
    lines: result.lines,
    bestCombo: result.bestCombo,
    stars: result.stars,
    best: Math.max(priorBest, result.score),
    isBest: !wasDaily && result.score > priorBest,
    ranked,
    dailyBest,
  };
  screen = "over";
  render();
}

function goMenu(): void {
  clearTimers();
  cleanupDrag();
  state = null;
  selected = null;
  hover = null;
  resultView = null;
  animBoard = null;
  clearingCells = [];
  placedCells = [];
  animating = false;
  statusMessage = "";
  screen = "menu";
  render();
}

function restart(): void {
  if (!state) return;
  startRun(state.mode);
}

function togglePiece(index: number): void {
  if (!state || screen !== "play" || state.status !== "playing") return;
  if (!state.pieces[index]) return;
  selected = selected === index ? null : index;
  ctx?.audio.select();
  ctx?.haptics.select();
  if (selected !== null) {
    const shape = state.pieces[selected]!;
    setStatus(`${shape.label} selected. Tap a cell to place it.`);
  } else {
    setStatus("Selection cleared.");
  }
  refreshPlay();
}

function cellCoord(index: number): { row: number; col: number } | null {
  if (!state || index < 0 || index >= state.size * state.size) return null;
  return { row: Math.floor(index / state.size), col: index % state.size };
}

function cleanupDrag(): void {
  if (dragging?.ghost?.parentElement) dragging.ghost.parentElement.removeChild(dragging.ghost);
  dragging = null;
}

function startGhost(drag: DragState): void {
  const shape = state?.pieces[drag.piece];
  if (!shape) return;
  const ghost = document.createElement("div");
  ghost.className = `neon-ghost p${shape.color}`;
  ghost.innerHTML = pieceShapeHtml(shape);
  ghost.style.pointerEvents = "none";
  document.body.appendChild(ghost);
  drag.ghost = ghost;
}

function moveGhost(drag: DragState, x: number, y: number): void {
  if (!drag.ghost) return;
  drag.ghost.style.left = `${x}px`;
  drag.ghost.style.top = `${y}px`;
}

function onPointerDown(e: PointerEvent): void {
  if (!state || screen !== "play" || animating || state.status !== "playing") return;
  const slot = (e.target as HTMLElement).closest<HTMLElement>("[data-piece]");
  if (!slot) return;
  const pieceIndex = Number(slot.dataset.piece);
  const shape = state.pieces[pieceIndex];
  if (!shape) return;
  suppressClick = false;
  let grabR = 0;
  let grabC = 0;
  const shapeEl = slot.querySelector<HTMLElement>(".neon-shape");
  if (shapeEl) {
    const rect = shapeEl.getBoundingClientRect();
    const w = shapeWidth(shape);
    const h = shapeHeight(shape);
    grabC = Math.min(w - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * w)));
    grabR = Math.min(h - 1, Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * h)));
  }
  dragging = {
    pointerId: e.pointerId,
    piece: pieceIndex,
    startX: e.clientX,
    startY: e.clientY,
    active: false,
    ghost: null,
    grabR,
    grabC,
    anchorRow: null,
    anchorCol: null,
  };
  keyboardMode = false;
  try {
    slot.setPointerCapture(e.pointerId);
  } catch {
    /* pointer capture is best effort */
  }
}

function updateDragTarget(e: PointerEvent): void {
  if (!state || !dragging) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const cell = el?.closest<HTMLElement>("[data-cell]");
  if (!cell) {
    dragging.anchorRow = null;
    dragging.anchorCol = null;
    return;
  }
  const coord = cellCoord(Number(cell.dataset.cell));
  if (!coord) return;
  dragging.anchorRow = coord.row - dragging.grabR;
  dragging.anchorCol = coord.col - dragging.grabC;
}

function onPointerMove(e: PointerEvent): void {
  if (dragging && e.pointerId === dragging.pointerId) {
    if (!dragging.active) {
      if (Math.hypot(e.clientX - dragging.startX, e.clientY - dragging.startY) < 8) return;
      dragging.active = true;
      selected = dragging.piece;
      startGhost(dragging);
    }
    moveGhost(dragging, e.clientX, e.clientY);
    updateDragTarget(e);
    refreshPlay({ tray: false, hud: false });
    return;
  }
  if (screen !== "play" || !state || selected === null || animating || e.pointerType === "touch") return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const cell = el?.closest<HTMLElement>("[data-cell]");
  const next = cell ? Number(cell.dataset.cell) : null;
  if (next !== hover) {
    hover = next;
    refreshPlay({ tray: false, hud: false });
  }
}

function onPointerLeave(): void {
  if (hover === null) return;
  hover = null;
  if (screen === "play" && state) refreshPlay({ tray: false, hud: false });
}

function onPointerUp(e: PointerEvent): void {
  if (!dragging || e.pointerId !== dragging.pointerId) return;
  const drag = dragging;
  const wasActive = drag.active;
  const piece = drag.piece;
  const row = drag.anchorRow;
  const col = drag.anchorCol;
  cleanupDrag();
  if (wasActive) {
    suppressClick = true;
    schedule(() => {
      suppressClick = false;
    }, 400);
    if (row !== null && col !== null) tryPlace(piece, row, col);
    else refreshPlay();
  }
}

function onPointerCancel(e: PointerEvent): void {
  if (!dragging || e.pointerId !== dragging.pointerId) return;
  cleanupDrag();
  refreshPlay();
}

function onClick(e: MouseEvent): void {
  if (!ctx) return;
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  const target = (e.target as HTMLElement).closest<HTMLElement>("[data-act],[data-piece],[data-cell]");
  if (!target) return;

  const act = target.dataset.act;
  if (act) {
    if (act === "arcade") {
      ctx.audio.tap();
      ctx.exit();
    } else if (act === "help") {
      ctx.audio.tap();
      helpFrom = screen;
      screen = "help";
      render();
    } else if (act === "close-help") {
      ctx.audio.tap();
      if (helpFrom === "play" || helpFrom === "over") {
        screen = state && state.status === "over" ? "over" : "play";
        render();
      } else {
        screen = "menu";
        render();
      }
    } else if (act === "endless") {
      ctx.audio.tap();
      startRun("endless");
    } else if (act === "daily" || act === "daily-again") {
      ctx.audio.tap();
      startRun("daily");
    } else if (act === "restart") {
      ctx.audio.tap();
      restart();
    } else if (act === "menu") {
      ctx.audio.tap();
      goMenu();
    }
    return;
  }

  const pieceAttr = target.dataset.piece;
  if (pieceAttr !== undefined) {
    if (screen === "play") togglePiece(Number(pieceAttr));
    return;
  }

  const cellAttr = target.dataset.cell;
  if (cellAttr !== undefined && screen === "play") {
    if (animating || !state || state.status !== "playing") return;
    if (selected === null) {
      setStatus("Select a piece first.");
      ctx.audio.invalid();
      return;
    }
    const coord = cellCoord(Number(cellAttr));
    if (!coord) return;
    tryPlace(selected, coord.row, coord.col);
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (screen === "help") {
    if (e.key === "Escape") {
      screen = helpFrom;
      render();
    }
    return;
  }
  if (screen !== "play" || !state) return;
  const isBoard = keyboardMode || document.activeElement?.classList.contains("neon-board") === true;
  if (e.key === "1" || e.key === "2" || e.key === "3") {
    togglePiece(Number(e.key) - 1);
    return;
  }
  if (e.key === "Escape") {
    selected = null;
    refreshPlay();
    return;
  }
  if (!isBoard) return;
  const row = Math.floor(cursor / state.size);
  const col = cursor % state.size;
  if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault();
    let r = row;
    let c = col;
    if (e.key === "ArrowUp") r = Math.max(0, row - 1);
    if (e.key === "ArrowDown") r = Math.min(state.size - 1, row + 1);
    if (e.key === "ArrowLeft") c = Math.max(0, col - 1);
    if (e.key === "ArrowRight") c = Math.min(state.size - 1, col + 1);
    cursor = idx(state.size, r, c);
    keyboardMode = true;
    refreshPlay();
    return;
  }
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    keyboardMode = true;
    if (selected === null) {
      const first = state.pieces.findIndex((p) => p !== null);
      if (first >= 0) togglePiece(first);
      return;
    }
    tryPlace(selected, row, col);
  }
}

function handleBack(): boolean {
  if (screen === "help") {
    screen = helpFrom;
    render();
    return true;
  }
  if (screen === "play" || screen === "over") {
    goMenu();
    return true;
  }
  return false;
}

export function mountBlocks(root: HTMLElement, context: GameContext<BlocksSave>): void {
  app = root;
  ctx = context;
  date = localYmd();
  context.audio.setMuted(context.settings.muted());
  state = null;
  selected = null;
  hover = null;
  cursor = 0;
  keyboardMode = false;
  animBoard = null;
  clearingCells = [];
  placedCells = [];
  animating = false;
  dragging = null;
  resultView = null;
  statusMessage = "";
  screen = "menu";
  helpFrom = "menu";
  endlessSeed = 0;
  aborter = new AbortController();
  const { signal } = aborter;
  app.addEventListener("click", onClick, { signal });
  app.addEventListener("pointerdown", onPointerDown, { signal });
  app.addEventListener("pointermove", onPointerMove, { signal });
  app.addEventListener("pointerup", onPointerUp, { signal });
  app.addEventListener("pointerleave", onPointerLeave, { signal });
  app.addEventListener("pointercancel", onPointerCancel, { signal });
  window.addEventListener("keydown", onKeyDown, { signal });
  setBackHandler(handleBack);
  render();
}

export function unmountBlocks(): void {
  aborter?.abort();
  aborter = null;
  clearTimers();
  cleanupDrag();
  setBackHandler(null);
  state = null;
  selected = null;
  hover = null;
  resultView = null;
  animating = false;
  keyboardMode = false;
  app.innerHTML = "";
}
