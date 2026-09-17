import type { BreakerGameState, Brick, FieldOrb } from "./engine";

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

export interface ShockwaveFX {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface LaserBeamFX {
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

export class BreakerRenderer {
  private particles: BreakerParticle[] = [];
  private floatingTexts: BreakerFloatingText[] = [];
  private ballTrails: BallTrailPoint[] = [];
  private shockwaves: ShockwaveFX[] = [];
  private laserBeams: LaserBeamFX[] = [];
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

  emitOrbCollect(orb: FieldOrb, count = 14): void {
    const color = orb.type === "add_ball" ? "#00FF66" : orb.type === "laser_cross" ? "#FFD700" : "#FF3B30";
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 160;
      this.particles.push({
        x: orb.x,
        y: orb.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 3 + Math.random() * 2.5,
        life: 0,
        maxLife: 0.45,
      });
    }
  }

  emitTNTExplosion(x: number, y: number, radius = 68): void {
    this.triggerShake(9, 0.32);
    this.shockwaves.push({
      x,
      y,
      radius: 10,
      maxRadius: radius,
      color: "#FF3B30",
      life: 0,
      maxLife: 0.35,
    });

    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 200;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.4 ? "#FF9500" : "#FF2A2A",
        size: 3 + Math.random() * 4,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.2,
      });
    }
  }

  emitLaserCrossFX(x: number, y: number): void {
    this.triggerShake(5, 0.2);
    this.laserBeams.push({
      x,
      y,
      life: 0,
      maxLife: 0.28,
    });

    for (let i = 0; i < 16; i++) {
      const isH = Math.random() > 0.5;
      const speed = (Math.random() - 0.5) * 260;
      this.particles.push({
        x: isH ? x + speed * 0.5 : x,
        y: isH ? y : y + speed * 0.5,
        vx: isH ? speed : 0,
        vy: isH ? 0 : speed,
        color: "#FFD700",
        size: 2.5 + Math.random() * 2.5,
        life: 0,
        maxLife: 0.3,
      });
    }
  }

  emitSplitterFX(x: number, y: number): void {
    this.triggerShake(4, 0.18);
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 150;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: "#E040FB",
        size: 3 + Math.random() * 2.5,
        life: 0,
        maxLife: 0.4,
      });
    }
  }

  emitCeilingSpark(x: number, y: number): void {
    for (let i = 0; i < 5; i++) {
      const angle = Math.PI * 0.25 + Math.random() * Math.PI * 0.5;
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: "#00F2FF",
        size: 2 + Math.random() * 2,
        life: 0,
        maxLife: 0.22,
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
          radius: b.radius * 0.8,
          alpha: 0.4,
        });
      }
    }

    // Fade trails
    for (let i = this.ballTrails.length - 1; i >= 0; i--) {
      const bt = this.ballTrails[i]!;
      bt.alpha -= dtSeconds * 3.2;
      if (bt.alpha <= 0) {
        this.ballTrails.splice(i, 1);
      }
    }

    // Update shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i]!;
      sw.life += dtSeconds;
      const progress = sw.life / sw.maxLife;
      sw.radius = 10 + (sw.maxRadius - 10) * progress;
      if (sw.life >= sw.maxLife) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Update laser beams
    for (let i = this.laserBeams.length - 1; i >= 0; i--) {
      const lb = this.laserBeams[i]!;
      lb.life += dtSeconds;
      if (lb.life >= lb.maxLife) {
        this.laserBeams.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dtSeconds;
      p.x += p.vx * dtSeconds;
      p.y += p.vy * dtSeconds;
      p.vy += 80 * dtSeconds;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i]!;
      ft.life += dtSeconds;
      ft.y -= 28 * dtSeconds;
      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
      }
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

    // Screen Shake
    if (this.shakeTimer > 0) {
      const s = this.shakeIntensity * (this.shakeTimer / 0.25);
      const ox = (Math.random() - 0.5) * s * 2;
      const oy = (Math.random() - 0.5) * s * 2;
      ctx.translate(ox, oy);
    }

    // 1. Deep Cyber Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#080914");
    bgGrad.addColorStop(0.5, "#0b0c1c");
    bgGrad.addColorStop(1, "#07080e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle neon grid
    ctx.strokeStyle = "rgba(0, 242, 255, 0.035)";
    ctx.lineWidth = 1;
    const gridSize = 24;
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Glowing Neon Ceiling Barrier (y = 12)
    ctx.save();
    const ceilGlow = 0.6 + 0.3 * Math.sin(now / 180);
    ctx.strokeStyle = `rgba(0, 242, 255, ${ceilGlow})`;
    ctx.shadowColor = "#00F2FF";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(8, 12);
    ctx.lineTo(width - 8, 12);
    ctx.stroke();
    ctx.restore();

    // 3. Stage Progress Indicator Bar
    if (state.initialBricksInStage > 0) {
      const remaining = state.bricks.length;
      const pct = Math.max(0, Math.min(1, 1 - remaining / state.initialBricksInStage));
      ctx.save();
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(18, 4, width - 36, 4);
      ctx.fillStyle = "#00F2FF";
      ctx.shadowColor = "#00F2FF";
      ctx.shadowBlur = 6;
      ctx.fillRect(18, 4, (width - 36) * pct, 4);
      ctx.restore();
    }

    // 4. Trajectory Raycast Guide
    if (state.aiming && !state.launched) {
      const dotSpacing = 14;
      ctx.save();
      for (let sIdx = 0; sIdx < state.aimTrajectory.length; sIdx++) {
        const seg = state.aimTrajectory[sIdx]!;
        const segDist = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
        const steps = Math.max(1, Math.floor(segDist / dotSpacing));
        const dx = (seg.x2 - seg.x1) / steps;
        const dy = (seg.y2 - seg.y1) / steps;

        for (let i = 0; i <= steps; i++) {
          const px = seg.x1 + dx * i;
          const py = seg.y1 + dy * i;
          const dotFade = Math.max(0.35, 1 - (sIdx * 0.3 + (i / steps) * 0.3));

          ctx.fillStyle = "#FFFFFF";
          ctx.shadowColor = "#00F2FF";
          ctx.shadowBlur = 8;
          ctx.globalAlpha = dotFade;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Impact targeting reticle at end of trajectory
        if (sIdx === state.aimTrajectory.length - 1) {
          const pulseR = 7 + Math.sin(now / 90) * 2.5;
          ctx.strokeStyle = "#00F2FF";
          ctx.shadowColor = "#00F2FF";
          ctx.shadowBlur = 12;
          ctx.lineWidth = 1.8;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(seg.x2, seg.y2, pulseR, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.arc(seg.x2, seg.y2, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 5. Ball neon trails
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

    // 6. Bricks Rendering (Special Bricks + Numbered HP)
    for (const b of state.bricks) {
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = b.color;

      // Rounded rectangle brick body
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.width, b.height, 4);
      ctx.fill();

      // Top-left bevel highlight
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(b.x + 2, b.y + b.height - 2);
      ctx.lineTo(b.x + 2, b.y + 2);
      ctx.lineTo(b.x + b.width - 2, b.y + 2);
      ctx.stroke();

      // Special Bricks Overlays
      if (b.special === "armor" && (b.armorHits ?? 0) > 0) {
        // Metallic shield border & rivets
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x + 1, b.y + 1, b.width - 2, b.height - 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(b.x + 4, b.y + 4, 1.5, 0, Math.PI * 2);
        ctx.arc(b.x + b.width - 4, b.y + 4, 1.5, 0, Math.PI * 2);
        ctx.arc(b.x + 4, b.y + b.height - 4, 1.5, 0, Math.PI * 2);
        ctx.arc(b.x + b.width - 4, b.y + b.height - 4, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.special === "tnt") {
        // Red flashing bomb glow
        const tntPulse = 0.3 + 0.2 * Math.sin(now / 100);
        ctx.fillStyle = `rgba(255, 255, 255, ${tntPulse})`;
        ctx.fillRect(b.x + 2, b.y + 2, b.width - 4, b.height - 4);
      } else if (b.special === "laser_cross") {
        // Crosshair laser lines
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.x + b.width / 2, b.y);
        ctx.lineTo(b.x + b.width / 2, b.y + b.height);
        ctx.moveTo(b.x, b.y + b.height / 2);
        ctx.lineTo(b.x + b.width, b.y + b.height / 2);
        ctx.stroke();
      }

      // Damage crack fissures if brick is weakened
      if (b.hitsLeft < b.maxHits) {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(b.x + b.width * 0.25, b.y);
        ctx.lineTo(b.x + b.width * 0.45, b.y + b.height * 0.5);
        ctx.lineTo(b.x + b.width * 0.35, b.y + b.height * 0.7);
        ctx.lineTo(b.x + b.width * 0.65, b.y + b.height);
        ctx.stroke();
        ctx.restore();
      }

      // Hit number inside brick (or special icon)
      ctx.save();
      ctx.font = 'bold 11px "Rajdhani", "Orbitron", -apple-system, sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
      ctx.lineWidth = 2.5;

      let label = b.hitsLeft.toString();
      if (b.special === "tnt") {
        label = `B${b.hitsLeft}`;
      } else if (b.special === "laser_cross") {
        label = `L${b.hitsLeft}`;
      } else if (b.special === "splitter") {
        label = `S${b.hitsLeft}`;
      } else if (b.special === "armor" && (b.armorHits ?? 0) > 0) {
        label = `A${b.armorHits}`;
      }

      ctx.strokeText(label, b.x + b.width / 2, b.y + b.height / 2 + 0.5);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(label, b.x + b.width / 2, b.y + b.height / 2 + 0.5);
      ctx.restore();

      ctx.restore();
    }

    // 7. Field Orbs (+Ball, Laser Cross, Bomb)
    for (const orb of state.fieldOrbs) {
      if (orb.collected) continue;
      ctx.save();
      const pulse = 1 + Math.sin(now / 140) * 0.12;

      if (orb.type === "add_ball") {
        ctx.fillStyle = "#00FF66";
        ctx.shadowColor = "#00FF66";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#07080E";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("+", orb.x, orb.y + 0.5);
      } else if (orb.type === "laser_cross") {
        ctx.fillStyle = "#FFD700";
        ctx.shadowColor = "#FFD700";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#07080E";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("L", orb.x, orb.y);
      } else if (orb.type === "bomb") {
        ctx.fillStyle = "#FF3B30";
        ctx.shadowColor = "#FF3B30";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#07080E";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("B", orb.x, orb.y);
      }

      ctx.restore();
    }

    // 8. Laser Beams FX
    for (const lb of this.laserBeams) {
      const alpha = Math.max(0, 1 - lb.life / lb.maxLife);
      ctx.save();
      ctx.strokeStyle = `rgba(255, 235, 59, ${alpha})`;
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 16;
      ctx.lineWidth = 6;
      ctx.beginPath();
      // Horizontal laser
      ctx.moveTo(0, lb.y);
      ctx.lineTo(width, lb.y);
      // Vertical laser
      ctx.moveTo(lb.x, 0);
      ctx.lineTo(lb.x, height);
      ctx.stroke();

      // White core
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // 9. Shockwave Rings FX (TNT)
    for (const sw of this.shockwaves) {
      const alpha = Math.max(0, 1 - sw.life / sw.maxLife);
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 16;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 10. Lasers (player fired)
    for (const l of state.lasers) {
      ctx.save();
      ctx.fillStyle = "#FF007F";
      ctx.shadowColor = "#FF007F";
      ctx.shadowBlur = 8;
      ctx.fillRect(l.x - 2, l.y - 8, 4, 16);
      ctx.restore();
    }

    // 11. Power-up items falling
    for (const p of state.powerUps) {
      ctx.save();
      const pColor = p.type === "multiball" ? "#00F2FF" : p.type === "expand" ? "#00FF66" : "#FF007F";
      ctx.fillStyle = pColor;
      ctx.shadowColor = pColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#07080E";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const icon = p.type === "multiball" ? "x3" : p.type === "expand" ? "<>" : "L";
      ctx.fillText(icon, p.x, p.y);
      ctx.restore();
    }

    // 12. Particles
    for (const p of this.particles) {
      const alpha = 1 - p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - p.life / p.maxLife * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 13. Flying / Unlaunched Balls
    for (const b of state.balls) {
      ctx.save();
      ctx.fillStyle = "#FFFFFF";
      ctx.shadowColor = "#00F2FF";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 14. Turret Base Cannon / Paddle
    ctx.save();
    ctx.shadowColor = "#FF007F";
    ctx.shadowBlur = 12;

    const turretGrad = ctx.createLinearGradient(state.paddleX, 0, state.paddleX + state.paddleWidth, 0);
    turretGrad.addColorStop(0, "#FF007F");
    turretGrad.addColorStop(0.5, "#00F2FF");
    turretGrad.addColorStop(1, "#FF007F");
    ctx.fillStyle = turretGrad;
    ctx.beginPath();
    ctx.roundRect(state.paddleX, state.paddleY, state.paddleWidth, state.paddleHeight, 6);
    ctx.fill();

    // Central Cannon Launcher Nozzle
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "#00F2FF";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(state.launcherX, state.launcherY + 4, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 15. Ball count badge above turret
    if (!state.launched) {
      ctx.save();
      ctx.font = 'bold 11px "Rajdhani", monospace';
      ctx.textAlign = "center";
      ctx.fillStyle = "#00F2FF";
      ctx.shadowColor = "#00F2FF";
      ctx.shadowBlur = 8;
      ctx.fillText(`x${state.totalBalls}`, state.launcherX, state.launcherY - 14);
      ctx.restore();
    }

    // 16. Floating texts
    for (const ft of this.floatingTexts) {
      const alpha = 1 - ft.life / ft.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 13px "Rajdhani", -apple-system, sans-serif';
      ctx.textAlign = "center";
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 8;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore();
  }
}
