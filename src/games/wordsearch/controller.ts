import { synth } from "../../audio/synth";
import { hapticTap } from "../../audio/haptics";
import { recordHighScore } from "../../save/storage";
import type { BasicScoreSave, SaveData } from "../../save/schema";
import { fitBox } from "../canvasFit";
import {
  commitSelection,
  createWordSearchGame,
  requestHint,
  setWordSearchDifficulty,
  tickWordSearch,
  updateSelection,
  type GridPos,
  type WordSearchDifficulty,
  type WordSearchState,
} from "./engine";
import { WORD_CATEGORIES } from "./words";
import { WordSearchRenderer } from "./render";

export class WordSearchController {
  private state: WordSearchState;
  private renderer: WordSearchRenderer;
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animId = 0;
  private lastTime = 0;
  private isDragging = false;
  private dragStartPos: GridPos | null = null;
  private onBack: (() => void) | null = null;
  private onSave: ((s: SaveData) => void) | null = null;
  private saveData: SaveData | null = null;
  private arcadeSave: BasicScoreSave | null = null;
  private onArcadeSave: ((s: BasicScoreSave) => void) | null = null;
  private onArcadeReport: ((s: BasicScoreSave) => void) | null = null;
  private abortController: AbortController | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    this.state = createWordSearchGame(1, 0, "hard");
    this.renderer = new WordSearchRenderer();
  }

  mountArcade(
    container: HTMLElement,
    onBack: () => void,
    save: BasicScoreSave,
    onSave: (s: BasicScoreSave) => void,
    onReport?: (s: BasicScoreSave) => void,
  ): void {
    this.container = container;
    this.onBack = onBack;
    this.arcadeSave = save;
    this.onArcadeSave = onSave;
    this.onArcadeReport = onReport ?? null;

    // Decouple level from high score (if save.best was high score > 50, start at level 1)
    const savedLvl =
      typeof save.level === "number" && save.level >= 1
        ? save.level
        : save.best > 0 && save.best <= 50
        ? save.best
        : 1;
    const startLevel = Math.max(1, savedLvl);

    this.state = createWordSearchGame(startLevel, save.best ?? 0, "hard");
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

    const currentHigh = saveData.arcadeHighScores?.["wordsearch"] ?? 0;
    const startLevel = currentHigh > 0 && currentHigh <= 50 ? currentHigh : 1;
    this.state = createWordSearchGame(startLevel, currentHigh, "hard");

    this.renderDom();
    this.setupListeners();
    this.startLoop();
  }

  private renderDom(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="shell enter">
        <div class="hud" style="grid-template-columns: 44px 1fr 44px;">
          <button class="icon-btn" data-act="back" aria-label="Back to Arcade">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            <span>Hub</span>
          </button>
          <div class="center-meta">
            <div class="lvl">WORD SEARCH · LVL ${this.state.level}</div>
            <div class="par">SCORE <b id="ws-score">${this.state.score}</b> · HIGH <b id="ws-high">${this.state.highScore}</b></div>
            <div class="par-sub" id="ws-cat" style="color: ${this.state.category.themeColor}; font-weight: 700;">
              ${this.state.category.name} · <span style="color: #FFD700; font-size: 10px; letter-spacing: 0.04em;">${this.state.trickiness}</span>
            </div>
          </div>
          <button class="icon-btn" data-act="hint" id="ws-hint-btn" aria-label="Hint">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 6h8c1.5-1.5 3-3.5 3-6a7 7 0 0 0-7-7z"/></svg>
            <span>Hint</span>
          </button>
        </div>

        <div style="display: flex; justify-content: center; margin: 2px 0 6px;">
          <button class="ghost-btn" data-act="diff" id="ws-diff-btn" style="min-height: 44px; display: inline-flex; align-items: center; padding: 4px 14px; font-size: 11px; font-weight: 700; border: 1px solid rgba(0,255,163,0.35); border-radius: 14px; background: rgba(11,15,25,0.7); color: #00ffa3; cursor: pointer; letter-spacing: 0.05em;">
            GRID: ${this.state.difficulty.toUpperCase()} (${this.state.size}x${this.state.size})
          </button>
        </div>

        <div class="board-wrap" style="align-items: center; justify-content: center; position: relative;">
          <canvas id="ws-canvas" width="350" height="350" style="touch-action: none; border-radius: 14px; cursor: crosshair;"></canvas>
          
          <div id="ws-winmodal" class="overlay" style="display: none;">
            <div class="win-card">
              <h2 style="color: #00FFA3; text-shadow: 0 0 16px rgba(0,255,163,0.6);">AMAZING!</h2>
              <div class="win-meta" id="ws-final-stats">ALL WORDS FOUND!</div>
              <div class="win-actions">
                <button class="cta-play" data-act="next-level">Next Level</button>
                <button class="ghost-btn" data-act="back">Return to Hub</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Target Words Checklist -->
        <div id="ws-word-list" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin: 10px 6px 0; max-width: 380px;">
          ${this.renderWordPills()}
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector<HTMLCanvasElement>("#ws-canvas");
    if (this.canvas) {
      this.ctx = this.canvas.getContext("2d");
      this.resizeCanvas();
    }
  }

  private resizeCanvas(): void {
    if (!this.canvas || !this.ctx) return;
    const dpr = window.devicePixelRatio || 1;

    // Match the buffer to the measured board area so the grid stays square on
    // short/landscape screens instead of being clamped on a single axis.
    const host = this.canvas.parentElement?.getBoundingClientRect();
    const availW = host && host.width > 0 ? host.width : window.innerWidth * 0.92;
    const availH = host && host.height > 0 ? host.height : window.innerHeight * 0.46;
    const { w, h } = fitBox(availW, availH, 1, 350);

    const bufferW = Math.round(w * dpr);
    const bufferH = Math.round(h * dpr);
    if (this.canvas.width !== bufferW) this.canvas.width = bufferW;
    if (this.canvas.height !== bufferH) this.canvas.height = bufferH;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }

  private renderWordPills(): string {
    return this.state.placedWords
      .map((pw) => {
        if (pw.found) {
          return `<span style="padding: 3px 9px; font-size: 11px; font-weight: 700; border-radius: 12px; background: rgba(0,0,0,0.5); border: 1.5px solid ${pw.color}; color: ${pw.color}; text-decoration: line-through; text-shadow: 0 0 8px ${pw.color};">✓ ${pw.word}</span>`;
        }
        return `<span style="padding: 3px 9px; font-size: 11px; font-weight: 600; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: #B0C4DE;">${pw.word}</span>`;
      })
      .join("");
  }

  private updateWordListDom(): void {
    const listEl = this.container?.querySelector("#ws-word-list");
    if (listEl) {
      listEl.innerHTML = this.renderWordPills();
    }
  }

  /** Persists the high score / level. Reporting is a separate, win-only step. */
  private persistScore(): BasicScoreSave {
    if (this.state.score > this.state.highScore) {
      this.state.highScore = this.state.score;
    }
    let result: BasicScoreSave = {
      best: this.state.highScore,
      level: this.state.level,
    };
    if (this.arcadeSave && this.onArcadeSave) {
      const best = Math.max(this.arcadeSave.best ?? 0, this.state.score);
      const level = Math.max(this.arcadeSave.level ?? 1, this.state.level);
      this.arcadeSave.best = best;
      this.arcadeSave.level = level;
      result = { best, level };
      this.onArcadeSave(result);
    } else if (this.saveData && this.onSave) {
      const updated = recordHighScore(this.saveData, "wordsearch", this.state.score);
      this.saveData = updated;
      this.onSave(updated);
    }
    return result;
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

        if (target.dataset.act === "diff") {
          synth.tap();
          const diffs: WordSearchDifficulty[] = ["easy", "hard", "master"];
          const curIdx = diffs.indexOf(this.state.difficulty);
          const next = diffs[(curIdx + 1) % diffs.length]!;
          setWordSearchDifficulty(this.state, next);
          this.renderDom();
          this.setupListeners();
          return;
        }

        if (target.dataset.act === "hint") {
          synth.tap();
          requestHint(this.state);
          return;
        }

        if (target.dataset.act === "next-level") {
          synth.tap();
          this.advanceNextLevel();
          return;
        }
      },
      { signal },
    );

    if (this.canvas) {
      const getCellFromEvent = (clientX: number, clientY: number): GridPos | null => {
        if (!this.canvas) return null;
        const rect = this.canvas.getBoundingClientRect();
        const pad = 12;
        const size = rect.width - pad * 2;
        const cellSize = size / this.state.size;

        const relX = clientX - rect.left - pad;
        const relY = clientY - rect.top - pad;

        const c = Math.floor(relX / cellSize);
        const r = Math.floor(relY / cellSize);

        if (r >= 0 && r < this.state.size && c >= 0 && c < this.state.size) {
          return { r, c };
        }
        return null;
      };

      this.canvas.addEventListener(
        "pointerdown",
        (e) => {
          try {
            this.canvas?.setPointerCapture(e.pointerId);
          } catch {}
          const cell = getCellFromEvent(e.clientX, e.clientY);
          if (cell) {
            this.isDragging = true;
            this.dragStartPos = cell;
            updateSelection(this.state, cell, cell);
            synth.step();
            hapticTap();
          }
        },
        { signal },
      );

      this.canvas.addEventListener(
        "pointermove",
        (e) => {
          if (!this.isDragging || !this.dragStartPos) return;
          const cell = getCellFromEvent(e.clientX, e.clientY);
          if (cell) {
            const prevLen = this.state.activeSelection?.cells.length ?? 0;
            const sel = updateSelection(this.state, this.dragStartPos, cell);
            if (sel.cells.length !== prevLen) {
              synth.step();
              hapticTap();
            }
          }
        },
        { signal },
      );

      const handlePointerEnd = (): void => {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.dragStartPos = null;

        const res = commitSelection(this.state);
        if (res) {
          synth.combo();
          hapticTap();
          const saved = this.persistScore();
          this.updateWordListDom();

          const scoreEl = this.container?.querySelector("#ws-score");
          const highEl = this.container?.querySelector("#ws-high");
          if (scoreEl) scoreEl.textContent = this.state.score.toString();
          if (highEl) highEl.textContent = this.state.highScore.toString();

          if (this.state.isCompleted) {
            // Report exactly once, when the board is cleared.
            this.onArcadeReport?.(saved);
            synth.star();
            if (this.canvas) {
              const dpr = window.devicePixelRatio || 1;
              this.renderer.emitVictoryBurst(
                this.canvas.width / dpr,
                this.canvas.height / dpr,
              );
            }
            const modal = this.container?.querySelector<HTMLElement>("#ws-winmodal");
            const stats = this.container?.querySelector<HTMLElement>("#ws-final-stats");
            if (modal) modal.style.display = "flex";
            if (stats) stats.textContent = `SCORE: ${this.state.score} · BEST: ${this.state.highScore}`;
          }
        }
      };

      this.canvas.addEventListener("pointerup", handlePointerEnd, { signal });
      this.canvas.addEventListener("pointercancel", handlePointerEnd, { signal });
    }

    window.addEventListener("resize", () => this.resizeCanvas(), { signal });

    if (this.canvas?.parentElement && typeof ResizeObserver !== "undefined") {
      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
      this.resizeObserver.observe(this.canvas.parentElement);
    }
  }

  private advanceNextLevel(): void {
    const nextLvl = this.state.level + 1;
    const currentHigh =
      this.arcadeSave?.best ?? this.saveData?.arcadeHighScores?.["wordsearch"] ?? this.state.highScore;
    const carriedScore = this.state.score;
    const diff = this.state.difficulty;
    const prevIdx = WORD_CATEGORIES.findIndex((c) => c.name === this.state.category.name);
    this.state = createWordSearchGame(nextLvl, currentHigh, diff, Math.random, prevIdx);
    this.state.score = carriedScore;
    if (this.arcadeSave && this.onArcadeSave) {
      const best = Math.max(this.arcadeSave.best ?? 0, carriedScore);
      this.arcadeSave.best = best;
      this.arcadeSave.level = nextLvl;
      this.onArcadeSave({ best, level: nextLvl });
    } else if (this.saveData && this.onSave) {
      const updated = recordHighScore(this.saveData, "wordsearch", carriedScore);
      this.saveData = updated;
      this.onSave(updated);
    }
    this.renderDom();
    this.setupListeners();
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(50, now - this.lastTime);
      this.lastTime = now;

      tickWordSearch(this.state, dt);
      this.renderer.update(dt / 1000);

      if (this.ctx && this.canvas) {
        const dpr = window.devicePixelRatio || 1;
        const w = this.canvas.width / dpr;
        const h = this.canvas.height / dpr;
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
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.container) {
      this.container.innerHTML = "";
    }
  }
}
