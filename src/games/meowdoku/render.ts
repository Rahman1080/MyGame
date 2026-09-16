/* ── Meowdoku Canvas2D Renderer ──
   Renders neon colored regions, grid lines, cute glowing cat avatars,
   neon X marks, and selection/conflict animations. */

import type { MeowdokuEngine } from "./engine";
import { REGION_COLORS } from "./engine";

export class MeowdokuRenderer {
  private animTimer = 0;

  render(
    ctx: CanvasRenderingContext2D,
    engine: MeowdokuEngine,
    width: number,
    height: number,
    selectedCell: { row: number; col: number } | null = null,
    flashError = false,
  ): void {
    this.animTimer += 0.03;

    // Clear background
    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, width, height);

    const n = engine.size;
    const padding = 16;
    const availableSize = Math.min(width - padding * 2, height - padding * 2);
    const cellSize = Math.floor(availableSize / n);
    const boardSize = cellSize * n;
    const startX = Math.floor((width - boardSize) / 2);
    const startY = Math.floor((height - boardSize) / 2);

    // 1. Draw region color backgrounds
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cell = engine.grid[r]?.[c];
        if (!cell) continue;

        const x = startX + c * cellSize;
        const y = startY + r * cellSize;
        const color = REGION_COLORS[cell.region % REGION_COLORS.length] ?? "#00e5ff";

