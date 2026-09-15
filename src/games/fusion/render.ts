import {
  BIN_HEIGHT,
  BIN_WIDTH,
  COL_WIDTH,
  COLS,
  OVERFLOW_Y,
  orbRadius,
  type FusionState,
} from "./logic";

export const TIER_COLORS: readonly string[] = [
  "#29DDF4",
  "#E45CFF",
  "#9CFF4F",
  "#FFC857",
  "#FF6B9D",
  "#5B8CFF",
  "#4DE1C1",
  "#FF9F45",
  "#C77DFF",
  "#7CFFB2",
];

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  tier: number;
}

export interface Flash {
  x: number;
  y: number;
  life: number;
  max: number;
  tier: number;
}

export interface FusionFx {
  particles: Particle[];
  flashes: Flash[];
  shake: number;
}

export interface FusionView {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr: number;
  cssW: number;
  cssH: number;
  scale: number;
}

export interface DrawOpts {
  now: number;
  reduced: boolean;
  aimCol: number | null;
  fx: FusionFx;
  dimmed: boolean;
}

export function tierColor(tier: number): string {
  return TIER_COLORS[Math.max(0, Math.min(TIER_COLORS.length - 1, Math.floor(tier)))] ?? "#29DDF4";
}

export function attachFusion(canvas: HTMLCanvasElement, cssW: number): FusionView {
  const cssH = Math.round((cssW * BIN_HEIGHT) / BIN_WIDTH);
  const dpr = Math.max(1, Math.min(3, globalThis.devicePixelRatio ?? 1));
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  return { canvas, ctx, dpr, cssW, cssH, scale: cssW / BIN_WIDTH };
}

export function unitFromClient(view: FusionView, clientX: number, clientY: number): { x: number; y: number } {
  const rect = view.canvas.getBoundingClientRect();
  const scale = view.scale || 1;
  return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
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

function polygon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sides: number, rot = 0): void {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = rot + (i / sides) * Math.PI * 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  tier: number,
  glow = true,
): void {
  const color = tierColor(tier);
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = r * 0.9;
  }
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.12, x, y, r);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.32, color);
  grad.addColorStop(1, "rgba(7,8,13,0.92)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1.4, r * 0.1);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.globalAlpha = 1;

  polygon(ctx, x, y, r * 0.52, 3 + Math.max(0, Math.min(9, tier)), -Math.PI / 2);
  ctx.lineWidth = Math.max(1.1, r * 0.075);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.stroke();

  ctx.fillStyle = "rgba(6,10,18,0.82)";
  ctx.font = `800 ${Math.round(r * 0.82)}px Orbitron, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(tier), x, y + r * 0.03);
}

function drawBin(ctx: CanvasRenderingContext2D, danger: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, BIN_HEIGHT);
  bg.addColorStop(0, "rgba(18,26,44,0.92)");
  bg.addColorStop(1, "rgba(8,11,20,0.96)");
  ctx.fillStyle = bg;
  ctx.beginPath();
  roundRect(ctx, 0, 0, BIN_WIDTH, BIN_HEIGHT, 18);
  ctx.fill();

  ctx.strokeStyle = "rgba(41,221,244,0.22)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let c = 1; c < COLS; c += 1) {
    const x = c * COL_WIDTH;
    ctx.beginPath();
    ctx.moveTo(x, 10);
    ctx.lineTo(x, BIN_HEIGHT - 10);
    ctx.stroke();
  }

  ctx.setLineDash([10, 9]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = danger > 0 ? `rgba(255,107,157,${0.55 + danger * 0.45})` : "rgba(255,200,87,0.5)";
  ctx.beginPath();
  ctx.moveTo(6, OVERFLOW_Y);
  ctx.lineTo(BIN_WIDTH - 6, OVERFLOW_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = "rgba(41,221,244,0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(4, BIN_HEIGHT - 1.5);
  ctx.lineTo(BIN_WIDTH - 4, BIN_HEIGHT - 1.5);
  ctx.stroke();
}

function overflowDanger(state: FusionState): number {
  let top = Infinity;
  for (const stack of state.columns) {
    for (const orb of stack) top = Math.min(top, orb.y - orbRadius(orb.tier));
  }
  if (!Number.isFinite(top)) return 0;
  const span = 140;
  return Math.max(0, Math.min(1, (OVERFLOW_Y + span - top) / span));
}

export function drawFusion(view: FusionView, state: FusionState, opts: DrawOpts): void {
  const { ctx } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, view.canvas.width, view.canvas.height);
  const k = view.dpr * view.scale;
  const shake = opts.reduced ? 0 : opts.fx.shake;
  const sx = shake === 0 ? 0 : Math.sin(opts.now / 21) * shake * 7;
  const sy = shake === 0 ? 0 : Math.cos(opts.now / 17) * shake * 5;
  ctx.setTransform(k, 0, 0, k, sx * k, sy * k);

  const danger = overflowDanger(state);
  drawBin(ctx, danger);

  for (const stack of state.columns) {
    for (const orb of stack) {
      drawOrb(ctx, (orb.col + 0.5) * COL_WIDTH, orb.y, orbRadius(orb.tier), orb.tier, !opts.reduced);
    }
  }
  if (state.falling) {
    drawOrb(
      ctx,
      (state.falling.col + 0.5) * COL_WIDTH,
      state.falling.y,
      orbRadius(state.falling.tier),
      state.falling.tier,
      !opts.reduced,
    );
  }

  if (opts.aimCol !== null && !state.falling && state.status === "playing") {
    const cx = (opts.aimCol + 0.5) * COL_WIDTH;
    ctx.fillStyle = "rgba(41,221,244,0.10)";
    ctx.fillRect(opts.aimCol * COL_WIDTH + 2, 0, COL_WIDTH - 4, BIN_HEIGHT);
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = "rgba(41,221,244,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, 14);
    ctx.lineTo(cx, BIN_HEIGHT - 6);
    ctx.stroke();
    ctx.setLineDash([]);
    const r = orbRadius(state.nextTier);
    drawOrb(ctx, cx, OVERFLOW_Y - r - 8, r, state.nextTier, !opts.reduced);
  }

  for (const flash of opts.fx.flashes) {
    const p = flash.life / flash.max;
    ctx.globalAlpha = Math.max(0, p) * 0.7;
    ctx.strokeStyle = tierColor(flash.tier);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(flash.x, flash.y, (1 - p) * 60 + 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const particle of opts.fx.particles) {
    const p = Math.max(0, particle.life / particle.max);
    ctx.globalAlpha = p;
    ctx.fillStyle = tierColor(particle.tier);
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 2 + p * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (opts.dimmed) {
    ctx.fillStyle = "rgba(4,6,12,0.62)";
    ctx.beginPath();
    roundRect(ctx, 0, 0, BIN_WIDTH, BIN_HEIGHT, 18);
    ctx.fill();
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
