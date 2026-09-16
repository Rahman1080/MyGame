import { synth } from "../../audio/synth";
import { hapticTap } from "../../audio/haptics";
import { recordHighScore } from "../../save/storage";
import type { SaveData } from "../../save/schema";
import {
  createBreakerGame,
  fireLaser,
  launchBall,
  movePaddle,
  recallBalls,
  setAim,
  setSpeedMultiplier,
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
  private freezeFrames = 0;
  private gameOverHandled = false;
  private isPointerAiming = false;

  constructor() {
    this.state = createBreakerGame(360, 480, 0);
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
            <div class="lvl" id="breaker-stage-txt" style="letter-spacing: 1px; color: #00F2FF;">STAGE 1 · ★★★</div>
            <div class="par">SCORE <b id="breaker-score">0</b> · BEST <b id="breaker-high">${this.state.highScore}</b></div>
            <div class="par-sub" id="breaker-status">STREAM: ⚽ 30 BALLS · READY</div>
          </div>
          <button class="icon-btn" data-act="pause" aria-label="Pause game">
            <span id="breaker-pause-txt">Pause</span>
          </button>
        </div>

        <div class="board-wrap" style="align-items: center; justify-content: center; position: relative;">
          <div id="breaker-flight-controls" style="position: absolute; top: 10px; right: 12px; display: none; gap: 8px; z-index: 10;">
            <button class="icon-btn sm" data-act="speed-btn" id="breaker-float-speed" title="Fast Forward (1x, 2x, 3x, 5x)" style="color: #FFD700; background: rgba(7, 8, 14, 0.9); backdrop-filter: blur(6px); font-weight: 800; border: 1.5px solid rgba(255, 215, 0, 0.6); padding: 5px 12px; border-radius: 20px; font-size: 12px; box-shadow: 0 0 12px rgba(255, 215, 0, 0.35); cursor: pointer;">⏩ 1x</button>
            <button class="icon-btn sm" data-act="recall-btn" id="breaker-float-recall" title="Recall all balls immediately" style="color: #00F2FF; background: rgba(7, 8, 14, 0.9); backdrop-filter: blur(6px); font-weight: 800; border: 1.5px solid rgba(0, 242, 255, 0.6); padding: 5px 12px; border-radius: 20px; font-size: 12px; box-shadow: 0 0 12px rgba(0, 242, 255, 0.35); cursor: pointer;">↩ Recall</button>
          </div>
          <canvas id="breaker-canvas" width="360" height="480" style="touch-action: none; border-radius: 10px; max-width: 94vw; max-height: 56vh; cursor: crosshair;"></canvas>
          <div id="breaker-gameover" class="overlay" style="display: none;">
            <div class="win-card">
              <h2>STAGE CLEARED</h2>
              <div class="win-meta" id="breaker-final-stats">SCORE: 0</div>
              <div class="win-actions">
                <button class="cta-play" data-act="restart">Play Again</button>
                <button class="ghost-btn" data-act="back">Return to Hub</button>
              </div>
            </div>
          </div>
        </div>

        <div class="dock" style="margin-top: 8px; display: flex; gap: 8px; justify-content: center; align-items: center;">
          <button class="icon-btn" data-act="speed-btn" id="breaker-speed-btn" title="Toggle Speed (1x, 2x, 3x, 5x)" style="min-width: 68px; font-weight: 700; color: #FFD700; border-color: rgba(255, 215, 0, 0.4); background: rgba(255, 215, 0, 0.08);">⏩ 1x</button>
          <button class="launch" data-act="action-btn" id="breaker-action-btn" style="flex: 1; max-width: 190px;">Drag to Aim & Fire</button>
          <button class="icon-btn" data-act="recall-btn" id="breaker-recall-btn" title="Recall all balls to floor" style="min-width: 78px; display: none; color: #00F2FF; border-color: rgba(0, 242, 255, 0.4); background: rgba(0, 242, 255, 0.08);">↩ Recall</button>
        </div>
        <div style="text-align: center; font-size: 11px; opacity: 0.65; margin-top: 4px; color: #E0E6ED;">
          Drag anywhere on board to aim trajectory · Release to fire · Tap ⏩ to speed up
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector<HTMLCanvasElement>("#breaker-canvas");
    if (this.canvas) {
      this.ctx = this.canvas.getContext("2d");
      this.resizeCanvas();
    }
  }

  private resizeCanvas(): void {
    if (!this.canvas || !this.ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const maxW = Math.min(360, Math.floor(window.innerWidth * 0.92));
    const maxH = Math.floor(window.innerHeight * 0.54);
    const aspect = 480 / 360;
    let w = maxW;
    let h = Math.floor(w * aspect);
    if (h > maxH) {
      h = maxH;
      w = Math.floor(h / aspect);
    }
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr * (w / 360), dpr * (h / 480));
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

        if (target.dataset.act === "speed-btn") {
          synth.tap();
          const speeds = [1, 2, 3, 5];
          const currIdx = speeds.indexOf(this.state.speedMultiplier);
          const nextSpeed = speeds[(currIdx + 1) % speeds.length] ?? 1;
          setSpeedMultiplier(this.state, nextSpeed);
          this.updateSpeedButtons(nextSpeed);
          return;
        }

        if (target.dataset.act === "recall-btn") {
          synth.tap();
          recallBalls(this.state);
          return;
        }

        if (target.dataset.act === "action-btn") {
          if (!this.state.launched) {
            synth.launch();
            launchBall(this.state, this.state.aimAngle);
          } else if (this.state.laserAmmo > 0) {
            synth.laser();
            fireLaser(this.state);
          }
        }
      },
      { signal },
    );

    // Responsive drag-to-aim and release-to-fire controls
    if (this.canvas) {
      const getCanvasCoords = (clientX: number, clientY: number) => {
        if (!this.canvas) return { x: 180, y: 240 };
        const rect = this.canvas.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 360;
        const y = ((clientY - rect.top) / rect.height) * 480;
        return { x, y };
      };

      const updateAimFromPointer = (clientX: number, clientY: number) => {
        if (this.state.launched) return;
        const { x, y } = getCanvasCoords(clientX, clientY);
        const dx = x - this.state.launcherX;
        const dy = y - this.state.launcherY;

        // Aim towards target when dragging anywhere on playfield
        if (dy < 0 || Math.abs(dx) > 10) {
          const angle = Math.atan2(dy, dx);
          setAim(this.state, angle);
        }
      };

      this.canvas.addEventListener(
        "pointerdown",
        (e) => {
          try {
            this.canvas?.setPointerCapture(e.pointerId);
          } catch {}

          if (!this.state.launched) {
            this.isPointerAiming = true;
            updateAimFromPointer(e.clientX, e.clientY);
          }
        },
        { signal },
      );

      this.canvas.addEventListener(
        "pointermove",
        (e) => {
          if (this.isPointerAiming && !this.state.launched) {
            updateAimFromPointer(e.clientX, e.clientY);
          }
        },
        { signal },
      );

      this.canvas.addEventListener(
        "pointerup",
        (e) => {
          try {
            this.canvas?.releasePointerCapture(e.pointerId);
          } catch {}

          if (this.isPointerAiming && !this.state.launched) {
            this.isPointerAiming = false;
            synth.launch();
            launchBall(this.state, this.state.aimAngle);
          }
        },
        { signal },
      );

      this.canvas.addEventListener(
        "pointercancel",
        () => {
          this.isPointerAiming = false;
        },
        { signal },
      );
    }

    // Keyboard controls
    window.addEventListener("keydown", this.handleKeyDown, { signal });
    window.addEventListener("keyup", this.handleKeyUp, { signal });
    window.addEventListener("resize", () => this.resizeCanvas(), { signal });
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.keysHeld[e.key] = true;

    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!this.state.launched) {
        synth.launch();
        launchBall(this.state, this.state.aimAngle);
      } else if (this.state.laserAmmo > 0) {
        synth.laser();
        fireLaser(this.state);
      }
    } else if (e.key === "r" || e.key === "R") {
      recallBalls(this.state);
    } else if (e.key === "s" || e.key === "S" || e.key === "f" || e.key === "F") {
      const speeds = [1, 2, 3, 5];
      const currIdx = speeds.indexOf(this.state.speedMultiplier);
      const nextSpeed = speeds[(currIdx + 1) % speeds.length] ?? 1;
      setSpeedMultiplier(this.state, nextSpeed);
      this.updateSpeedButtons(nextSpeed);
    }
  };

  private updateSpeedButtons(speed: number): void {
    const label = speed >= 5 ? "⚡ MAX" : `⏩ ${speed}x`;
    const speedBtn = this.container?.querySelector<HTMLButtonElement>("#breaker-speed-btn");
    const floatBtn = this.container?.querySelector<HTMLButtonElement>("#breaker-float-speed");
    if (speedBtn) speedBtn.textContent = label;
    if (floatBtn) floatBtn.textContent = label;
  }

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld[e.key] = false;
  };

  private restart(): void {
    const currentHigh =
      this.arcadeSave?.best ?? this.saveData?.arcadeHighScores?.["breaker"] ?? this.state.highScore;
    this.state = createBreakerGame(360, 480, currentHigh);
    this.gameOverHandled = false;
    const go = this.container?.querySelector<HTMLElement>("#breaker-gameover");
    if (go) go.style.display = "none";
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(60, now - this.lastTime);
      this.lastTime = now;

      if (this.freezeFrames > 0) {
        this.freezeFrames--;
        this.animId = requestAnimationFrame(loop);
        return;
      }

      // Keyboard aim steering
      if (this.keysHeld["ArrowLeft"] || this.keysHeld["a"] || this.keysHeld["A"]) {
        setAim(this.state, this.state.aimAngle - 1.8 * (dt / 1000));
      }
      if (this.keysHeld["ArrowRight"] || this.keysHeld["d"] || this.keysHeld["D"]) {
        setAim(this.state, this.state.aimAngle + 1.8 * (dt / 1000));
      }

      // Smooth paddle sync with launcher position
      movePaddle(this.state, this.state.launcherX);

      const events = tickBreaker(this.state, dt);

      if (events.ceilingHit) {
        this.renderer.emitCeilingSpark(events.ceilingHit.x, events.ceilingHit.y);
      }

      if (events.tntExplosions && events.tntExplosions.length > 0) {
        synth.explosion();
        hapticTap();
        for (const exp of events.tntExplosions) {
          this.renderer.emitTNTExplosion(exp.x, exp.y, exp.radius);
        }
      }

      if (events.laserBeams && events.laserBeams.length > 0) {
        synth.laser();
        hapticTap();
        for (const lb of events.laserBeams) {
          this.renderer.emitLaserCrossFX(lb.x, lb.y);
        }
      }

      if (events.splitterTriggered) {
        synth.star();
        this.renderer.emitSplitterFX(events.splitterTriggered.x, events.splitterTriggered.y);
      }

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
          this.renderer.triggerShake(4, 0.16);
          this.freezeFrames = 1;

          if (events.combo > 2 && events.combo % 4 === 0) {
            this.renderer.emitFloatingText(
              events.destroyedBrick.x + events.destroyedBrick.width / 2,
              events.destroyedBrick.y,
              `COMBO x${events.combo}!`,
              "#FFD700",
            );
          }
        }
      }

      if (events.orbCollected) {
        synth.star();
        hapticTap();
        if (events.orbCollected === "add_ball") {
          this.renderer.emitFloatingText(
            this.state.launcherX,
            this.state.launcherY - 24,
            "+1 BALL!",
            "#00FF66",
          );
        } else if (events.orbCollected === "laser_cross") {
          this.renderer.emitFloatingText(
            this.state.launcherX,
            this.state.launcherY - 24,
            "⚡ LASER BLAST!",
            "#FFD700",
          );
          this.renderer.triggerShake(6, 0.22);
        } else if (events.orbCollected === "bomb") {
          this.renderer.emitFloatingText(
            this.state.launcherX,
            this.state.launcherY - 24,
            "💥 BOMB EXPLODED!",
            "#FF3B30",
          );
          this.renderer.triggerShake(8, 0.28);
        }
      }

      if (events.waveCleared) {
        synth.success();
        this.checkSaveHighScore();
        this.renderer.emitFloatingText(180, 240, `STAGE ${this.state.wave} CLEARED!`, "#00FF66");
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

      // Update HUD elements
      const scoreEl = this.container?.querySelector("#breaker-score");
      const highEl = this.container?.querySelector("#breaker-high");
      const stageEl = this.container?.querySelector("#breaker-stage-txt");
      if (stageEl) {
        const stars = this.state.turnsTaken <= 2 ? "★★★" : this.state.turnsTaken <= 4 ? "★★☆" : "★☆☆";
        const pct = this.state.initialBricksInStage > 0
          ? Math.round((1 - this.state.bricks.length / this.state.initialBricksInStage) * 100)
          : 100;
        stageEl.textContent = `STAGE ${this.state.wave} · ${stars} (${pct}%)`;
      }
      const statusEl = this.container?.querySelector("#breaker-status");
      const actionBtn = this.container?.querySelector<HTMLButtonElement>("#breaker-action-btn");
      const recallBtn = this.container?.querySelector<HTMLButtonElement>("#breaker-recall-btn");

      if (scoreEl) scoreEl.textContent = this.state.score.toString();
      if (highEl) highEl.textContent = this.state.highScore.toString();
      if (statusEl) {
        if (!this.state.launched) {
          statusEl.textContent = `STREAM: ⚽ ${this.state.totalBalls} BALLS · READY TO AIM`;
        } else if (this.state.roundTimeSeconds > 5 && this.state.speedMultiplier === 1) {
          statusEl.textContent = `AIRBORNE: ${this.state.balls.length} · TAP ⏩ FOR FAST FORWARD!`;
        } else {
          statusEl.textContent = `AIRBORNE: ${this.state.balls.length} (⚡ ${this.state.speedMultiplier}x) · RETURNED: ${this.state.ballsReturned}`;
        }
      }

      if (actionBtn) {
        if (!this.state.launched) {
          actionBtn.textContent = "Drag to Aim & Fire";
          actionBtn.disabled = false;
        } else if (this.state.laserAmmo > 0) {
          actionBtn.textContent = `Fire Laser (${this.state.laserAmmo})`;
          actionBtn.disabled = false;
        } else {
          actionBtn.textContent = `Volley in Play (${this.state.speedMultiplier}x)...`;
          actionBtn.disabled = true;
        }
      }

      const flightControls = this.container?.querySelector<HTMLElement>("#breaker-flight-controls");
      if (flightControls) {
        flightControls.style.display = this.state.launched ? "flex" : "none";
      }

      if (recallBtn) {
        recallBtn.style.display = this.state.launched ? "inline-flex" : "none";
      }

      this.updateSpeedButtons(this.state.speedMultiplier);

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
