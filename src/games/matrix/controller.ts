import { synth } from "../../audio/synth";
import { hapticTap } from "../../audio/haptics";
import { recordHighScore } from "../../save/storage";
import type { SaveData } from "../../save/schema";
import { fitBox } from "../canvasFit";
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
  private resizeObserver: ResizeObserver | null = null;

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
    this.arcadeSave = save;
    this.onArcadeSave = onSave;
    this.state = createMatrixGame(4, save.best ?? 0);
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

    const currentHigh = saveData.arcadeHighScores?.["matrix"] ?? 0;
    this.state = createMatrixGame(4, currentHigh);

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
            <div class="lvl">CYBER 2048</div>
            <div class="par">SCORE <b id="matrix-score">0</b> · HIGH <b id="matrix-high">${this.state.highScore}</b></div>
            <div class="par-sub">SYNTHESIZE TILES TO 2048</div>
          </div>
          <button class="icon-btn" data-act="undo" id="matrix-undo-btn" aria-label="Undo move">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
            <span id="matrix-undo-text">Undo</span>
          </button>
        </div>

        <div class="board-wrap" style="align-items: center; justify-content: center; position: relative;">
          <canvas id="matrix-canvas" width="340" height="340" style="touch-action: none; border-radius: 12px;"></canvas>
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

    this.canvas = this.container.querySelector<HTMLCanvasElement>("#matrix-canvas");
    if (this.canvas) {
      this.ctx = this.canvas.getContext("2d");
      this.resizeCanvas();
    }
  }

  private resizeCanvas(): void {
    if (!this.canvas || !this.ctx) return;
    const dpr = window.devicePixelRatio || 1;

    // Match the backing buffer to the measured board area so CSS never scales a
    // differently sized buffer (which would shrink or distort the grid).
    const host = this.canvas.parentElement?.getBoundingClientRect();
    const availW = host && host.width > 0 ? host.width : window.innerWidth * 0.9;
    const availH = host && host.height > 0 ? host.height : window.innerHeight * 0.52;
    const { w, h } = fitBox(availW, availH, 1, 340);

    const bufferW = Math.round(w * dpr);
    const bufferH = Math.round(h * dpr);
    if (this.canvas.width !== bufferW) this.canvas.width = bufferW;
    if (this.canvas.height !== bufferH) this.canvas.height = bufferH;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
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
      const updated = recordHighScore(this.saveData, "matrix", this.state.score);
      this.saveData = updated;
      this.onSave(updated);
    }
  }

  private undo(): void {
    if (undoMatrix(this.state)) {
      synth.step();
      const go = this.container?.querySelector<HTMLElement>("#matrix-gameover");
      if (go) go.style.display = "none";
      this.updateHud();
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
        const target = (e.target as HTMLElement).closest<HTMLElement>("[data-act], [data-dir]");
        if (!target) return;

        if (target.dataset.act === "back") {
          synth.tap();
          this.destroy();
          this.onBack?.();
          return;
        }

        if (target.dataset.act === "undo") {
          this.undo();
          return;
        }

        if (target.dataset.act === "restart") {
          synth.tap();
          const go = this.container?.querySelector<HTMLElement>("#matrix-gameover");
          if (this.state.won && !this.state.gameOver && go && go.style.display !== "none") {
            // Keep playing beyond 2048!
            go.style.display = "none";
            return;
          }
          this.restart();
          return;
        }

        const dir = target.dataset.dir as MatrixDirection | undefined;
        if (dir) {
          this.handleMove(dir);
        }
      },
      { signal },
    );

    // Touch swipe handling
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
        "touchend",
        (e) => {
          const touch = e.changedTouches[0];
          if (!touch) return;
          const dx = touch.clientX - this.touchStartX;
          const dy = touch.clientY - this.touchStartY;
          const absX = Math.abs(dx);
          const absY = Math.abs(dy);

          if (Math.max(absX, absY) > 24) {
            if (absX > absY) {
              this.handleMove(dx > 0 ? "right" : "left");
            } else {
              this.handleMove(dy > 0 ? "down" : "up");
            }
          }
        },
        { passive: true, signal },
      );
    }

    // Keyboard
    window.addEventListener("keydown", this.handleKeyDown, { signal });
    window.addEventListener("resize", () => this.resizeCanvas(), { signal });

    if (this.canvas?.parentElement && typeof ResizeObserver !== "undefined") {
      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
      this.resizeObserver.observe(this.canvas.parentElement);
    }
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
    } else if (e.key === "u" || e.key === "U" || e.key === "z" || e.key === "Z") {
      e.preventDefault();
      this.undo();
    }
  };

  private handleMove(dir: MatrixDirection): void {
    const res = moveMatrix(this.state, dir);

    if (res.moved) {
      synth.step();
      hapticTap();
      this.checkSaveHighScore();

      // Check merged tiles and trigger animations
      if (this.canvas) {
        const dpr = window.devicePixelRatio || 1;
        const w = this.canvas.width / dpr;
        const h = this.canvas.height / dpr;
        const pad = 12;
        const size = Math.min(w, h) - pad * 2;
        const gap = 8;
        const cellSize = (size - gap * (this.state.size + 1)) / this.state.size;
        const startX = (w - size) / 2;
        const startY = (h - size) / 2;

        if (res.mergedTiles && res.mergedTiles.length > 0) {
          for (const m of res.mergedTiles) {
            const cx = startX + gap + m.c * (cellSize + gap) + cellSize / 2;
            const cy = startY + gap + m.r * (cellSize + gap) + cellSize / 2;
            this.renderer.triggerMerge(m.r, m.c, m.value, cx, cy);
          }
        }

        // Trigger spawn pop
        if (res.spawnedTile) {
          this.renderer.triggerSpawn(res.spawnedTile.r, res.spawnedTile.c);
        }
      }

      if (res.mergedValues.length > 0) {
        synth.combo();
      }

      if (res.reached2048) {
        synth.star();
        this.renderer.triggerShake(10, 0.4);
        const go = this.container?.querySelector<HTMLElement>("#matrix-gameover");
        const stats = this.container?.querySelector<HTMLElement>("#matrix-final-stats");
        const title = this.container?.querySelector<HTMLElement>("#matrix-modal-title");
        const playBtn = this.container?.querySelector<HTMLElement>("[data-act='restart']");
        if (go) go.style.display = "flex";
        if (title) title.textContent = "VICTORY (2048)!";
        if (stats) stats.textContent = `SCORE: ${this.state.score} · BEST: ${this.state.highScore}`;
        if (playBtn) playBtn.textContent = "Keep Playing";
      }

      if (res.isGameOver) {
        synth.gameover();
        this.checkSaveHighScore();
        const go = this.container?.querySelector<HTMLElement>("#matrix-gameover");
        const stats = this.container?.querySelector<HTMLElement>("#matrix-final-stats");
        const title = this.container?.querySelector<HTMLElement>("#matrix-modal-title");
        const playBtn = this.container?.querySelector<HTMLElement>("[data-act='restart']");
        if (go) go.style.display = "flex";
        if (title) title.textContent = this.state.won ? "VICTORY!" : "GAME OVER";
        if (stats) stats.textContent = `SCORE: ${this.state.score} · BEST: ${this.state.highScore}`;
        if (playBtn) playBtn.textContent = "Play Again";
      }

      this.updateHud();
    }
  }

  private restart(): void {
    const currentHigh =
      this.arcadeSave?.best ?? this.saveData?.arcadeHighScores?.["matrix"] ?? this.state.highScore;
    this.state = createMatrixGame(4, currentHigh);
    const go = this.container?.querySelector<HTMLElement>("#matrix-gameover");
    if (go) go.style.display = "none";
    this.updateHud();
  }

  private updateHud(): void {
    const scoreEl = this.container?.querySelector("#matrix-score");
    const highEl = this.container?.querySelector("#matrix-high");
    const undoText = this.container?.querySelector("#matrix-undo-text");
    if (scoreEl) scoreEl.textContent = this.state.score.toString();
    if (highEl) highEl.textContent = this.state.highScore.toString();
    if (undoText) {
      const remaining = this.state.history.length;
      undoText.textContent = remaining > 0 ? `Undo (${remaining})` : "Undo";
    }
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(50, now - this.lastTime);
      this.lastTime = now;

      this.renderer.update(dt / 1000);

      if (this.ctx && this.canvas) {
        const dpr = window.devicePixelRatio || 1;
        const w = this.canvas.width / dpr;
        const h = this.canvas.height / dpr;
        this.renderer.render(this.ctx, this.state, w, h);
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
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.container) {
      this.container.innerHTML = "";
    }
  }
}
