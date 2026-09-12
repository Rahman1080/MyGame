import type { Cell, Direction, Puzzle, SimStep } from "../engine/types";
import { getCell } from "../engine/grid";
import { PALETTE, colorHex, withAlpha } from "./colors";

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
  rotating?: { row: number; col: number; t: number } | null;
  winFlash: number;
  failDim: number;
  ghost?: { row: number; col: number } | null;
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

function drawShaft(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: Direction,
  len: number,
  color: string,
  width: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((dir * Math.PI) / 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
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
    const glow = lit || state.winFlash > 0 ? 1 : 0.72;

    if (cell.type === "empty") continue;

    if (cell.type === "exit") {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      const pulse = state.reduced ? 1 : 1 + Math.sin(state.now / 420) * 0.04 + state.winFlash * 0.25;
      const s = view.cell * 0.28 * pulse;
      ctx.shadowColor = PALETTE.magenta;
      ctx.shadowBlur = 16 + state.winFlash * 20;
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, s);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.45, PALETTE.magenta);
      g.addColorStop(1, withAlpha(PALETTE.bg, 0.2));
      ctx.fillStyle = g;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.restore();
      ctx.fillStyle = PALETTE.magenta;
      ctx.font = `${Math.max(8, Math.floor(view.cell * 0.14))}px Outfit, sans-serif`;
      ctx.textAlign = "right";
      ctx.fillText("OUT", x + view.cell * 0.42, y + view.cell * 0.42);
      continue;
    }

    if (cell.direction !== undefined) {
      let extra = 0;
      if (state.rotating && state.rotating.row === cell.row && state.rotating.col === cell.col) {
        extra = state.rotating.t * (Math.PI / 2);
      }
      ctx.save();
      if (extra) {
        ctx.translate(x, y);
        ctx.rotate(extra);
        ctx.translate(-x, -y);
      }
      const len = view.cell * 0.34;
      drawShaft(ctx, x, y, cell.direction, len, withAlpha(hex, glow), lit ? 5.2 : 4);
      ctx.restore();
    }

    if (cell.type === "start") {
      const pulse = state.reduced ? 1 : 1 + Math.sin(state.now / 380) * 0.06;
      const r = view.cell * 0.16 * pulse;
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
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = hex;
      ctx.lineWidth = 2;
      ctx.shadowColor = hex;
      ctx.shadowBlur = 8;
      const s = view.cell * 0.14;
      ctx.strokeRect(-s, -s, s * 2, s * 2);
      ctx.restore();
    } else if (cell.locked) {
      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.arc(x + view.cell * 0.28, y - view.cell * 0.28, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
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
