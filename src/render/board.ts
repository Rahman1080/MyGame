import type { Cell, Direction, Puzzle, SimStep } from "../engine/types";
import { getCell } from "../engine/grid";
import { PALETTE, colorHex, withAlpha } from "./colors";
import { rotationAngle } from "./rotationAnim";

export interface BoardView {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  size: number;
  cell: number;
  originX: number;
  originY: number;
}

export interface DrawState {
  puzzle: Puzzle;
  cells: Cell[];
  token?: { x: number; y: number; color: string } | null;
  lit: Set<string>;
  rotating?: {
    row: number;
    col: number;
    t: number;
    fromDirection: Direction;
    toDirection: Direction;
  } | null;
  winFlash: number;
  failDim: number;
  ghost?: { row: number; col: number } | null;
  hint?: { row: number; col: number } | null;
  selected?: { row: number; col: number } | null;
  /** Read-only winning route, drawn as a glowing trail. */
  route?: SimStep[] | null;
  /** Sweep progress for the route, 0..1. Defaults to fully drawn. */
  routeProgress?: number;
  reduced: boolean;
  now: number;
}

export function attachBoard(canvas: HTMLCanvasElement, cssSize: number): BoardView {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  canvas.style.width = `${cssSize}px`;
  canvas.style.height = `${cssSize}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { canvas, ctx, size: 0, cell: 0, originX: 0, originY: 0 };
}

export function layoutBoard(view: BoardView, grid: number, cssSize: number): void {
  view.size = grid;
  const pad = 10;
  view.cell = (cssSize - pad * 2) / grid;
  view.originX = pad;
  view.originY = pad;
}

export function hitCell(view: BoardView, clientX: number, clientY: number): { row: number; col: number } | null {
  const rect = view.canvas.getBoundingClientRect();
  const x = clientX - rect.left - view.originX;
  const y = clientY - rect.top - view.originY;
  const col = Math.floor(x / view.cell);
  const row = Math.floor(y / view.cell);
  if (row < 0 || col < 0 || row >= view.size || col >= view.size) return null;
  return { row, col };
}

function center(view: BoardView, row: number, col: number): { x: number; y: number } {
  return {
    x: view.originX + (col + 0.5) * view.cell,
    y: view.originY + (row + 0.5) * view.cell,
  };
}

function drawShaftAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  len: number,
  color: string,
  width: number,
  glow = true,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
  }
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -len);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-width * 0.9, -len + width);
  ctx.lineTo(0, -len - width * 0.4);
  ctx.lineTo(width * 0.9, -len + width);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawShaft(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: Direction,
  len: number,
  color: string,
  width: number,
  glow = true,
): void {
  drawShaftAt(ctx, x, y, (dir * Math.PI) / 2, len, color, width, glow);
}

function drawCellRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  color: string,
  alpha: number,
  width: number,
): void {
  const gap = Math.max(2, cell * 0.06);
  const radius = Math.max(6, cell * 0.14);
  const s = cell - gap;
  const left = x - cell / 2 + gap / 2;
  const top = y - cell / 2 + gap / 2;
  ctx.save();
  ctx.strokeStyle = withAlpha(color, alpha);
  ctx.lineWidth = width;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(left, top, s, s, radius);
  else ctx.rect(left, top, s, s);
  ctx.stroke();
  ctx.restore();
}

function drawLock(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number): void {
  const s = cell * 0.12;
  const bx = x + cell * 0.24;
  const by = y - cell * 0.24;
  ctx.save();
  ctx.strokeStyle = "rgba(232,244,255,0.55)";
  ctx.fillStyle = "rgba(232,244,255,0.18)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(bx, by - s * 0.2, s * 0.55, Math.PI, 0);
  ctx.stroke();
  if (typeof ctx.roundRect === "function") ctx.roundRect(bx - s, by - s * 0.2, s * 2, s * 1.5, 1.5);
  else ctx.rect(bx - s, by - s * 0.2, s * 2, s * 1.5);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawGate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  hex: string,
  lit: boolean,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  const s = cell * 0.2;
  ctx.shadowColor = hex;
  ctx.shadowBlur = lit ? 14 : 8;
  ctx.fillStyle = withAlpha(hex, lit ? 0.32 : 0.18);
  ctx.strokeStyle = hex;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.rect(-s, -s, s * 2, s * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = withAlpha("#ffffff", 0.5);
  ctx.strokeRect(-s * 0.5, -s * 0.5, s, s);
  ctx.restore();
}

/** Ring colour index for a portal id. Pure and stable, so it is testable. */
export function portalRingColorIndex(portalId: string | undefined): number {
  if (!portalId) return 0;
  let hash = 0;
  for (let i = 0; i < portalId.length; i += 1) {
    hash = (Math.imul(hash, 31) + portalId.charCodeAt(i)) >>> 0;
  }
  return hash % 4;
}

const PORTAL_RING_HEX = [PALETTE.cyan, PALETTE.magenta, PALETTE.amber, PALETTE.lime];

export function portalRingHex(portalId: string | undefined): string {
  return PORTAL_RING_HEX[portalRingColorIndex(portalId)] ?? PALETTE.cyan;
}

/** Chevron direction for a wall, defaulting to RIGHT when unset. */
export function wallChevronDir(wallDir: Direction | undefined): Direction {
  return wallDir ?? 1;
}

function drawPortal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  portalId: string | undefined,
  side: "a" | "b",
  lit: boolean,
): void {
  const hex = portalRingHex(portalId);
  const r = cell * 0.3;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = hex;
  ctx.shadowBlur = lit ? 16 : 10;
  ctx.strokeStyle = hex;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = withAlpha(hex, 0.45);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = withAlpha(hex, 0.18);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hex;
  ctx.font = `600 ${Math.max(9, Math.floor(cell * 0.26))}px Outfit, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(side === "a" ? "A" : "B", 0, 1);
  ctx.restore();
}

