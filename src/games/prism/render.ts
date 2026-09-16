import type { PrismState, Tube } from "./logic";

export const PRISM_PALETTE: readonly string[] = [
  "#29DDF4",
  "#E45CFF",
  "#9CFF4F",
  "#FFC857",
  "#FF6B9D",
  "#5B8CFF",
  "#4DE1C1",
  "#FF9F45",
];

const PALETTE_DARK: readonly string[] = [
  "#0b6f7f",
  "#7a1f8a",
  "#4a7a1f",
  "#8a6a1f",
  "#8a2f52",
  "#263f8a",
  "#1f6a5a",
  "#8a4f1f",
];

export function prismColor(color: number): string {
  return PRISM_PALETTE[((color % PRISM_PALETTE.length) + PRISM_PALETTE.length) % PRISM_PALETTE.length] ?? "#29DDF4";
}

function prismDark(color: number): string {
  return PALETTE_DARK[((color % PALETTE_DARK.length) + PALETTE_DARK.length) % PALETTE_DARK.length] ?? "#0b6f7f";
}

export interface TubeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PrismLayout {
  logicalW: number;
  logicalH: number;
  cols: number;
  rows: number;
  tubeW: number;
  tubeH: number;
  unitH: number;
  rim: number;
  bottomPad: number;
  rects: TubeRect[];
}

const UNIT = 32;
const RIM = 12;
const BOTTOM_PAD = 7;
const GAP_X = 14;
const GAP_Y = 22;
const PAD_X = 16;
const PAD_Y = 16;

export function prismLayout(count: number, capacity: number): PrismLayout {
  const n = Math.max(1, Math.floor(count));
  const cap = Math.max(2, Math.floor(capacity));
  const cols = n <= 4 ? n : Math.ceil(n / 2);
  const rows = Math.ceil(n / cols);
  const tubeW = UNIT + 8;
  const tubeH = cap * UNIT + RIM + BOTTOM_PAD;
  const logicalW = PAD_X * 2 + cols * tubeW + (cols - 1) * GAP_X;
  const logicalH = PAD_Y * 2 + rows * tubeH + (rows - 1) * GAP_Y;
  const rects: TubeRect[] = [];
  for (let i = 0; i < n; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    rects.push({
      x: PAD_X + col * (tubeW + GAP_X),
      y: PAD_Y + row * (tubeH + GAP_Y),
      w: tubeW,
      h: tubeH,
    });
  }
  return { logicalW, logicalH, cols, rows, tubeW, tubeH, unitH: UNIT, rim: RIM, bottomPad: BOTTOM_PAD, rects };
}

export interface PrismView {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr: number;
  cssW: number;
  cssH: number;
  scale: number;
  layout: PrismLayout;
}

export function attachPrism(canvas: HTMLCanvasElement, layout: PrismLayout, cssW: number): PrismView {
  const cssH = Math.round((cssW * layout.logicalH) / layout.logicalW);
  const dpr = Math.max(1, Math.min(3, globalThis.devicePixelRatio ?? 1));
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  return { canvas, ctx, dpr, cssW, cssH, scale: cssW / layout.logicalW, layout };
}

export function unitFromClient(view: PrismView, clientX: number, clientY: number): { x: number; y: number } {
  const rect = view.canvas.getBoundingClientRect();
  const scale = view.scale || 1;
  return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
}

export function tubeFromPoint(layout: PrismLayout, x: number, y: number): number {
  const padX = Math.max(0, Math.floor(GAP_X / 2) - 1);
  const padY = 8;
  for (let i = 0; i < layout.rects.length; i += 1) {
    const r = layout.rects[i]!;
    if (x >= r.x - padX && x <= r.x + r.w + padX && y >= r.y - padY && y <= r.y + r.h + padY) return i;
  }
  return -1;
}

export function unitCenter(rect: TubeRect, layout: PrismLayout, stackIndex: number): { x: number; y: number } {
  const x = rect.x + rect.w / 2;
  const y = rect.y + rect.h - layout.bottomPad - layout.unitH * (stackIndex + 0.5);
  return { x, y };
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: number;
}

