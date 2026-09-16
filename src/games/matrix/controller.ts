import { synth } from "../../audio/synth";
import { hapticTap } from "../../audio/haptics";
import { recordHighScore } from "../../save/storage";
import type { SaveData } from "../../save/schema";
import {
  createMatrixGame,
  moveMatrix,
  undoMatrix,
  type MatrixDirection,
  type MatrixGameState,
} from "./engine";
import { MatrixRenderer } from "./render";

export class MatrixController {
  private state: MatrixGameState;
  private renderer: MatrixRenderer;
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private onBack: (() => void) | null = null;
  private onSave: ((s: SaveData) => void) | null = null;
  private saveData: SaveData | null = null;

  constructor() {
    this.state = createMatrixGame(4, 0);
    this.renderer = new MatrixRenderer();
  }

  mountArcade(
    container: HTMLElement,
    onBack: () => void,
    save: { best: number },
    onSave: (s: { best: number }) => void,
  ): void {
    this.container = container;
    this.onBack = onBack;
    this.state = createMatrixGame(4, save.best ?? 0);
    this.renderDom();
    this.setupListeners();
    this.onSave = () => {
      if (this.state.score > save.best) {
        save.best = this.state.score;
        onSave({ best: save.best });
      }
    };
    this.paint();
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

    const currentHigh = saveData.arcadeHighScores?.["matrix"] ?? 0;
    this.state = createMatrixGame(4, currentHigh);

    this.renderDom();
    this.setupListeners();
    this.paint();
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
            <div class="lvl">CYBER 2048</div>
            <div class="par">SCORE <b id="matrix-score">0</b> · HIGH <b id="matrix-high">${this.state.highScore}</b></div>
            <div class="par-sub">SYNTHESIZE TILES TO 2048</div>
          </div>
          <button class="icon-btn" data-act="undo" aria-label="Undo move">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
            <span>Undo</span>
          </button>
        </div>

        <div class="board-wrap" style="align-items: center; justify-content: center; position: relative;">
          <canvas id="matrix-canvas" width="340" height="340" style="touch-action: none; border-radius: 12px; max-width: 92vw; max-height: 54vh;"></canvas>
          <div id="matrix-gameover" class="overlay" style="display: none;">
            <div class="win-card">
              <h2 id="matrix-modal-title">GAME OVER</h2>
              <div class="win-meta" id="matrix-final-stats">SCORE: 0</div>
              <div class="win-actions">
                <button class="cta-play" data-act="restart">Play Again</button>
                <button class="ghost-btn" data-act="back">Return to Hub</button>
              </div>
            </div>
          </div>
        </div>

        <!-- On-screen Swipe/Arrow Controls for Mobile -->
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

    this.canvas = this.container.querySelector<HTMLCanvasElement>("#matrix-canvas");
    if (this.canvas) {
      this.ctx = this.canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      const size = Math.min(340, Math.floor(window.innerWidth * 0.9));
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

      if (target.dataset.act === "undo") {
        synth.tap();
        if (undoMatrix(this.state)) {
          this.paint();
        }
        return;
      }

      if (target.dataset.act === "restart") {
        synth.tap();
        this.restart();
        return;
      }

      const dir = target.dataset.dir as MatrixDirection | undefined;
      if (dir) {
        this.handleMove(dir);
      }
    });

    // Touch swipe handling
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

        if (Math.max(absX, absY) > 28) {
          if (absX > absY) {
            this.handleMove(dx > 0 ? "right" : "left");
          } else {
            this.handleMove(dy > 0 ? "down" : "up");
          }
        }
      }, { passive: true });
    }

    // Keyboard
    window.addEventListener("keydown", this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
      e.preventDefault();
      this.handleMove("up");
    } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
      e.preventDefault();
      this.handleMove("down");
    } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      e.preventDefault();
      this.handleMove("left");
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      e.preventDefault();
      this.handleMove("right");
    } else if (e.key === "u" || e.key === "U") {
      e.preventDefault();
      synth.tap();
      if (undoMatrix(this.state)) this.paint();
    }
  };

  private handleMove(dir: MatrixDirection): void {
    const res = moveMatrix(this.state, dir);
    if (res.moved) {
      synth.step();
      hapticTap();
      if (res.mergedValues.length > 0) {
        synth.combo();
      }
      if (res.reached2048) {
        synth.star();
      }

      if (res.isGameOver) {
        synth.gameover();
        if (this.saveData && this.onSave) {
          const updated = recordHighScore(this.saveData, "matrix", this.state.score);
          this.saveData = updated;
          this.onSave(updated);
        }
        const go = this.container?.querySelector<HTMLElement>("#matrix-gameover");
        const stats = this.container?.querySelector<HTMLElement>("#matrix-final-stats");
        const title = this.container?.querySelector<HTMLElement>("#matrix-modal-title");
        if (go) go.style.display = "flex";
        if (title) title.textContent = this.state.won ? "VICTORY (2048)!" : "GAME OVER";
        if (stats) stats.textContent = `SCORE: ${this.state.score} · BEST: ${this.state.highScore}`;
      }

      this.paint();
    }
  }

  private restart(): void {
    const currentHigh = this.saveData?.arcadeHighScores?.["matrix"] ?? this.state.highScore;
    this.state = createMatrixGame(4, currentHigh);
    const go = this.container?.querySelector<HTMLElement>("#matrix-gameover");
    if (go) go.style.display = "none";
    this.paint();
  }

  private paint(): void {
    // Update HUD
    const scoreEl = this.container?.querySelector("#matrix-score");
    const highEl = this.container?.querySelector("#matrix-high");
    if (scoreEl) scoreEl.textContent = this.state.score.toString();
    if (highEl) highEl.textContent = this.state.highScore.toString();

    // Render canvas
    if (this.ctx && this.canvas) {
      const dpr = window.devicePixelRatio || 1;
      const w = this.canvas.width / dpr;
      const h = this.canvas.height / dpr;
      this.renderer.render(this.ctx, this.state, w, h);
    }
  }

  destroy(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    if (this.container) {
      this.container.innerHTML = "";
    }
  }
}
