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

export interface FloatingScore {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export class SnakeRenderer {
  private particles: SnakeParticle[] = [];
  private floatingScores: FloatingScore[] = [];
  private chompTimer = 0;
  private shakeTimer = 0;
  private shakeIntensity = 0;

  triggerChomp(): void {
    this.chompTimer = 0.22;
  }

  triggerShake(intensity = 6, duration = 0.25): void {
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
  }

  emitScorePopup(x: number, y: number, text: string, color = "#00F2FF"): void {
    this.floatingScores.push({
      x,
      y,
      text,
      color,
      life: 0,
      maxLife: 0.85,
    });
  }

  emitFoodBurst(x: number, y: number, color: string, count = 18): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 40 + Math.random() * 90;
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

  update(dtSeconds: number): void {
    if (this.chompTimer > 0) {
      this.chompTimer = Math.max(0, this.chompTimer - dtSeconds);
    }
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dtSeconds);
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
      p.vx *= 0.94;
      p.vy *= 0.94;
    }

    // Floating scores
    for (let i = this.floatingScores.length - 1; i >= 0; i--) {
      const fs = this.floatingScores[i]!;
      fs.life += dtSeconds;
      if (fs.life >= fs.maxLife) {
        this.floatingScores.splice(i, 1);
        continue;
      }
      fs.y -= 28 * dtSeconds; // Float upwards
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

    const pad = 12;
    const boardW = width - pad * 2;
    const boardH = height - pad * 2;
    const cellW = boardW / state.width;
    const cellH = boardH / state.height;

    // Grid bounding box
    ctx.strokeStyle = "rgba(41, 221, 244, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pad, pad, boardW, boardH);

    // Grid dots
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

    // Snake rendering with smooth movement interpolation
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

    // Floating score popups
    for (const fs of this.floatingScores) {
      const progress = fs.life / fs.maxLife;
      const alpha = Math.max(0, 1 - progress);
      const scale = 1 + progress * 0.25;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fs.color;
      ctx.shadowColor = fs.color;
      ctx.shadowBlur = 8;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `bold ${Math.floor(13 * scale)}px "JetBrains Mono", monospace`;
      ctx.fillText(fs.text, fs.x, fs.y);
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
    const radius = Math.min(cellW, cellH) * 0.4;

    let color = "#00F2FF";
    let glow = "#00F2FF";
    let rune = "✦";

    if (food.type === "multiplier") {
      color = "#FFD700";
      glow = "#FFA500";
      rune = "2X";
    } else if (food.type === "slowmo") {
      color = "#00E5FF";
      glow = "#3B82F6";
      rune = "⌛";
    } else if (food.type === "phase") {
      color = "#E056FD";
      glow = "#BD10E0";
      rune = "👻";
    }

    ctx.save();
    const pulse = 1 + Math.sin(now / 140) * 0.14;

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

    // Power-up inner rune
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowBlur = 4;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const runeSize = Math.max(9, Math.floor(radius * 0.95));
    ctx.font = `bold ${runeSize}px "JetBrains Mono", sans-serif`;
    ctx.fillText(rune, cx, cy);

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

    // Smooth movement interpolation factor between 0.0 and 1.0
    const alpha = Math.min(
      1,
      Math.max(0, state.moveTimerMs / Math.max(1, state.currentIntervalMs)),
    );

    // Chomp scale bounce when eating
    const chompScale =
      this.chompTimer > 0 ? 1 + Math.sin((this.chompTimer / 0.22) * Math.PI) * 0.25 : 1;

    for (let i = len - 1; i >= 0; i--) {
      const curr = state.snake[i]!;
      const prev = state.prevSnake[i] ?? curr;

      // Handle wrapping smoothly: if distance > 1.5 cells, don't interpolate across the screen
      let segX = curr.x;
      let segY = curr.y;
      if (Math.abs(curr.x - prev.x) <= 1.5 && Math.abs(curr.y - prev.y) <= 1.5) {
        segX = prev.x + (curr.x - prev.x) * alpha;
        segY = prev.y + (curr.y - prev.y) * alpha;
      }

      const cx = pad + (segX + 0.5) * cellW;
      const cy = pad + (segY + 0.5) * cellH;
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

      let size = Math.min(cellW, cellH) * (isHead ? 0.88 : 0.76 - ratio * 0.15);
      if (isHead) size *= chompScale;

      const r = size * 0.35;
      ctx.beginPath();
      ctx.roundRect(cx - size / 2, cy - size / 2, size, size, r);
      ctx.fill();

      // Dynamic eyes on head that track the food!
      if (isHead) {
        ctx.fillStyle = "#FFFFFF";
        ctx.shadowBlur = 4;
        const eyeOffset = size * 0.24;
        const eyeRadius = size * 0.13;

        let eye1X = cx;
        let eye1Y = cy;
        let eye2X = cx;
        let eye2Y = cy;

        if (state.dir.x === 1) {
          eye1X = cx + eyeOffset; eye1Y = cy - eyeOffset;
          eye2X = cx + eyeOffset; eye2Y = cy + eyeOffset;
        } else if (state.dir.x === -1) {
          eye1X = cx - eyeOffset; eye1Y = cy - eyeOffset;
          eye2X = cx - eyeOffset; eye2Y = cy + eyeOffset;
        } else if (state.dir.y === -1) {
          eye1X = cx - eyeOffset; eye1Y = cy - eyeOffset;
          eye2X = cx + eyeOffset; eye2Y = cy - eyeOffset;
        } else {
          eye1X = cx - eyeOffset; eye1Y = cy + eyeOffset;
          eye2X = cx + eyeOffset; eye2Y = cy + eyeOffset;
        }

        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, eyeRadius, 0, Math.PI * 2);
        ctx.arc(eye2X, eye2Y, eyeRadius, 0, Math.PI * 2);
        ctx.fill();

        // Eye pupils tracking the food
        let pupilDx = 0;
        let pupilDy = 0;
        if (state.food) {
          const fx = pad + (state.food.x + 0.5) * cellW;
          const fy = pad + (state.food.y + 0.5) * cellH;
          const angle = Math.atan2(fy - cy, fx - cx);
          pupilDx = Math.cos(angle) * (eyeRadius * 0.45);
          pupilDy = Math.sin(angle) * (eyeRadius * 0.45);
        }

        ctx.fillStyle = "#07080D";
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(eye1X + pupilDx, eye1Y + pupilDy, eyeRadius * 0.55, 0, Math.PI * 2);
        ctx.arc(eye2X + pupilDx, eye2Y + pupilDy, eyeRadius * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}