export interface Flash {
  x: number;
  y: number;
  life: number;
  max: number;
  color: number;
}

export interface PourAnim {
  from: number;
  to: number;
  count: number;
  color: number;
  t: number;
  duration: number;
}

export interface PrismFx {
  particles: Particle[];
  flashes: Flash[];
  shake: number;
  pour: PourAnim | null;
  winT: number;
}

export function emptyFx(): PrismFx {
  return { particles: [], flashes: [], shake: 0, pour: null, winT: 0 };
}

export interface PrismDrawOpts {
  selected: number | null;
  legalTargets: number[];
  hintSource: number | null;
  hintTarget: number | null;
  invalid: number | null;
  fx: PrismFx;
  reduced: boolean;
  now: number;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const anyCtx = ctx as CanvasRenderingContext2D & {
    roundRect?: (x: number, y: number, w: number, h: number, r: number) => void;
  };
  if (typeof anyCtx.roundRect === "function") {
    anyCtx.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawSymbol(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: number): void {
  const scale = r * 0.52;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineWidth = Math.max(1.4, r * 0.12);
  ctx.strokeStyle = prismDark(color);
  ctx.fillStyle = prismDark(color);
  const shape = color % 8;
  ctx.beginPath();
  if (shape === 0) {
    ctx.arc(0, 0, scale, 0, Math.PI * 2);
  } else if (shape === 1) {
    ctx.moveTo(0, -scale);
    ctx.lineTo(scale * 0.9, scale * 0.7);
    ctx.lineTo(-scale * 0.9, scale * 0.7);
    ctx.closePath();
  } else if (shape === 2) {
    ctx.rect(-scale * 0.8, -scale * 0.8, scale * 1.6, scale * 1.6);
  } else if (shape === 3) {
    ctx.moveTo(0, -scale);
    ctx.lineTo(scale, 0);
    ctx.lineTo(0, scale);
    ctx.lineTo(-scale, 0);
    ctx.closePath();
  } else if (shape === 4) {
    ctx.moveTo(0, -scale);
    ctx.lineTo(0, scale);
    ctx.moveTo(-scale, 0);
    ctx.lineTo(scale, 0);
  } else if (shape === 5) {
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * scale;
      const py = Math.sin(a) * scale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (shape === 6) {
    ctx.arc(0, 0, scale, 0, Math.PI * 2);
    ctx.moveTo(scale * 0.9, 0);
    ctx.arc(0, 0, scale * 0.5, 0, Math.PI * 2);
  } else {
    ctx.moveTo(-scale, -scale);
    ctx.lineTo(scale, scale);
    ctx.moveTo(scale, -scale);
    ctx.lineTo(-scale, scale);
  }
  ctx.stroke();
  ctx.restore();
}

function drawUnit(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: number,
  glow: boolean,
): void {
  const fill = prismColor(color);
  if (glow) {
    ctx.shadowColor = fill;
    ctx.shadowBlur = r * 0.8;
  }
  const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  grad.addColorStop(0, "rgba(255,255,255,0.85)");
  grad.addColorStop(0.45, fill);
  grad.addColorStop(1, prismDark(color));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1.2, r * 0.09);
  ctx.strokeStyle = "rgba(3,6,12,0.75)";
  ctx.stroke();
  drawSymbol(ctx, cx, cy, r, color);
}

function drawTube(
  ctx: CanvasRenderingContext2D,
  rect: TubeRect,
  layout: PrismLayout,
  tube: Tube,
  opts: PrismDrawOpts,
  index: number,
): void {
  const lift = opts.selected === index ? -layout.unitH * 0.22 : 0;
  const r = rect.w / 2;
  ctx.save();
  ctx.translate(0, lift);

  ctx.beginPath();
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, r);
  ctx.fillStyle = "rgba(9,14,24,0.72)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = opts.selected === index ? "#FFFFFF" : "rgba(41,221,244,0.35)";
  ctx.stroke();

  const isTarget = opts.legalTargets.includes(index);
  if (isTarget) {
    ctx.beginPath();
    roundRect(ctx, rect.x - 3, rect.y - 3, rect.w + 6, rect.h + 6, r + 3);
    ctx.setLineDash([7, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(41,221,244,0.75)";
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (opts.invalid === index) {
    ctx.beginPath();
    roundRect(ctx, rect.x - 3, rect.y - 3, rect.w + 6, rect.h + 6, r + 3);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,107,157,0.95)";
    ctx.stroke();
  }
  if (opts.hintSource === index) {
    ctx.beginPath();
    roundRect(ctx, rect.x - 3, rect.y - 3, rect.w + 6, rect.h + 6, r + 3);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,200,87,0.7)";
    ctx.stroke();
  }
  if (opts.hintTarget === index) {
    ctx.beginPath();
    roundRect(ctx, rect.x - 3, rect.y - 3, rect.w + 6, rect.h + 6, r + 3);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,200,87,0.95)";
    ctx.stroke();
  }

  let visible = tube.length;
  if (opts.fx.pour && opts.fx.pour.to === index) visible = Math.max(0, tube.length - opts.fx.pour.count);
  const unitR = layout.unitH * 0.42;
  for (let k = 0; k < visible; k += 1) {
    const center = unitCenter(rect, layout, k);
    drawUnit(ctx, center.x, center.y, unitR, tube[k]!, !opts.reduced);
  }
  ctx.restore();
}

export function drawPrism(view: PrismView, state: PrismState, opts: PrismDrawOpts): void {
  const { ctx, layout } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, view.canvas.width, view.canvas.height);
  const k = view.dpr * view.scale;
  const shake = opts.reduced ? 0 : opts.fx.shake;
  const sx = shake === 0 ? 0 : Math.sin(opts.now / 19) * shake * 6;
  const sy = shake === 0 ? 0 : Math.cos(opts.now / 15) * shake * 4;
  ctx.setTransform(k, 0, 0, k, sx * k, sy * k);

