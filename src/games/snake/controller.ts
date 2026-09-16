import { synth } from "../../audio/synth";
import { hapticTap } from "../../audio/haptics";
import { recordHighScore } from "../../save/storage";
import type { SaveData } from "../../save/schema";
import {
  createSnakeGame,
  setDirection,
  tickSnake,
  type SnakeGameState,
} from "./engine";
import { SnakeRenderer } from "./render";

export class SnakeController {
  private state: SnakeGameState;
  private renderer: SnakeRenderer;
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animId = 0;
  private lastTime = 0;
  private touchStartX = 0;
  private touchStartY = 0;
  private onBack: (() => void) | null = null;
  private onSave: ((s: SaveData) => void) | null = null;
  private saveData: SaveData | null = null;

  constructor() {
    this.state = createSnakeGame(20, 20, 0);
    this.renderer = new SnakeRenderer();
  }

  mount(
    container: HTMLElement,
    onBack: () => void,
    saveData: SaveData,
    onSave: (s: SaveData) => void,
  ): void {
    this.container = container;
    this.onBack = onBack;
    this.saveData = saveData;
    this.onSave = onSave;

    const currentHigh = saveData.arcadeHighScores?.["snake"] ?? 0;
    this.state = createSnakeGame(20, 20, currentHigh);

    this.renderDom();
    this.setupListeners();
    this.startLoop();
  }

  private renderDom(): void {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="shell enter">
        <div class="hud">
          <button class="icon-btn" data-act="back" aria-label="Back to Arcade">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            <span>Hub</span>
          </button>
          <div class="center-meta">
            <div class="lvl">CYBER SNAKE</div>
            <div class="par">SCORE <b id="snake-score">0</b> · HIGH <b id="snake-high">${this.state.highScore}</b></div>
            <div class="par-sub" id="snake-multiplier">COMBO x1</div>
          </div>
          <button class="icon-btn" data-act="pause" aria-label="Pause game">
            <span id="pause-text">Pause</span>
          </button>
        </div>

        <div class="board-wrap" style="align-items: center; justify-content: center; position: relative;">
          <canvas id="snake-canvas" width="360" height="360" style="touch-action: none; border-radius: 12px; max-width: 92vw; max-height: 52vh;"></canvas>
          <div id="snake-gameover" class="overlay" style="display: none;">
            <div class="win-card">
              <h2>GAME OVER</h2>
              <div class="win-meta" id="final-stats">SCORE: 0</div>
              <div class="win-actions">
                <button class="cta-play" data-act="restart">Play Again</button>
                <button class="ghost-btn" data-act="back">Return to Hub</button>
              </div>
            </div>
          </div>
        </div>

        <!-- On-screen D-Pad for Touch/Mobile -->
        <div class="dpad-wrap" style="display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 12px;">
          <button class="dpad-btn" data-dir="up" aria-label="Up">▲</button>
          <div style="display: flex; gap: 20px;">
            <button class="dpad-btn" data-dir="left" aria-label="Left">◀</button>
            <button class="dpad-btn" data-dir="down" aria-label="Down">▼</button>
            <button class="dpad-btn" data-dir="right" aria-label="Right">▶</button>
          </div>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector<HTMLCanvasElement>("#snake-canvas");
    if (this.canvas) {
      this.ctx = this.canvas.getContext("2d");
      // Adjust resolution for Retina / DPI
      const dpr = window.devicePixelRatio || 1;
      const size = Math.min(360, Math.floor(window.innerWidth * 0.9));
      this.canvas.width = size * dpr;
      this.canvas.height = size * dpr;
      this.canvas.style.width = `${size}px`;
      this.canvas.style.height = `${size}px`;
      if (this.ctx) {
        this.ctx.scale(dpr, dpr);
      }
    }
  }

  private setupListeners(): void {
    if (!this.container) return;

    this.container.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-act], [data-dir]");
      if (!target) return;

      if (target.dataset.act === "back") {
        synth.tap();
        this.destroy();
        this.onBack?.();
        return;
      }

      if (target.dataset.act === "pause") {
        synth.tap();
        this.state.paused = !this.state.paused;
        const pauseSpan = this.container?.querySelector("#pause-text");
        if (pauseSpan) pauseSpan.textContent = this.state.paused ? "Resume" : "Pause";
        return;
      }

      if (target.dataset.act === "restart") {
        synth.tap();
        this.restart();
        return;
      }

