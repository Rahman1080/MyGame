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
  private keysHeld: Record<string, boolean> = {};
  private onBack: (() => void) | null = null;
  private onSave: ((s: SaveData) => void) | null = null;
  private saveData: SaveData | null = null;
  private arcadeSave: { best: number } | null = null;
  private onArcadeSave: ((s: { best: number }) => void) | null = null;
  private abortController: AbortController | null = null;
  private targetPaddleCenterX: number;
  private freezeFrames = 0;
  private gameOverHandled = false;

  constructor() {
    this.state = createBreakerGame(360, 480, 0);
    this.targetPaddleCenterX = 180;
    this.renderer = new BreakerRenderer();
  }

  mountArcade(
    container: HTMLElement,
    onBack: () => void,
    save: { best: number },
    onSave: (s: { best: number }) => void,
  ): void {
    this.container = container;
    this.onBack = onBack;
    this.arcadeSave = save;
    this.onArcadeSave = onSave;
    this.gameOverHandled = false;
    this.state = createBreakerGame(360, 480, save.best ?? 0);
    this.targetPaddleCenterX = this.state.paddleX + this.state.paddleWidth / 2;
    this.renderDom();
    this.setupListeners();
    this.startLoop();
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
    this.targetPaddleCenterX = this.state.paddleX + this.state.paddleWidth / 2;

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
            <div class="par-sub" id="breaker-status">WAVE 1 · LIVES: ❤️❤️❤️</div>
          </div>
          <button class="icon-btn" data-act="pause" aria-label="Pause game">
            <span id="breaker-pause-txt">Pause</span>
          </button>
        </div>

        <div class="board-wrap" style="align-items: center; justify-content: center; position: relative;">
          <canvas id="breaker-canvas" width="360" height="480" style="touch-action: none; border-radius: 10px; max-width: 94vw; max-height: 56vh; cursor: ew-resize;"></canvas>
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

  private checkSaveHighScore(): void {
    if (this.state.score > this.state.highScore) {
      this.state.highScore = this.state.score;
    }
    if (this.arcadeSave && this.onArcadeSave) {
      if (this.state.score > this.arcadeSave.best) {
        this.arcadeSave.best = this.state.score;
        this.onArcadeSave({ best: this.arcadeSave.best });
      }
    } else if (this.saveData && this.onSave) {
      const updated = recordHighScore(this.saveData, "breaker", this.state.score);
      this.saveData = updated;
      this.onSave(updated);
    }
  }

  private setupListeners(): void {
    if (!this.container) return;
    this.abortController?.abort();
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    this.container.addEventListener(
      "click",
      (e) => {
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
      },
      { signal },
    );

    // Continuous pointer tracking across canvas with pointer capture
    if (this.canvas) {
      const handlePointer = (clientX: number): void => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const normX = (clientX - rect.left) / rect.width;
        this.targetPaddleCenterX = normX * 360;
      };

      this.canvas.addEventListener(
        "pointerdown",
        (e) => {
          try {
            this.canvas?.setPointerCapture(e.pointerId);
          } catch {
            // Ignore if pointer capture fails
          }
          handlePointer(e.clientX);
          if (!this.state.launched) {
            synth.launch();
            launchBall(this.state);
          }
        },
        { signal },
      );

      this.canvas.addEventListener(
        "pointermove",
        (e) => {
          handlePointer(e.clientX);
        },
        { signal },
      );
    }

    // Keyboard controls
    window.addEventListener("keydown", this.handleKeyDown, { signal });
    window.addEventListener("keyup", this.handleKeyUp, { signal });
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
    const currentHigh =
      this.arcadeSave?.best ?? this.saveData?.arcadeHighScores?.["breaker"] ?? this.state.highScore;
    this.state = createBreakerGame(360, 480, currentHigh);
    this.targetPaddleCenterX = this.state.paddleX + this.state.paddleWidth / 2;
    this.gameOverHandled = false;
    const go = this.container?.querySelector<HTMLElement>("#breaker-gameover");
    if (go) go.style.display = "none";
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(60, now - this.lastTime);
      this.lastTime = now;

      // Hit-stop / Freeze frames for heavy impacts
      if (this.freezeFrames > 0) {
        this.freezeFrames--;
        this.animId = requestAnimationFrame(loop);
        return;
      }

      // Keyboard paddle steering
      if (this.keysHeld["ArrowLeft"] || this.keysHeld["a"] || this.keysHeld["A"]) {
        this.targetPaddleCenterX = Math.max(
          this.state.paddleWidth / 2,
          this.targetPaddleCenterX - 450 * (dt / 1000),
        );
      }
      if (this.keysHeld["ArrowRight"] || this.keysHeld["d"] || this.keysHeld["D"]) {
        this.targetPaddleCenterX = Math.min(
          360 - this.state.paddleWidth / 2,
          this.targetPaddleCenterX + 450 * (dt / 1000),
        );
      }

      // Smooth paddle lerp
      const currentCenterX = this.state.paddleX + this.state.paddleWidth / 2;
      const smoothCenterX = currentCenterX + (this.targetPaddleCenterX - currentCenterX) * 0.42;
      movePaddle(this.state, smoothCenterX, dt / 1000);

      const events = tickBreaker(this.state, dt);

      if (events.brickHit) {
        synth.bounce();
        hapticTap();
      }
      if (events.paddleHit) {
        synth.step();
      }
      if (events.brickDestroyed) {
        this.checkSaveHighScore();
        if (events.destroyedBrick) {
          this.renderer.emitBrickShatter(events.destroyedBrick);
          this.renderer.triggerShake(5, 0.18);
          this.freezeFrames = 1;

          if (events.combo > 1) {
            this.renderer.emitFloatingText(
              events.destroyedBrick.x + events.destroyedBrick.width / 2,
              events.destroyedBrick.y,
              `COMBO x${events.combo}!`,
              "#FFD700",
            );
          }
        }
      }
      if (events.waveCleared) {
        synth.star();
        this.checkSaveHighScore();
      }
      if (events.lostLife) {
        synth.fail();
        this.renderer.triggerShake(9, 0.35);
      }

      if (this.state.gameOver && !this.gameOverHandled) {
        this.gameOverHandled = true;
        synth.gameover();
        this.checkSaveHighScore();
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
      if (statusEl) {
        const comboBadge = this.state.combo > 1 ? ` · ⚡ COMBO x${this.state.combo}` : "";
        statusEl.textContent = `WAVE ${this.state.wave} · LIVES: ${"❤️".repeat(Math.max(0, this.state.lives))}${comboBadge}`;
      }

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

      // Render canvas
      if (this.ctx && this.canvas) {
        this.renderer.update(dt / 1000, this.state);
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
    this.abortController?.abort();
    this.abortController = null;
    if (this.container) {
      this.container.innerHTML = "";
    }
  }
}
