import type { BreakerGameState, Brick } from "./engine";

export interface BreakerParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export class BreakerRenderer {
  private particles: BreakerParticle[] = [];

  emitBrickShatter(brick: Brick, count = 12): void {
    const cx = brick.x + brick.width / 2;
    const cy = brick.y + brick.height / 2;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 120;
      this.particles.push({
        x: cx + (Math.random() - 0.5) * brick.width * 0.6,
        y: cy + (Math.random() - 0.5) * brick.height * 0.6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: brick.color,
        size: 2.5 + Math.random() * 2.5,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.25,
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
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    state: BreakerGameState,
    width: number,
    height: number,
    _now: number,
  ): void {
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Deep neon background
    ctx.fillStyle = "#07080D";
    ctx.fillRect(0, 0, width, height);

    // Playfield border
    ctx.strokeStyle = "rgba(41, 221, 244, 0.25)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // Bricks
    for (const b of state.bricks) {
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = b.color;
      ctx.globalAlpha = b.hitsLeft === 1 ? 0.85 : 1;

      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.width, b.height, 4);
      ctx.fill();

      // Inner highlight
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Power-up indicator symbol
      if (b.powerUp) {
        ctx.fillStyle = "#FFFFFF";
        ctx.globalAlpha = 0.9;
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const sym = b.powerUp === "multiball" ? "●●" : b.powerUp === "laser" ? "⚡" : "↔";
        ctx.fillText(sym, b.x + b.width / 2, b.y + b.height / 2);
      }

      ctx.restore();
    }

    // Power-up items falling
    for (const p of state.powerUps) {
      ctx.save();
      const color = p.type === "multiball" ? "#FF007F" : p.type === "laser" ? "#FFD700" : "#00F2FF";
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const sym = p.type === "multiball" ? "M" : p.type === "laser" ? "L" : "W";
      ctx.fillText(sym, p.x, p.y);
      ctx.restore();
    }

    // Lasers
    for (const l of state.lasers) {
      ctx.save();
      ctx.fillStyle = "#FFD700";
      ctx.shadowColor = "#FF8C00";
      ctx.shadowBlur = 8;
      ctx.fillRect(l.x - 2, l.y, 4, 12);
      ctx.restore();
    }

    // Paddle
    ctx.save();
    const isLaserReady = state.laserAmmo > 0;
    const paddleColor = isLaserReady ? "#FFD700" : "#00F2FF";
    ctx.fillStyle = paddleColor;
    ctx.shadowColor = paddleColor;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.roundRect(state.paddleX, state.paddleY, state.paddleWidth, state.paddleHeight, 6);
    ctx.fill();

    // Paddle edge accents
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(state.paddleX + 4, state.paddleY + 3, 4, state.paddleHeight - 6);
    ctx.fillRect(state.paddleX + state.paddleWidth - 8, state.paddleY + 3, 4, state.paddleHeight - 6);
    ctx.restore();

    // Balls
    for (const b of state.balls) {
      ctx.save();
      ctx.fillStyle = "#00F2FF";
      ctx.shadowColor = "#00F2FF";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Ball core
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

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
}