      const dir = target.dataset.dir;
      if (dir) {
        synth.step();
        hapticTap();
        if (dir === "up") setDirection(this.state, { x: 0, y: -1 });
        if (dir === "down") setDirection(this.state, { x: 0, y: 1 });
        if (dir === "left") setDirection(this.state, { x: -1, y: 0 });
        if (dir === "right") setDirection(this.state, { x: 1, y: 0 });
      }
    });

    // Touch swipe gestures
    if (this.canvas) {
      this.canvas.addEventListener("touchstart", (e) => {
        const touch = e.touches[0];
        if (!touch) return;
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
      }, { passive: true });

      this.canvas.addEventListener("touchend", (e) => {
        const touch = e.changedTouches[0];
        if (!touch) return;
        const dx = touch.clientX - this.touchStartX;
        const dy = touch.clientY - this.touchStartY;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (Math.max(absX, absY) > 24) {
          synth.step();
          hapticTap();
          if (absX > absY) {
            setDirection(this.state, { x: dx > 0 ? 1 : -1, y: 0 });
          } else {
            setDirection(this.state, { x: 0, y: dy > 0 ? 1 : -1 });
          }
        }
      }, { passive: true });
    }

    // Keyboard controls
    window.addEventListener("keydown", this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
      e.preventDefault();
      setDirection(this.state, { x: 0, y: -1 });
    } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
      e.preventDefault();
      setDirection(this.state, { x: 0, y: 1 });
    } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      e.preventDefault();
      setDirection(this.state, { x: -1, y: 0 });
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      e.preventDefault();
      setDirection(this.state, { x: 1, y: 0 });
    } else if (e.key === " ") {
      e.preventDefault();
      this.state.paused = !this.state.paused;
      const pauseSpan = this.container?.querySelector("#pause-text");
      if (pauseSpan) pauseSpan.textContent = this.state.paused ? "Resume" : "Pause";
    }
  };

  private restart(): void {
    const currentHigh = this.saveData?.arcadeHighScores?.["snake"] ?? this.state.highScore;
    this.state = createSnakeGame(20, 20, currentHigh);
    const go = this.container?.querySelector<HTMLElement>("#snake-gameover");
    if (go) go.style.display = "none";
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(60, now - this.lastTime);
      this.lastTime = now;

      const res = tickSnake(this.state, dt);

      if (res.moved && !res.ateFood && !res.died) {
        // Optional subtle step sound
      }

      if (res.ateFood) {
        if (res.foodType === "multiplier" || res.foodType === "phase" || res.foodType === "slowmo") {
          synth.powerup();
        } else {
          synth.combo();
        }
        hapticTap();
        // Emit particles
        const head = this.state.snake[0];
        if (head && this.canvas) {
          const rect = this.canvas.getBoundingClientRect();
          const cellW = (rect.width - 24) / this.state.width;
          const cellH = (rect.height - 24) / this.state.height;
          const px = 12 + (head.x + 0.5) * cellW;
          const py = 12 + (head.y + 0.5) * cellH;
          this.renderer.emitFoodBurst(px, py, "#00F2FF", 14);
        }
      }

      if (res.died) {
        synth.gameover();
        if (this.saveData && this.onSave) {
          const updated = recordHighScore(this.saveData, "snake", this.state.score);
          this.saveData = updated;
          this.onSave(updated);
        }
        const go = this.container?.querySelector<HTMLElement>("#snake-gameover");
        const stats = this.container?.querySelector<HTMLElement>("#final-stats");
        if (go) go.style.display = "flex";
        if (stats) stats.textContent = `SCORE: ${this.state.score} · BEST: ${this.state.highScore}`;
      }

      // Update HUD
      const scoreEl = this.container?.querySelector("#snake-score");
      const highEl = this.container?.querySelector("#snake-high");
      const multEl = this.container?.querySelector("#snake-multiplier");
      if (scoreEl) scoreEl.textContent = this.state.score.toString();
      if (highEl) highEl.textContent = this.state.highScore.toString();
      if (multEl) {
        if (this.state.activePowerUp) {
          multEl.textContent = `⚡ ${this.state.activePowerUp.type.toUpperCase()} (${(this.state.activePowerUp.remainingMs / 1000).toFixed(1)}s)`;
        } else if (this.state.combo > 1) {
          multEl.textContent = `COMBO x${this.state.combo}`;
        } else {
          multEl.textContent = "COLLECT POWER ORBS";
        }
      }

      // Render canvas
      if (this.ctx && this.canvas) {
        const dpr = window.devicePixelRatio || 1;
        const w = this.canvas.width / dpr;
        const h = this.canvas.height / dpr;
        this.renderer.updateParticles(dt / 1000);
        this.renderer.render(this.ctx, this.state, w, h, now);
      }

      this.animId = requestAnimationFrame(loop);
    };

    this.animId = requestAnimationFrame(loop);
  }

  destroy(): void {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = 0;
    }
    window.removeEventListener("keydown", this.handleKeyDown);
    if (this.container) {
      this.container.innerHTML = "";
    }
  }
}
