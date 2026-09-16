import { synth } from "../../audio/synth";
import { hapticTap } from "../../audio/haptics";
import { recordHighScore } from "../../save/storage";
import type { SaveData } from "../../save/schema";
import {
  createBreakerGame,
  fireLaser,
  launchBall,
  movePaddle,
  tickBreaker,
  type BreakerGameState,
} from "./engine";
import { BreakerRenderer } from "./render";

export class BreakerController {
  private state: BreakerGameState;
  private renderer: BreakerRenderer;
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animId = 0;
  private lastTime = 0;
  private onBack: (() => void) | null = null;
  private onSave: ((s: SaveData) => void) | null = null;
  private saveData: SaveData | null = null;
  private keysHeld: Record<string, boolean> = {};

  constructor() {
    this.state = createBreakerGame(360, 480, 0);
    this.renderer = new BreakerRenderer();
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

    const currentHigh = saveData.arcadeHighScores?.["breaker"] ?? 0;
    this.state = createBreakerGame(360, 480, currentHigh);

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
            <div class="lvl">NEON BREAKER</div>
            <div class="par">SCORE <b id="breaker-score">0</b> · HIGH <b id="breaker-high">${this.state.highScore}</b></div>
            <div class="par-sub" id="breaker-status">WAVE 1 · LIVES: 3</div>
          </div>
          <button class="icon-btn" data-act="pause" aria-label="Pause game">
            <span id="breaker-pause-txt">Pause</span>
          </button>
        </div>

        <div class="board-wrap" style="align-items: center; justify-content: center; position: relative;">
          <canvas id="breaker-canvas" width="360" height="480" style="touch-action: none; border-radius: 12px; max-width: 92vw; max-height: 58vh;"></canvas>
          <div id="breaker-gameover" class="overlay" style="display: none;">
            <div class="win-card">
              <h2>GAME OVER</h2>
              <div class="win-meta" id="breaker-final-stats">SCORE: 0</div>
              <div class="win-actions">
                <button class="cta-play" data-act="restart">Play Again</button>
                <button class="ghost-btn" data-act="back">Return to Hub</button>
              </div>
            </div>
          </div>
        </div>

        <div class="dock" style="margin-top: 8px;">
          <button class="launch" data-act="action-btn" id="breaker-action-btn">Launch Ball</button>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector<HTMLCanvasElement>("#breaker-canvas");
    if (this.canvas) {
      this.ctx = this.canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      const w = Math.min(360, Math.floor(window.innerWidth * 0.92));
      const h = Math.floor(w * (480 / 360));
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
      if (this.ctx) {
        this.ctx.scale(dpr * (w / 360), dpr * (h / 480));
      }
    }
  }

  private setupListeners(): void {
    if (!this.container) return;

    this.container.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
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
        const txt = this.container?.querySelector("#breaker-pause-txt");
        if (txt) txt.textContent = this.state.paused ? "Resume" : "Pause";
        return;
      }

      if (target.dataset.act === "restart") {
        synth.tap();
        this.restart();
        return;
      }

      if (target.dataset.act === "action-btn") {
        if (!this.state.launched) {
          synth.launch();
          launchBall(this.state);
        } else if (this.state.laserAmmo > 0) {
          synth.laser();
          fireLaser(this.state);
        }
      }
    });

    // Pointer / touch steering on canvas
    if (this.canvas) {
      const handlePointer = (clientX: number): void => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const normX = (clientX - rect.left) / rect.width;
        movePaddle(this.state, normX * 360);
      };

      this.canvas.addEventListener("pointerdown", (e) => {
        handlePointer(e.clientX);
        if (!this.state.launched) {
          synth.launch();
          launchBall(this.state);
        } else if (this.state.laserAmmo > 0) {
          synth.laser();
          fireLaser(this.state);
        }
      });

      this.canvas.addEventListener("pointermove", (e) => {
        if (e.buttons > 0 || !this.state.launched) {
          handlePointer(e.clientX);
        }
      });
    }

    // Keyboard controls
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.keysHeld[e.key] = true;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!this.state.launched) {
        synth.launch();
        launchBall(this.state);
      } else if (this.state.laserAmmo > 0) {
        synth.laser();
        fireLaser(this.state);
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld[e.key] = false;
  };

  private restart(): void {
    const currentHigh = this.saveData?.arcadeHighScores?.["breaker"] ?? this.state.highScore;
    this.state = createBreakerGame(360, 480, currentHigh);
    const go = this.container?.querySelector<HTMLElement>("#breaker-gameover");
    if (go) go.style.display = "none";
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(48, now - this.lastTime);
      this.lastTime = now;

      // Handle paddle key movement
      if (this.keysHeld["ArrowLeft"] || this.keysHeld["a"] || this.keysHeld["A"]) {
        movePaddle(this.state, this.state.paddleX + this.state.paddleWidth / 2 - 8);
      }
      if (this.keysHeld["ArrowRight"] || this.keysHeld["d"] || this.keysHeld["D"]) {
        movePaddle(this.state, this.state.paddleX + this.state.paddleWidth / 2 + 8);
      }

      const events = tickBreaker(this.state, dt);

      if (events.paddleHit || events.wallHit) {
        synth.bounce();
      }
      if (events.brickHit) {
        synth.step();
      }
      if (events.brickDestroyed && events.destroyedBrick) {
        synth.explosion();
        hapticTap();
        this.renderer.emitBrickShatter(events.destroyedBrick);
      }
      if (events.powerUpCollected) {
        synth.powerup();
      }
      if (events.waveCleared) {
        synth.star();
      }
      if (events.lostLife) {
        synth.fail();
      }

      if (this.state.gameOver) {
        synth.gameover();
        if (this.saveData && this.onSave) {
          const updated = recordHighScore(this.saveData, "breaker", this.state.score);
          this.saveData = updated;
          this.onSave(updated);
        }
        const go = this.container?.querySelector<HTMLElement>("#breaker-gameover");
        const stats = this.container?.querySelector<HTMLElement>("#breaker-final-stats");
        if (go) go.style.display = "flex";
        if (stats) stats.textContent = `SCORE: ${this.state.score} · BEST: ${this.state.highScore}`;
      }

      // Update HUD & Action button
      const scoreEl = this.container?.querySelector("#breaker-score");
      const highEl = this.container?.querySelector("#breaker-high");
      const statusEl = this.container?.querySelector("#breaker-status");
      const actionBtn = this.container?.querySelector<HTMLButtonElement>("#breaker-action-btn");
      if (scoreEl) scoreEl.textContent = this.state.score.toString();
      if (highEl) highEl.textContent = this.state.highScore.toString();
      if (statusEl) statusEl.textContent = `WAVE ${this.state.wave} · LIVES: ${"❤️".repeat(Math.max(0, this.state.lives))}`;

      if (actionBtn) {
        if (!this.state.launched) {
          actionBtn.textContent = "Launch Ball";
          actionBtn.disabled = false;
        } else if (this.state.laserAmmo > 0) {
          actionBtn.textContent = `Fire Laser (${this.state.laserAmmo})`;
          actionBtn.disabled = false;
        } else {
          actionBtn.textContent = "Playing...";
          actionBtn.disabled = true;
        }
      }

      // Render
      if (this.ctx && this.canvas) {
        this.renderer.updateParticles(dt / 1000);
        this.renderer.render(this.ctx, this.state, 360, 480, now);
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
    window.removeEventListener("keyup", this.handleKeyUp);
    if (this.container) {
      this.container.innerHTML = "";
    }
  }
}
