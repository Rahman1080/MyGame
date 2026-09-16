import type { GridPos, WordSearchState } from "./engine";

export interface WordSearchParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export class WordSearchRenderer {
  private particles: WordSearchParticle[] = [];

  emitVictoryBurst(width: number, height: number): void {
    const colors = ["#00FFA3", "#00F2FF", "#FF007F", "#FFD700", "#BD10E0"];
    for (let i = 0; i < 48; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 160;
      this.particles.push({
        x: width / 2,
        y: height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        color: colors[Math.floor(Math.random() * colors.length)]!,
        size: 3 + Math.random() * 3,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.4,
      });
    }
  }

  update(dtSeconds: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dtSeconds;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dtSeconds;
      p.y += p.vy * dtSeconds;
      p.vy += 90 * dtSeconds; // Gravity
      p.vx *= 0.96;
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    state: WordSearchState,
    width: number,
    height: number,
    now: number,
  ): void {
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Deep dark neon canvas background
    ctx.fillStyle = "#07080D";
    ctx.fillRect(0, 0, width, height);

    const pad = 12;
    const boardSize = Math.min(width, height) - pad * 2;
    const startX = (width - boardSize) / 2;
    const startY = (height - boardSize) / 2;
    const cellSize = boardSize / state.size;

    // Grid container frame
    ctx.save();
    ctx.fillStyle = "#0b0f19";
    ctx.strokeStyle = "rgba(0, 255, 163, 0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(startX, startY, boardSize, boardSize, 14);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Background cell slot dots
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        const cx = startX + (c + 0.5) * cellSize;
        const cy = startY + (r + 0.5) * cellSize;
        ctx.fillRect(cx - 1, cy - 1, 2, 2);
      }
    }

    // Draw permanently found word highlight capsules
    for (const pw of state.placedWords) {
      if (!pw.found) continue;
      this.drawCapsule(
        ctx,
        startX,
        startY,
        cellSize,
        pw.start,
        pw.end,
        pw.color,
        0.35,
        false,
      );
    }

    // Draw active drag selection preview capsule
    if (state.activeSelection) {
      this.drawCapsule(
        ctx,
        startX,
        startY,
        cellSize,
        state.activeSelection.start,
        state.activeSelection.end,
        "#00FFA3",
        0.4,
        true,
      );
    }

    // Draw Hint Beacon Pulse
    if (state.hintCell) {
      const cx = startX + (state.hintCell.c + 0.5) * cellSize;
      const cy = startY + (state.hintCell.r + 0.5) * cellSize;
      const pulseProgress = (now % 800) / 800;
      const pulseRadius = (cellSize * 0.45) * (1 + pulseProgress * 0.7);

      ctx.save();
      ctx.strokeStyle = "#FFD700";
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 1 - pulseProgress;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Render Letters
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const fontSize = Math.floor(cellSize * 0.5);
    ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;

    // Map active selection cells for easy highlight lookup
    const selectedCells = new Set(
      state.activeSelection?.cells.map((p) => `${p.r},${p.c}`) ?? [],
    );

    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        const letter = state.grid[r]![c]!;
        const cx = startX + (c + 0.5) * cellSize;
        const cy = startY + (r + 0.5) * cellSize;

        const isSelected = selectedCells.has(`${r},${c}`);
        if (isSelected) {
          ctx.fillStyle = "#FFFFFF";
          ctx.shadowColor = "#00FFA3";
          ctx.shadowBlur = 8;
        } else {
          ctx.fillStyle = "#D4EDE1";
          ctx.shadowColor = "rgba(0, 255, 163, 0.4)";
          ctx.shadowBlur = 2;
        }

        ctx.fillText(letter, cx, cy);
      }
    }
    ctx.restore();

    // Celebration Particles
    for (const p of this.particles) {
      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  private drawCapsule(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    cellSize: number,
    p1: GridPos,
    p2: GridPos,
    color: string,
    alpha: number,
    pulsing: boolean,
  ): void {
    const x1 = startX + (p1.c + 0.5) * cellSize;
    const y1 = startY + (p1.r + 0.5) * cellSize;
    const x2 = startX + (p2.c + 0.5) * cellSize;
    const y2 = startY + (p2.r + 0.5) * cellSize;
    const radius = cellSize * 0.42;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Glow aura
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = radius * 2;
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = pulsing ? 16 : 10;
    ctx.stroke();

    // Outer neon stroke border
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = radius * 2;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.stroke();

    ctx.restore();
  }
}
