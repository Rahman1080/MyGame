import { synth } from "../../audio/synth";
import { hapticTap } from "../../audio/haptics";
import { recordHighScore } from "../../save/storage";
import type { SaveData } from "../../save/schema";
import {
  createSnakeGame,
  setDirection,
  setSpeedMode,
  tickSnake,
  type SnakeGameState,
  type SpeedMode,
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
  private arcadeSave: { best: number } | null = null;
  private onArcadeSave: ((s: { best: number }) => void) | null = null;
  private abortController: AbortController | null = null;

  constructor() {
    this.state = createSnakeGame(20, 20, 0, "normal");
    this.renderer = new SnakeRenderer();
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
    this.state = createSnakeGame(20, 20, save.best ?? 0, "normal");
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

    const currentHigh = saveData.arcadeHighScores?.["snake"] ?? 0;
    this.state = createSnakeGame(20, 20, currentHigh, "normal");

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

        <div style="display: flex; justify-content: center; margin: 2px 0 6px;">
          <button class="ghost-btn" data-act="speed" id="snake-speed-btn" style="padding: 4px 14px; font-size: 11px; font-weight: 700; border: 1px solid rgba(41,221,244,0.35); border-radius: 14px; background: rgba(11,15,25,0.7); color: #29ddf4; cursor: pointer; letter-spacing: 0.05em;">
            SPEED: ${this.state.speedMode.toUpperCase()}
          </button>
        </div>

        <div class="board-wrap" style="align-items: center; justify-content: center; position: relative;">
          <canvas id="snake-canvas" width="360" height="360" style="touch-action: none; border-radius: 12px; max-width: 92vw; max-height: 50vh;"></canvas>
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
        <div class="dpad-wrap" style="display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 10px;">
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
      const updated = recordHighScore(this.saveData, "snake", this.state.score);
      this.saveData = updated;
      this.onSave(updated);
    }
  }

  private setupListeners(): void {
    if (!this.container) return;
    this.abortController?.abort();
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    // Instant pointerdown for D-pad buttons
    this.container.addEventListener(
      "pointerdown",
      (e) => {
        const target = (e.target as HTMLElement).closest<HTMLElement>("[data-dir]");
        if (!target) return;
        const dir = target.dataset.dir;
        if (dir) {
          synth.step();
          hapticTap();
          if (dir === "up") setDirection(this.state, { x: 0, y: -1 });
          if (dir === "down") setDirection(this.state, { x: 0, y: 1 });
          if (dir === "left") setDirection(this.state, { x: -1, y: 0 });
          if (dir === "right") setDirection(this.state, { x: 1, y: 0 });
        }
      },
      { signal },
    );

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

        if (target.dataset.act === "speed") {
          synth.tap();
          const modes: SpeedMode[] = ["chill", "normal", "hyper"];
          const curIdx = modes.indexOf(this.state.speedMode);
          const nextMode = modes[(curIdx + 1) % modes.length]!;
          setSpeedMode(this.state, nextMode);
          const btn = this.container?.querySelector("#snake-speed-btn");
          if (btn) btn.textContent = `SPEED: ${nextMode.toUpperCase()}`;
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
      },
      { signal },
    );

    // Responsive touch swipe gestures (triggers immediately during drag)
    if (this.canvas) {
      this.canvas.addEventListener(
        "touchstart",
        (e) => {
          const touch = e.touches[0];
          if (!touch) return;
          this.touchStartX = touch.clientX;
          this.touchStartY = touch.clientY;
        },
        { passive: true, signal },
      );

      this.canvas.addEventListener(
        "touchmove",
        (e) => {
          const touch = e.touches[0];
          if (!touch) return;
          const dx = touch.clientX - this.touchStartX;
          const dy = touch.clientY - this.touchStartY;
          const absX = Math.abs(dx);
          const absY = Math.abs(dy);

          if (Math.max(absX, absY) > 18) {
            synth.step();
            hapticTap();
            if (absX > absY) {
              setDirection(this.state, { x: dx > 0 ? 1 : -1, y: 0 });
            } else {
              setDirection(this.state, { x: 0, y: dy > 0 ? 1 : -1 });
            }
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
          }
        },
        { passive: true, signal },
      );
    }

    // Keyboard controls
    window.addEventListener("keydown", this.handleKeyDown, { signal });
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
    const currentHigh =
      this.arcadeSave?.best ?? this.saveData?.arcadeHighScores?.["snake"] ?? this.state.highScore;
    const mode = this.state.speedMode;
    this.state = createSnakeGame(20, 20, currentHigh, mode);
    const go = this.container?.querySelector<HTMLElement>("#snake-gameover");
    if (go) go.style.display = "none";
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(60, now - this.lastTime);
      this.lastTime = now;

      const res = tickSnake(this.state, dt);

      if (res.ateFood) {
        this.renderer.triggerChomp();
        synth.combo();
        hapticTap();
        this.checkSaveHighScore();

        // Spawn particles and score text popup
        if (this.canvas) {
          const dpr = window.devicePixelRatio || 1;
          const w = this.canvas.width / dpr;
          const h = this.canvas.height / dpr;
          const cellW = w / this.state.width;
          const cellH = h / this.state.height;
          const px = ((res.ateX ?? 0) + 0.5) * cellW;
          const py = ((res.ateY ?? 0) + 0.5) * cellH;

          const color =
            res.foodType === "multiplier"
              ? "#FFD700"
              : res.foodType === "slowmo"
                ? "#29DDF4"
                : res.foodType === "phase"
                  ? "#E45CFF"
                  : "#00F2FF";

          this.renderer.emitFoodBurst(px, py, color, 16);

          const popupText =
            res.foodType && res.foodType !== "energy"
              ? `+${res.scoreGained} ${res.foodType.toUpperCase()}!`
              : `+${res.scoreGained}${res.combo && res.combo > 1 ? " x" + res.combo : ""}`;

          this.renderer.emitScorePopup(px, py, popupText, color);
        }
      }

      if (res.won) {
        synth.star();
        this.renderer.triggerShake(12, 0.5);
        this.checkSaveHighScore();
        const go = this.container?.querySelector<HTMLElement>("#snake-gameover");
        const stats = this.container?.querySelector<HTMLElement>("#final-stats");
        const title = this.container?.querySelector<HTMLElement>("#snake-gameover h2");
        if (go) go.style.display = "flex";
        if (title) title.textContent = "VICTORY! BOARD CLEARED!";
        if (stats) stats.textContent = `SCORE: ${this.state.score} · BEST: ${this.state.highScore}`;
      } else if (res.died) {
        synth.gameover();
        this.renderer.triggerShake(10, 0.35);
        this.checkSaveHighScore();
        const go = this.container?.querySelector<HTMLElement>("#snake-gameover");
        const stats = this.container?.querySelector<HTMLElement>("#final-stats");
        const title = this.container?.querySelector<HTMLElement>("#snake-gameover h2");
        if (go) go.style.display = "flex";
        if (title) title.textContent = "GAME OVER";
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
        this.renderer.update(dt / 1000);
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
    this.abortController?.abort();
    this.abortController = null;
    if (this.container) {
      this.container.innerHTML = "";
    }
  }
}
