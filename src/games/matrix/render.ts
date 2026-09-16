import type { MatrixGameState } from "./engine";

interface TileTheme {
  bg: string;
  glow: string;
  text: string;
  shadowBlur: number;
}

const TILE_THEMES: Record<number, TileTheme> = {
  2: { bg: "#0d2838", glow: "#00F2FF", text: "#00F2FF", shadowBlur: 6 },
  4: { bg: "#133550", glow: "#29DDF4", text: "#FFFFFF", shadowBlur: 8 },
  8: { bg: "#281b45", glow: "#9900FF", text: "#E0Aaff", shadowBlur: 10 },
  16: { bg: "#42184d", glow: "#D050FF", text: "#FFFFFF", shadowBlur: 12 },
  32: { bg: "#4d1d2b", glow: "#FF007F", text: "#FFFFFF", shadowBlur: 12 },
  64: { bg: "#5a1f26", glow: "#FF3366", text: "#FFFFFF", shadowBlur: 14 },
  128: { bg: "#523714", glow: "#FF9900", text: "#FFE5B4", shadowBlur: 16 },
  256: { bg: "#5c4811", glow: "#FFD700", text: "#FFFFFF", shadowBlur: 18 },
  512: { bg: "#16472b", glow: "#00FF66", text: "#E0FFED", shadowBlur: 20 },
  1024: { bg: "#144955", glow: "#00E5FF", text: "#FFFFFF", shadowBlur: 22 },
  2048: { bg: "#591c5c", glow: "#FF00FF", text: "#FFFFFF", shadowBlur: 26 },
};

export interface MatrixParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface MatrixFloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface TileAnim {
  type: "spawn" | "merge";
  r: number;
  c: number;
  timer: number;
  duration: number;
}

export class MatrixRenderer {
  private particles: MatrixParticle[] = [];
  private floatingTexts: MatrixFloatingText[] = [];
  private animations: TileAnim[] = [];
  private shakeTimer = 0;
  private shakeIntensity = 0;

  triggerShake(intensity = 8, duration = 0.3): void {
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
  }

  triggerSpawn(r: number, c: number): void {
    this.animations.push({
      type: "spawn",
      r,
      c,
      timer: 0,
      duration: 0.18,
    });
  }

  triggerMerge(r: number, c: number, val: number, x: number, y: number): void {
    this.animations.push({
      type: "merge",
      r,
      c,
      timer: 0,
      duration: 0.22,
    });

    const theme = TILE_THEMES[val] ?? { glow: "#FF00FF" };
    // Floating score popup
    this.floatingTexts.push({
      x,
      y,
      text: `+${val}`,
      color: theme.glow,
      life: 0,
      maxLife: 0.75,
    });

    // Particle sparkles
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.4;
      const speed = 30 + Math.random() * 60;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: theme.glow,
        size: 2 + Math.random() * 2,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.2,
      });
    }
  }

  update(dtSeconds: number): void {
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dtSeconds);
    }

    // Tile animations
    for (let i = this.animations.length - 1; i >= 0; i--) {
      const a = this.animations[i]!;
      a.timer += dtSeconds;
      if (a.timer >= a.duration) {
        this.animations.splice(i, 1);
      }
    }

    // Floating text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i]!;
      ft.life += dtSeconds;
      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.y -= 24 * dtSeconds;
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
  }

  render(
    ctx: CanvasRenderingContext2D,
    state: MatrixGameState,
    width: number,
    height: number,
  ): void {
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Deep neon background
    ctx.fillStyle = "#07080D";
    ctx.fillRect(0, 0, width, height);

    // Screen shake
    if (this.shakeTimer > 0) {
      const currentIntensity = this.shakeIntensity * (this.shakeTimer / 0.3);
      const ox = (Math.random() - 0.5) * 2 * currentIntensity;
      const oy = (Math.random() - 0.5) * 2 * currentIntensity;
      ctx.translate(ox, oy);
    }

    const pad = 12;
    const size = Math.min(width, height) - pad * 2;
    const startX = (width - size) / 2;
    const startY = (height - size) / 2;

    // Grid container frame
    ctx.save();
    ctx.fillStyle = "#0b0f19";
    ctx.strokeStyle = "rgba(41, 221, 244, 0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(startX, startY, size, size, 12);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const gap = 8;
    const cellSize = (size - gap * (state.size + 1)) / state.size;

    // Empty cell slots
    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        const x = startX + gap + c * (cellSize + gap);
        const y = startY + gap + r * (cellSize + gap);
        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        ctx.beginPath();
        ctx.roundRect(x, y, cellSize, cellSize, 8);
        ctx.fill();
      }
    }

    // Filled tiles
    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        const val = state.grid[r]?.[c];
        if (val === null || val === undefined) continue;

        const x = startX + gap + c * (cellSize + gap);
        const y = startY + gap + r * (cellSize + gap);
        const cx = x + cellSize / 2;
        const cy = y + cellSize / 2;

        // Check scale animations
        let scale = 1;
        for (const anim of this.animations) {
          if (anim.r === r && anim.c === c) {
            const p = anim.timer / anim.duration;
            if (anim.type === "spawn") {
              // Spawn bounce: 0 -> 1.1 -> 1.0
              scale = p < 0.7 ? (p / 0.7) * 1.1 : 1.1 - ((p - 0.7) / 0.3) * 0.1;
            } else if (anim.type === "merge") {
              // Merge pop: 1.22 -> 1.0
              scale = 1 + Math.sin(p * Math.PI) * 0.22;
            }
          }
        }

        const theme = TILE_THEMES[val] ?? {
          bg: "#441144",
          glow: "#FF00FF",
          text: "#FFFFFF",
          shadowBlur: 24,
        };

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);

        ctx.fillStyle = theme.bg;
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = theme.shadowBlur;
        ctx.beginPath();
        ctx.roundRect(x, y, cellSize, cellSize, 8);
        ctx.fill();

        // Neon border outline
        ctx.strokeStyle = theme.glow;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Text value
        ctx.fillStyle = theme.text;
        ctx.shadowBlur = 4;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const fontSize =
          val < 100 ? cellSize * 0.46 : val < 1000 ? cellSize * 0.38 : cellSize * 0.3;
        ctx.font = `bold ${Math.floor(fontSize)}px "JetBrains Mono", monospace`;
        ctx.fillText(val.toString(), cx, cy);

        ctx.restore();
      }
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

    // Floating texts
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
      ctx.font = `bold ${Math.floor(14 * scale)}px "JetBrains Mono", monospace`;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore();
  }
}
