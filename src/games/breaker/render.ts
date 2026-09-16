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

export interface BreakerFloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface BallTrailPoint {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

export class BreakerRenderer {
  private particles: BreakerParticle[] = [];
  private floatingTexts: BreakerFloatingText[] = [];
  private ballTrails: BallTrailPoint[] = [];
  private shakeTimer = 0;
  private shakeIntensity = 0;

  triggerShake(intensity = 6, duration = 0.25): void {
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
  }

  emitFloatingText(x: number, y: number, text: string, color = "#00F2FF"): void {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      life: 0,
      maxLife: 0.8,
    });
  }

  emitBrickShatter(brick: Brick, count = 16): void {
    const cx = brick.x + brick.width / 2;
    const cy = brick.y + brick.height / 2;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 140;
      this.particles.push({
        x: cx + (Math.random() - 0.5) * brick.width * 0.6,
        y: cy + (Math.random() - 0.5) * brick.height * 0.6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: brick.color,
        size: 2.5 + Math.random() * 3,
        life: 0,
        maxLife: 0.38 + Math.random() * 0.25,
      });
    }
  }

  update(dtSeconds: number, state?: BreakerGameState): void {
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dtSeconds);
    }

    // Record ball trails
    if (state && state.launched) {
      for (const b of state.balls) {
        this.ballTrails.push({
          x: b.x,
          y: b.y,
          radius: b.radius * 0.85,
          alpha: 0.6,
        });
      }
    }

    // Decay ball trails
    for (let i = this.ballTrails.length - 1; i >= 0; i--) {
      const bt = this.ballTrails[i]!;
      bt.alpha -= dtSeconds * 3.5;
      if (bt.alpha <= 0) {
        this.ballTrails.splice(i, 1);
      }
    }
    if (this.ballTrails.length > 40) {
      this.ballTrails.splice(0, this.ballTrails.length - 40);
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dtSeconds;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dtSeconds;
      p.y += p.vy * dtSeconds;
      p.vx *= 0.95;
      p.vy *= 0.95;
    }

    // Floating text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i]!;
      ft.life += dtSeconds;
      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.y -= 26 * dtSeconds;
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    state: BreakerGameState,
    width: number,
    height: number,
    now: number,
  ): void {
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Deep neon background
    ctx.fillStyle = "#07080D";
    ctx.fillRect(0, 0, width, height);

    // Screen shake
    if (this.shakeTimer > 0) {
      const currentIntensity = this.shakeIntensity * (this.shakeTimer / 0.25);
      const ox = (Math.random() - 0.5) * 2 * currentIntensity;
      const oy = (Math.random() - 0.5) * 2 * currentIntensity;
      ctx.translate(ox, oy);
    }

    // Playfield border
    ctx.strokeStyle = "rgba(41, 221, 244, 0.25)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // Ball neon trails
    for (const bt of this.ballTrails) {
      ctx.save();
      ctx.globalAlpha = bt.alpha * 0.45;
      ctx.fillStyle = "#00F2FF";
      ctx.shadowColor = "#00F2FF";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(bt.x, bt.y, bt.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Bricks
    for (const b of state.bricks) {
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = b.color;
      ctx.globalAlpha = b.hitsLeft === 1 && b.maxHits > 1 ? 0.75 : 0.95;

      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.width, b.height, 4);
      ctx.fill();

      // Inner highlight
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Draw neon crack fissure if damaged
      if (b.hitsLeft < b.maxHits) {
        ctx.save();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.5;
        ctx.shadowColor = "#FFFFFF";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(b.x + b.width * 0.2, b.y);
        ctx.lineTo(b.x + b.width * 0.4, b.y + b.height * 0.55);
        ctx.lineTo(b.x + b.width * 0.35, b.y + b.height * 0.7);
        ctx.lineTo(b.x + b.width * 0.7, b.y + b.height);
        ctx.stroke();
        ctx.restore();
      }

      // Power-up indicator symbol
      if (b.powerUp) {
        ctx.fillStyle = "#FFFFFF";
        ctx.globalAlpha = 0.95;
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
      const pulse = 1 + Math.sin(now / 120) * 0.12;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9 * pulse, 0, Math.PI * 2);
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
      ctx.fillRect(l.x - 2, l.y, 4, 14);
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
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Ball core
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2);
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

    // Floating text
    for (const ft of this.floatingTexts) {
      const progress = ft.life / ft.maxLife;
      const alpha = Math.max(0, 1 - progress);
      const scale = 1 + progress * 0.2;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 8;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `bold ${Math.floor(13 * scale)}px "JetBrains Mono", monospace`;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore();
  }
}
