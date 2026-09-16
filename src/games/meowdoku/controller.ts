/* ── Meowdoku Controller ──
   Manages DOM layout, touch/mouse/keyboard inputs, sound effects,
   level progression, win/gameover overlays, and highscore saving. */

import { synth } from "../../audio/synth";
import { hapticTap } from "../../audio/haptics";
import { recordHighScore } from "../../save/storage";
import type { SaveData } from "../../save/schema";
import { MeowdokuEngine } from "./engine";
import { MeowdokuRenderer } from "./render";

type InputMode = "auto" | "cat" | "x";

export class MeowdokuController {
  private engine: MeowdokuEngine;
  private renderer: MeowdokuRenderer;
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animId = 0;
  private onBack: (() => void) | null = null;
  private onSave: ((s: SaveData) => void) | null = null;
  private saveData: SaveData | null = null;
  private arcadeSave: { best: number } | null = null;
  private onArcadeSave: ((s: { best: number }) => void) | null = null;
  private abortController: AbortController | null = null;

  private selectedCell: { row: number; col: number } | null = null;
  private lastTapTime = 0;
  private lastTapCell: { row: number; col: number } | null = null;
  private tapTimeoutId: number | null = null;
  private inputMode: InputMode = "auto";
  private flashError = false;
  private errorTimer = 0;

  constructor() {
    this.engine = new MeowdokuEngine();
    this.renderer = new MeowdokuRenderer();
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

    // Start at highest unlocked level (resuming saved progress)
    const startLevel = Math.max(1, save.best || 1);
    this.engine.newLevel(startLevel);

    this.renderDom();
    this.setupListeners();
    this.startLoop();
    this.updateHud();
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

    const currentHigh = saveData.arcadeHighScores?.["meowdoku"] ?? 1;
    const startLevel = Math.max(1, currentHigh);
    this.engine.newLevel(startLevel);

    this.renderDom();
    this.setupListeners();
    this.startLoop();
    this.updateHud();
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
            <div class="lvl" style="color: #40c4ff; letter-spacing: 1px;">MEOWDOKU</div>
            <div class="par">LEVEL <b id="meow-level">${this.engine.level}</b> · <span id="meow-hearts">❤️❤️❤️</span></div>
            <div class="par-sub">1 CAT PER REGION, ROW & COL · NO TOUCHING</div>
          </div>
          <button class="icon-btn" data-act="undo" id="meow-undo-btn" aria-label="Undo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
            <span>Undo</span>
          </button>
        </div>

        <div class="board-wrap" style="align-items: center; justify-content: center; position: relative; flex: 1;">
          <canvas id="meow-canvas" width="340" height="340" style="touch-action: none; border-radius: 12px; max-width: 94vw; max-height: 54vh;"></canvas>
          
          <!-- Win Overlay -->
          <div id="meow-win-modal" class="overlay" style="display: none;">
            <div class="win-card">
              <h2 style="color: #ffd740; font-size: 24px; margin-bottom: 6px;">PURR-FECT! 🐱</h2>
              <div id="meow-win-stars" style="font-size: 30px; margin: 8px 0;">⭐⭐⭐</div>
              <div class="win-meta" id="meow-win-meta" style="margin-bottom: 16px;">Level Complete!</div>
              <div class="win-actions">
                <button class="cta-play" data-act="next-level" style="background: #40c4ff; color: #000; font-weight: bold;">Next Level</button>
                <button class="ghost-btn" data-act="back">Return to Hub</button>
              </div>
            </div>
          </div>

          <!-- Game Over Overlay -->
          <div id="meow-gameover-modal" class="overlay" style="display: none;">
            <div class="win-card">
              <h2 style="color: #ff1744; font-size: 22px; margin-bottom: 8px;">OUT OF HEARTS! 💔</h2>
              <div class="win-meta" style="margin-bottom: 16px;">Try this puzzle again!</div>
              <div class="win-actions">
                <button class="cta-play" data-act="retry-level">Retry Level</button>
                <button class="ghost-btn" data-act="back">Return to Hub</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Mode Switcher & Tools Dock -->
        <div class="dock" style="display: flex; justify-content: center; gap: 8px; padding: 10px 16px 14px;">
          <button class="dpad-btn" data-act="mode-auto" id="meow-mode-auto" style="flex: 1; max-width: 100px; padding: 8px; font-size: 12px; background: rgba(64, 196, 255, 0.25); border: 1px solid #40c4ff; border-radius: 8px; color: #fff;">
            ⚡ Auto
          </button>
          <button class="dpad-btn" data-act="mode-cat" id="meow-mode-cat" style="flex: 1; max-width: 100px; padding: 8px; font-size: 12px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #fff;">
            🐱 Cat
          </button>
          <button class="dpad-btn" data-act="mode-x" id="meow-mode-x" style="flex: 1; max-width: 100px; padding: 8px; font-size: 12px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #fff;">
            ❌ Mark X
          </button>
          <button class="dpad-btn" data-act="hint" id="meow-hint-btn" style="flex: 1; max-width: 90px; padding: 8px; font-size: 12px; background: rgba(255, 215, 64, 0.15); border: 1px solid #ffd740; border-radius: 8px; color: #ffd740;">
            💡 Hint (<span id="meow-hints-count">${this.engine.hintsRemaining}</span>)
          </button>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector<HTMLCanvasElement>("#meow-canvas");
    if (this.canvas) {
      this.ctx = this.canvas.getContext("2d");
      this.resizeCanvas();
    }
  }