  for (let i = 0; i < state.tubes.length; i += 1) {
    const rect = layout.rects[i];
    if (!rect) continue;
    drawTube(ctx, rect, layout, state.tubes[i]!, opts, i);
  }

  if (opts.fx.pour) {
    const anim = opts.fx.pour;
    const src = layout.rects[anim.from];
    const dst = layout.rects[anim.to];
    if (src && dst) {
      const u = Math.max(0, Math.min(1, anim.t / anim.duration));
      const start = { x: src.x + src.w / 2, y: src.y - 6 };
      const ctrl = { x: (start.x + dst.x + dst.w / 2) / 2, y: Math.min(start.y, dst.y) - 54 };
      const destLen = state.tubes[anim.to]!.length;
      const unitR = layout.unitH * 0.42;
      for (let j = 0; j < anim.count; j += 1) {
        const stackIndex = destLen - anim.count + j;
        const end = unitCenter(dst, layout, stackIndex);
        const e = Math.max(0, Math.min(1, u * 1.15 - j * 0.05));
        const a = { x: (1 - e) * (1 - e) * start.x + 2 * (1 - e) * e * ctrl.x + e * e * end.x };
        const b = { y: (1 - e) * (1 - e) * start.y + 2 * (1 - e) * e * ctrl.y + e * e * end.y };
        drawUnit(ctx, a.x, b.y, unitR * (0.85 + 0.15 * e), anim.color, !opts.reduced);
      }
    }
  }

  for (const flash of opts.fx.flashes) {
    const p = Math.max(0, flash.life / flash.max);
    ctx.globalAlpha = p * 0.7;
    ctx.strokeStyle = prismColor(flash.color);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(flash.x, flash.y, (1 - p) * 42 + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const particle of opts.fx.particles) {
    const p = Math.max(0, particle.life / particle.max);
    ctx.globalAlpha = p;
    ctx.fillStyle = prismColor(particle.color);
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 2 + p * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (opts.fx.winT > 0 && !opts.reduced) {
    const p = Math.min(1, opts.fx.winT / 900);
    ctx.globalAlpha = (1 - p) * 0.5;
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;
    ctx.beginPath();
    roundRect(ctx, 0, 0, layout.logicalW, layout.logicalH, 18);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