function drawWall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  dir: Direction,
): void {
  const hex = "#9FB3C8";
  const half = cell * 0.32;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((dir * Math.PI) / 2);
  ctx.strokeStyle = withAlpha(hex, 0.85);
  ctx.lineWidth = Math.max(3, cell * 0.09);
  ctx.lineCap = "round";
  ctx.shadowColor = hex;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(-half, 0);
  ctx.lineTo(half, 0);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(-half * 0.45, half * 0.28);
  ctx.lineTo(0, -half * 0.22);
  ctx.lineTo(half * 0.45, half * 0.28);
  ctx.stroke();
  ctx.restore();
}

function drawGrid(view: BoardView): void {
  const { ctx } = view;
  const gap = Math.max(2, view.cell * 0.06);
  const radius = Math.max(6, view.cell * 0.14);
  for (let row = 0; row < view.size; row += 1) {
    for (let col = 0; col < view.size; col += 1) {
      const x = view.originX + col * view.cell + gap / 2;
      const y = view.originY + row * view.cell + gap / 2;
      const s = view.cell - gap;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, s, s, radius);
      else ctx.rect(x, y, s, s);
      ctx.fillStyle = "#0A0C14";
      ctx.fill();
      ctx.strokeStyle = "rgba(232,244,255,0.07)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function drawRoute(
  view: BoardView,
  route: SimStep[],
  progress: number,
): void {
  if (route.length < 2) return;
  const { ctx } = view;
  const edges = route.length - 1;
  const limit = Math.max(0, Math.min(1, progress)) * edges;
  const first = center(view, route[0]!.row, route[0]!.col);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = PALETTE.cyan;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = withAlpha(PALETTE.cyan, 0.9);
  ctx.lineWidth = Math.max(3, view.cell * 0.11);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 0; i < edges; i += 1) {
    const t = Math.max(0, Math.min(1, limit - i));
    if (t <= 0) break;
    const a = route[i]!;
    const b = route[i + 1]!;
    const ca = center(view, a.row, a.col);
    const cb = center(view, b.row, b.col);
    const adjacent = Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
    if (!adjacent) {
      ctx.moveTo(ca.x, ca.y);
      ctx.lineTo(cb.x, cb.y);
    } else if (t < 1) {
      ctx.lineTo(ca.x + (cb.x - ca.x) * t, ca.y + (cb.y - ca.y) * t);
      break;
    } else {
      ctx.lineTo(cb.x, cb.y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

export function drawBoard(view: BoardView, state: DrawState): void {
  const { ctx } = view;
  const w = view.canvas.clientWidth;
  const h = view.canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  drawGrid(view);

  if (state.failDim > 0) {
    ctx.fillStyle = `rgba(7,8,13,${0.18 * state.failDim})`;
    ctx.fillRect(0, 0, w, h);
  }

  for (const cell of state.cells) {
    const { x, y } = center(view, cell.row, cell.col);
    const lit = state.lit.has(`${cell.row},${cell.col}`);
    const hex = colorHex(cell.color);
    const required = cell.required === true;
    const pulse = lit || state.winFlash > 0 ? 1 : 0.72;

    if (cell.type === "empty") continue;

    if (cell.type === "exit") {
      const exitHex = cell.color ? colorHex(cell.color) : PALETTE.magenta;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      const p = state.reduced ? 1 : 1 + Math.sin(state.now / 420) * 0.04 + state.winFlash * 0.25;
      const s = view.cell * 0.28 * p;
      ctx.shadowColor = exitHex;
      ctx.shadowBlur = 16 + state.winFlash * 20;
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, s);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.45, exitHex);
      g.addColorStop(1, withAlpha(PALETTE.bg, 0.2));
      ctx.fillStyle = g;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.restore();
      drawCellRing(ctx, x, y, view.cell, exitHex, 0.55, 1.6);
      ctx.fillStyle = exitHex;
      ctx.font = `${Math.max(8, Math.floor(view.cell * 0.14))}px Outfit, sans-serif`;
      ctx.textAlign = "right";
      ctx.fillText("OUT", x + view.cell * 0.42, y + view.cell * 0.42);
      continue;
    }

    if (cell.type === "portal") {
      drawPortal(ctx, x, y, view.cell, cell.portalId, cell.portalSide === "b" ? "b" : "a", lit);
      continue;
    }

    if (cell.type === "wall") {
      drawWall(ctx, x, y, view.cell, wallChevronDir(cell.wallDir));
      continue;
    }

    if (required) {
      drawCellRing(ctx, x, y, view.cell, hex, lit ? 0.4 : 0.22, 1.4);
    }

    if (cell.direction !== undefined) {
      const len = view.cell * 0.34;
      const alpha = required ? pulse : 0.3;
      const width = required ? (lit ? 5.2 : 4) : 2.4;
      const doGlow = required;
      const rot = state.rotating;
      if (rot && rot.row === cell.row && rot.col === cell.col) {
        // Animate OLD -> NEW. `cell.direction` is already the new direction, so
        // we render from the stored `fromDirection` toward `toDirection`.
        const angle = rotationAngle(rot.fromDirection, rot.toDirection, rot.t);
        drawShaftAt(ctx, x, y, angle, len, withAlpha(hex, alpha), width, doGlow);
      } else {
        drawShaft(ctx, x, y, cell.direction, len, withAlpha(hex, alpha), width, doGlow);
      }
    }

    if (cell.type === "start") {
      const p = state.reduced ? 1 : 1 + Math.sin(state.now / 380) * 0.06;
      const r = view.cell * 0.16 * p;
      ctx.shadowColor = PALETTE.cyan;
      ctx.shadowBlur = 14;
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.45, PALETTE.cyan);
      g.addColorStop(1, withAlpha(PALETTE.cyan, 0.1));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = PALETTE.cyan;
      ctx.font = `${Math.max(8, Math.floor(view.cell * 0.14))}px Outfit, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText("IN", x - view.cell * 0.42, y - view.cell * 0.32);
    } else if (cell.type === "gate") {
      drawGate(ctx, x, y, view.cell, hex, lit);
    }

    if (cell.locked) {
      ctx.save();
      ctx.strokeStyle = "rgba(148,163,184,0.22)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - view.cell * 0.3, y + view.cell * 0.3);
      ctx.lineTo(x + view.cell * 0.3, y - view.cell * 0.3);
      ctx.stroke();
      ctx.restore();
      drawLock(ctx, x, y, view.cell);
    }
  }

  if (state.route && state.route.length > 1) {
    drawRoute(view, state.route, state.routeProgress ?? 1);
  }

  if (state.ghost) {
    const { x, y } = center(view, state.ghost.row, state.ghost.col);
    const t = state.reduced ? 0.6 : 0.4 + Math.sin(state.now / 220) * 0.3;
    ctx.strokeStyle = `rgba(255,255,255,${t})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, view.cell * 0.28, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (state.selected && !(state.hint && state.hint.row === state.selected.row && state.hint.col === state.selected.col)) {
    const { x, y } = center(view, state.selected.row, state.selected.col);
    ctx.save();
    ctx.strokeStyle = "rgba(41,221,244,0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, view.cell * 0.38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (state.hint) {
    const { x, y } = center(view, state.hint.row, state.hint.col);
    const t = state.reduced ? 0.7 : 0.45 + Math.sin(state.now / 200) * 0.35;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${t})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, view.cell * 0.34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(41,221,244,${t})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, view.cell * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (state.token) {
    ctx.shadowColor = state.token.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = state.token.color;
    ctx.beginPath();
    ctx.arc(state.token.x, state.token.y, view.cell * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

export function cellCenter(view: BoardView, row: number, col: number): { x: number; y: number } {
  return center(view, row, col);
}

export function tokenFromStep(view: BoardView, step: SimStep): { x: number; y: number; color: string } {
  const c = cellCenter(view, step.row, step.col);
  return { ...c, color: colorHex(step.color) };
}

export function startToken(view: BoardView, puzzle: Puzzle, cells: Cell[]): { x: number; y: number; color: string } {
  const cell = getCell(cells, puzzle.start.row, puzzle.start.col);
  return {
    ...cellCenter(view, puzzle.start.row, puzzle.start.col),
    color: colorHex(cell?.color),
  };
}