  private resizeCanvas(): void {
    if (!this.canvas || !this.ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(350, Math.floor(window.innerWidth * 0.92), Math.floor(window.innerHeight * 0.52));
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }

  private updateHud(): void {
    if (!this.container) return;
    const lvlEl = this.container.querySelector<HTMLElement>("#meow-level");
    if (lvlEl) lvlEl.textContent = String(this.engine.level);

    const heartsEl = this.container.querySelector<HTMLElement>("#meow-hearts");
    if (heartsEl) {
      const full = "❤️".repeat(Math.max(0, this.engine.hearts));
      const empty = "🖤".repeat(Math.max(0, 3 - this.engine.hearts));
      heartsEl.textContent = full + empty;
    }

    const hintsEl = this.container.querySelector<HTMLElement>("#meow-hints-count");
    if (hintsEl) {
      hintsEl.textContent = String(this.engine.hintsRemaining);
    }

    // Update mode buttons styling
    const autoBtn = this.container.querySelector<HTMLElement>("#meow-mode-auto");
    const catBtn = this.container.querySelector<HTMLElement>("#meow-mode-cat");
    const xBtn = this.container.querySelector<HTMLElement>("#meow-mode-x");

    if (autoBtn) {
      autoBtn.style.background = this.inputMode === "auto" ? "rgba(64, 196, 255, 0.3)" : "rgba(255, 255, 255, 0.08)";
      autoBtn.style.borderColor = this.inputMode === "auto" ? "#40c4ff" : "rgba(255, 255, 255, 0.2)";
    }
    if (catBtn) {
      catBtn.style.background = this.inputMode === "cat" ? "rgba(255, 215, 64, 0.3)" : "rgba(255, 255, 255, 0.08)";
      catBtn.style.borderColor = this.inputMode === "cat" ? "#ffd740" : "rgba(255, 255, 255, 0.2)";
    }
    if (xBtn) {
      xBtn.style.background = this.inputMode === "x" ? "rgba(255, 23, 68, 0.3)" : "rgba(255, 255, 255, 0.08)";
      xBtn.style.borderColor = this.inputMode === "x" ? "#ff1744" : "rgba(255, 255, 255, 0.2)";
    }
  }

  private setupListeners(): void {
    if (!this.container || !this.canvas) return;
    this.abortController?.abort();
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    // Window resize
    window.addEventListener(
      "resize",
      () => {
        this.resizeCanvas();
      },
      { signal },
    );

    // Canvas click / touch
    this.canvas.addEventListener(
      "pointerdown",
      (e) => {
        e.preventDefault();
        const cell = this.getCellFromPointer(e);
        if (!cell) return;
        this.handleCellAction(cell.row, cell.col);
      },
      { signal },
    );

    // Click delegation for buttons
    this.container.addEventListener(
      "click",
      (e) => {
        const target = (e.target as HTMLElement).closest("[data-act]");
        if (!target) return;
        const act = target.getAttribute("data-act");
        if (!act) return;

        hapticTap();

        if (act === "back") {
          synth.tap();
          this.destroy();
          this.onBack?.();
        } else if (act === "undo") {
          synth.step();
          this.engine.undo();
          this.updateHud();
        } else if (act === "hint") {
          this.triggerHint();
        } else if (act === "mode-auto") {
          synth.tap();
          this.inputMode = "auto";
          this.updateHud();
        } else if (act === "mode-cat") {
          synth.tap();
          this.inputMode = "cat";
          this.updateHud();
        } else if (act === "mode-x") {
          synth.tap();
          this.inputMode = "x";
          this.updateHud();
        } else if (act === "next-level") {
          synth.tap();
          this.startNextLevel();
        } else if (act === "retry-level") {
          synth.tap();
          this.retryLevel();
        }
      },
      { signal },
    );

    // Keyboard navigation
    window.addEventListener(
      "keydown",
      (e) => {
        if (this.engine.phase !== "play") return;
        const n = this.engine.size;
        if (!this.selectedCell) {
          this.selectedCell = { row: 0, col: 0 };
        }

        switch (e.key) {
          case "ArrowUp":
          case "w":
          case "W":
            e.preventDefault();
            this.selectedCell.row = (this.selectedCell.row - 1 + n) % n;
            synth.tap();
            break;
          case "ArrowDown":
          case "s":
          case "S":
            e.preventDefault();
            this.selectedCell.row = (this.selectedCell.row + 1) % n;
            synth.tap();
            break;
          case "ArrowLeft":
          case "a":
          case "A":
            e.preventDefault();
            this.selectedCell.col = (this.selectedCell.col - 1 + n) % n;
            synth.tap();
            break;
          case "ArrowRight":
          case "d":
          case "D":
            e.preventDefault();
            this.selectedCell.col = (this.selectedCell.col + 1) % n;
            synth.tap();
            break;
          case " ":
          case "Enter":
            e.preventDefault();
            this.handleCatPlacement(this.selectedCell.row, this.selectedCell.col);
            break;
          case "x":
          case "X":
            e.preventDefault();
            this.handleXToggle(this.selectedCell.row, this.selectedCell.col);
            break;
          case "z":
          case "Z":
          case "u":
          case "U":
            e.preventDefault();
            this.engine.undo();
            synth.step();
            this.updateHud();
            break;
          case "h":
          case "H":
            e.preventDefault();
            this.triggerHint();
            break;
        }
      },
      { signal },
    );

    window.addEventListener("resize", () => this.resizeCanvas(), { signal });
  }

  private getCellFromPointer(e: PointerEvent): { row: number; col: number } | null {
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const width = rect.width;
    const height = rect.height;
    const n = this.engine.size;
    const padding = 16;
    const availableSize = Math.min(width - padding * 2, height - padding * 2);
    const cellSize = Math.floor(availableSize / n);
    const boardSize = cellSize * n;
    const startX = Math.floor((width - boardSize) / 2);
    const startY = Math.floor((height - boardSize) / 2);

    if (x < startX || x >= startX + boardSize || y < startY || y >= startY + boardSize) {
      return null;
    }

    const col = Math.floor((x - startX) / cellSize);
    const row = Math.floor((y - startY) / cellSize);
    if (row >= 0 && row < n && col >= 0 && col < n) {
      return { row, col };
    }
    return null;
  }

  private handleCellAction(row: number, col: number): void {
    if (this.engine.phase !== "play") return;
    this.selectedCell = { row, col };

    if (this.inputMode === "cat") {
      this.handleCatPlacement(row, col);
      return;
    }

    if (this.inputMode === "x") {
      this.handleXToggle(row, col);
      return;
    }

    // Auto Mode: single-tap = toggle X; double-tap = place/remove cat
    const now = performance.now();
    const isDoubleTap =
      this.lastTapCell &&
      this.lastTapCell.row === row &&
      this.lastTapCell.col === col &&
      now - this.lastTapTime < 280;

    if (isDoubleTap) {
      if (this.tapTimeoutId !== null) {
        window.clearTimeout(this.tapTimeoutId);
        this.tapTimeoutId = null;
      }
      this.lastTapTime = 0;
      this.lastTapCell = null;
      this.handleCatPlacement(row, col);
    } else {
      this.lastTapTime = now;
      this.lastTapCell = { row, col };
      if (this.tapTimeoutId !== null) {
        window.clearTimeout(this.tapTimeoutId);
      }
      this.tapTimeoutId = window.setTimeout(() => {
        this.tapTimeoutId = null;
        this.handleXToggle(row, col);
      }, 280);
    }
  }

  private handleCatPlacement(row: number, col: number): void {
    const cell = this.engine.grid[row]?.[col];
    if (!cell) return;

    if (cell.mark === "cat") {
      // Remove cat
      this.engine.removeCat(row, col);
      synth.step();
      this.updateHud();
      return;
    }

    const success = this.engine.placeCat(row, col);
    if (success) {
      synth.star();
      hapticTap();
      this.updateHud();
      this.checkPhase();
    } else {
      synth.fail();
      this.flashError = true;
      this.errorTimer = 0.5;
      this.updateHud();
      this.checkPhase();
    }
  }

  private handleXToggle(row: number, col: number): void {
    const res = this.engine.tapCell(row, col);
    if (res === "x") {
      synth.tap();
    } else if (res === "cleared" || res === "removed") {
      synth.step();
    }
    this.updateHud();
  }

  private triggerHint(): void {
    if (this.engine.hintsRemaining <= 0) {
      synth.blocked();
      return;
    }
    const hint = this.engine.useHint();
    if (hint) {
      synth.reveal();
      this.selectedCell = hint;
      this.updateHud();
      this.checkPhase();
    }
  }

  private checkPhase(): void {
    if (this.engine.phase === "won") {
      synth.success();
      this.saveProgress();
      const modal = this.container?.querySelector<HTMLElement>("#meow-win-modal");
      const starsEl = this.container?.querySelector<HTMLElement>("#meow-win-stars");
      const metaEl = this.container?.querySelector<HTMLElement>("#meow-win-meta");

      if (starsEl) {
        const stars = this.engine.getStars();
        starsEl.textContent = "⭐".repeat(stars) + "☆".repeat(3 - stars);
      }
      if (metaEl) {
        metaEl.textContent = `Completed Level ${this.engine.level}!`;
      }
      if (modal) {
        modal.style.display = "flex";
      }
    } else if (this.engine.phase === "over") {
      synth.gameover();
      const modal = this.container?.querySelector<HTMLElement>("#meow-gameover-modal");
      if (modal) {
        modal.style.display = "flex";
      }
    }
  }

  private saveProgress(): void {
    const nextLevel = this.engine.level + 1;
    if (this.arcadeSave && this.onArcadeSave) {
      if (nextLevel > this.arcadeSave.best) {
        this.arcadeSave.best = nextLevel;
        this.onArcadeSave({ best: nextLevel });
      }
    } else if (this.saveData && this.onSave) {
      const updated = recordHighScore(this.saveData, "meowdoku", nextLevel);
      this.saveData = updated;
      this.onSave(updated);
    }
  }

  private startNextLevel(): void {
    const modal = this.container?.querySelector<HTMLElement>("#meow-win-modal");
    if (modal) modal.style.display = "none";
    this.engine.newLevel(this.engine.level + 1);
    this.selectedCell = null;
    this.updateHud();
  }

  private retryLevel(): void {
    const modal = this.container?.querySelector<HTMLElement>("#meow-gameover-modal");
    if (modal) modal.style.display = "none";
    this.engine.newLevel(this.engine.level);
    this.selectedCell = null;
    this.updateHud();
  }

  private startLoop(): void {
    const tick = () => {
      if (this.flashError) {
        this.errorTimer -= 0.016;
        if (this.errorTimer <= 0) {
          this.flashError = false;
        }
      }

      if (this.ctx && this.canvas) {
        const rect = this.canvas.getBoundingClientRect();
        this.renderer.render(
          this.ctx,
          this.engine,
          rect.width,
          rect.height,
          this.selectedCell,
          this.flashError,
        );
      }
      this.animId = requestAnimationFrame(tick);
    };
    this.animId = requestAnimationFrame(tick);
  }

  destroy(): void {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = 0;
    }
    if (this.tapTimeoutId !== null) {
      clearTimeout(this.tapTimeoutId);
      this.tapTimeoutId = null;
    }
    this.abortController?.abort();
    this.abortController = null;
    if (this.container) {
      this.container.innerHTML = "";
    }
  }
}