        // Soft pastel/neon translucent tint for region
        ctx.fillStyle = this.hexToRgba(color, 0.22);
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }

    // 2. Draw subtle cell grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= n; i++) {
      // Horizontal
      ctx.beginPath();
      ctx.moveTo(startX, startY + i * cellSize);
      ctx.lineTo(startX + boardSize, startY + i * cellSize);
      ctx.stroke();

      // Vertical
      ctx.beginPath();
      ctx.moveTo(startX + i * cellSize, startY);
      ctx.lineTo(startX + i * cellSize, startY + boardSize);
      ctx.stroke();
    }

    // 3. Draw heavy borders between different regions
    ctx.save();
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cell = engine.grid[r]?.[c];
        if (!cell) continue;
        const x = startX + c * cellSize;
        const y = startY + r * cellSize;
        const color = REGION_COLORS[cell.region % REGION_COLORS.length] ?? "#00e5ff";

        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;

        // Check top boundary
        if (r === 0 || (engine.grid[r - 1]?.[c]?.region ?? -1) !== cell.region) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + cellSize, y);
          ctx.stroke();
        }
        // Check bottom boundary
        if (r === n - 1 || (engine.grid[r + 1]?.[c]?.region ?? -1) !== cell.region) {
          ctx.beginPath();
          ctx.moveTo(x, y + cellSize);
          ctx.lineTo(x + cellSize, y + cellSize);
          ctx.stroke();
        }
        // Check left boundary
        if (c === 0 || (engine.grid[r]?.[c - 1]?.region ?? -1) !== cell.region) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + cellSize);
          ctx.stroke();
        }
        // Check right boundary
        if (c === n - 1 || (engine.grid[r]?.[c + 1]?.region ?? -1) !== cell.region) {
          ctx.beginPath();
          ctx.moveTo(x + cellSize, y);
          ctx.lineTo(x + cellSize, y + cellSize);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    // 4. Outer board glow border
    ctx.save();
    ctx.strokeStyle = "#40c4ff";
    ctx.shadowColor = "#40c4ff";
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(startX, startY, boardSize, boardSize);
    ctx.restore();

    // 5. Draw highlighted / selected / invalid cells
    if (selectedCell) {
      const sx = startX + selectedCell.col * cellSize;
      const sy = startY + selectedCell.row * cellSize;
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(sx, sy, cellSize, cellSize);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, cellSize - 2, cellSize - 2);
    }

    // Invalid conflicts flashing red
    if (engine.invalidCells.length > 0 || flashError) {
      const pulse = 0.4 + 0.3 * Math.sin(this.animTimer * 10);
      ctx.fillStyle = `rgba(255, 23, 68, ${pulse})`;
      for (const inv of engine.invalidCells) {
        const ix = startX + inv.col * cellSize;
        const iy = startY + inv.row * cellSize;
        ctx.fillRect(ix, iy, cellSize, cellSize);
      }
    }

    // 6. Draw Marks ('cat' or 'x')
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cell = engine.grid[r]?.[c];
        if (!cell) continue;
        const cx = startX + c * cellSize + cellSize / 2;
        const cy = startY + r * cellSize + cellSize / 2;

        if (cell.mark === "cat") {
          this.drawCat(ctx, cx, cy, cellSize * 0.38);
        } else if (cell.mark === "x") {
          this.drawCross(ctx, cx, cy, cellSize * 0.22);
        }
      }
    }
  }

  /** Draws a glowing neon cat avatar with ears, eyes, and cute nose */
  private drawCat(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    ctx.save();
    ctx.translate(cx, cy);

    // Glowing aura
    ctx.shadowColor = "#ffd740";
    ctx.shadowBlur = 12;

    // Cat Face Base (rounded circle/oval)
    ctx.fillStyle = "#fff8e1";
    ctx.beginPath();
    ctx.arc(0, r * 0.1, r * 0.82, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.fillStyle = "#fff8e1";
    // Left ear
    ctx.beginPath();
    ctx.moveTo(-r * 0.72, -r * 0.1);
    ctx.lineTo(-r * 0.75, -r * 0.95);
    ctx.lineTo(-r * 0.2, -r * 0.65);
    ctx.closePath();
    ctx.fill();

    // Right ear
    ctx.beginPath();
    ctx.moveTo(r * 0.72, -r * 0.1);
    ctx.lineTo(r * 0.75, -r * 0.95);
    ctx.lineTo(r * 0.2, -r * 0.65);
    ctx.closePath();
    ctx.fill();

    // Pink inner ears
    ctx.fillStyle = "#ff80ab";
    ctx.beginPath();
    ctx.moveTo(-r * 0.62, -r * 0.18);
    ctx.lineTo(-r * 0.65, -r * 0.8);
    ctx.lineTo(-r * 0.28, -r * 0.58);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(r * 0.62, -r * 0.18);
    ctx.lineTo(r * 0.7, -r * 0.8);
    ctx.lineTo(r * 0.28, -r * 0.58);
    ctx.closePath();
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#263238";
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, 0, r * 0.11, r * 0.15, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.32, 0, r * 0.11, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye catchlights (sparkle)
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-r * 0.35, -r * 0.05, r * 0.045, 0, Math.PI * 2);
    ctx.arc(r * 0.29, -r * 0.05, r * 0.045, 0, Math.PI * 2);
    ctx.fill();

    // Nose (tiny pink triangle)
    ctx.fillStyle = "#ff4081";
    ctx.beginPath();
    ctx.moveTo(0, r * 0.18);
    ctx.lineTo(-r * 0.08, r * 0.1);
    ctx.lineTo(r * 0.08, r * 0.1);
    ctx.closePath();
    ctx.fill();

    // Mouth / whiskers
    ctx.strokeStyle = "#455a64";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";

    // Whiskers left
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, r * 0.18);
    ctx.lineTo(-r * 0.85, r * 0.12);
    ctx.moveTo(-r * 0.45, r * 0.25);
    ctx.lineTo(-r * 0.85, r * 0.32);
    // Whiskers right
    ctx.moveTo(r * 0.45, r * 0.18);
    ctx.lineTo(r * 0.85, r * 0.12);
    ctx.moveTo(r * 0.45, r * 0.25);
    ctx.lineTo(r * 0.85, r * 0.32);
    ctx.stroke();

    ctx.restore();
  }

  /** Draws a crisp glowing neon red cross for excluded cells */
  private drawCross(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.save();
    ctx.strokeStyle = "#ff3366";
    ctx.shadowColor = "#ff3366";
    ctx.shadowBlur = 6;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(cx - size, cy - size);
    ctx.lineTo(cx + size, cy + size);
    ctx.moveTo(cx + size, cy - size);
    ctx.lineTo(cx - size, cy + size);
    ctx.stroke();

    ctx.restore();
  }

  private hexToRgba(hex: string, alpha: number): string {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
