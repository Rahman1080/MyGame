import type { FoodItem, SnakeGameState } from "./engine";

export interface SnakeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export class SnakeRenderer {
  private particles: SnakeParticle[] = [];

  emitFoodBurst(x: number, y: number, color: string, count = 16): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 2 + Math.random() * 3,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.3,
      });
    }
  }

  updateParticles(dtSeconds: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dtSeconds;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dtSeconds;
      p.y += p.vy * dtSeconds;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    state: SnakeGameState,
    width: number,
    height: number,
    now: number,
  ): void {
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = "#07080D";
    ctx.fillRect(0, 0, width, height);

    const pad = 12;
    const boardW = width - pad * 2;
    const boardH = height - pad * 2;
    const cellW = boardW / state.width;
    const cellH = boardH / state.height;

    // Grid bounding box
    ctx.strokeStyle = "rgba(41, 221, 244, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pad, pad, boardW, boardH);

    // Subtle background grid dots
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    for (let r = 0; r <= state.height; r++) {
      for (let c = 0; c <= state.width; c++) {
        ctx.fillRect(pad + c * cellW - 1, pad + r * cellH - 1, 2, 2);
      }
    }

    // Food rendering
    if (state.food) {
      this.drawFood(ctx, state.food, pad, cellW, cellH, now);
    }

    // Snake rendering
    this.drawSnake(ctx, state, pad, cellW, cellH, now);

    // Particles
    for (const p of this.particles) {
      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  private drawFood(
    ctx: CanvasRenderingContext2D,
    food: FoodItem,
    pad: number,
    cellW: number,
    cellH: number,
    now: number,
  ): void {
    const cx = pad + (food.x + 0.5) * cellW;
    const cy = pad + (food.y + 0.5) * cellH;
    const radius = (Math.min(cellW, cellH) * 0.38);

    let color = "#00F2FF";
    let glow = "#00F2FF";
    if (food.type === "multiplier") {
      color = "#FFD700";
      glow = "#FFA500";
    } else if (food.type === "slowmo") {
      color = "#00E5FF";
      glow = "#3B82F6";
    } else if (food.type === "phase") {
      color = "#E056FD";
      glow = "#BD10E0";
    }

    ctx.save();
    const pulse = 1 + Math.sin(now / 150) * 0.15;

    // Outer glow aura
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.5 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.globalAlpha = 0.25;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 14;
    ctx.fill();

    // Food core
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * pulse, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;
    ctx.fill();

    // Inner bright center
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.45 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    ctx.restore();
  }

  private drawSnake(
    ctx: CanvasRenderingContext2D,
    state: SnakeGameState,
    pad: number,
    cellW: number,
    cellH: number,
    now: number,
  ): void {
    const len = state.snake.length;
    const isPhase = state.activePowerUp?.type === "phase";

    for (let i = len - 1; i >= 0; i--) {
      const seg = state.snake[i]!;
      const cx = pad + (seg.x + 0.5) * cellW;
      const cy = pad + (seg.y + 0.5) * cellH;
      const ratio = i / Math.max(1, len - 1);
      const isHead = i === 0;

      ctx.save();

      let mainColor = isPhase ? "#D050FF" : "#00F2FF";
      let blurColor = isPhase ? "#D050FF" : "#0088FF";

      if (!isHead) {
        // Gradient color along body from cyan to violet
        const r = Math.round(0 + ratio * 150);
        const g = Math.round(242 - ratio * 160);
        const b = Math.round(255);
        mainColor = `rgb(${r}, ${g}, ${b})`;
      }

      ctx.fillStyle = mainColor;
      ctx.shadowColor = blurColor;
      ctx.shadowBlur = isHead ? 14 : 6;
      ctx.globalAlpha = isPhase ? 0.7 + Math.sin(now / 80 + i) * 0.25 : 1;

      const size = Math.min(cellW, cellH) * (isHead ? 0.88 : 0.76 - ratio * 0.15);
      const r = size * 0.35;

      ctx.beginPath();
      ctx.roundRect(cx - size / 2, cy - size / 2, size, size, r);
      ctx.fill();

      // Draw eyes on head
      if (isHead) {
        ctx.fillStyle = "#FFFFFF";
        ctx.shadowBlur = 4;
        const eyeOffset = size * 0.24;
        const eyeRadius = size * 0.12;

        let eye1X = cx;
        let eye1Y = cy;
        let eye2X = cx;
        let eye2Y = cy;

        if (state.dir.x === 1) { // Moving right
          eye1X = cx + eyeOffset; eye1Y = cy - eyeOffset;
          eye2X = cx + eyeOffset; eye2Y = cy + eyeOffset;
        } else if (state.dir.x === -1) { // Moving left
          eye1X = cx - eyeOffset; eye1Y = cy - eyeOffset;
          eye2X = cx - eyeOffset; eye2Y = cy + eyeOffset;
        } else if (state.dir.y === -1) { // Moving up
          eye1X = cx - eyeOffset; eye1Y = cy - eyeOffset;
          eye2X = cx + eyeOffset; eye2Y = cy - eyeOffset;
        } else { // Moving down
          eye1X = cx - eyeOffset; eye1Y = cy + eyeOffset;
          eye2X = cx + eyeOffset; eye2Y = cy + eyeOffset;
        }

        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, eyeRadius, 0, Math.PI * 2);
        ctx.arc(eye2X, eye2Y, eyeRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}
