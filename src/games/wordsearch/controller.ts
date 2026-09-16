import { synth } from "../../audio/synth";
import { hapticTap } from "../../audio/haptics";
import { recordHighScore } from "../../save/storage";
import type { SaveData } from "../../save/schema";
import {
  commitSelection,
  createWordSearchGame,
  requestHint,
  tickWordSearch,
  updateSelection,
  type GridPos,
  type WordSearchState,
} from "./engine";
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

  constructor() {
    this.state = createWordSearchGame(1, 0, 8);
    this.renderer = new WordSearchRenderer();
  }

  mountArcade(
    container: HTMLElement,
    onBack: () => void,
    save: { best: number },
    onSave: (s: { best: number }) => void,
  ): void {
    this.container = container;
    this.onBack = onBack;
    this.state = createWordSearchGame(1, save.best ?? 0, 8);
    this.renderDom();
    this.setupListeners();
    this.onSave = () => {
      if (this.state.score > save.best) {
        save.best = this.state.score;
        onSave({ best: save.best });
      }
    };
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
    this.state = createWordSearchGame(1, currentHigh, 8);

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
            <div class="lvl">WORD SEARCH · LVL ${this.state.level}</div>
            <div class="par">SCORE <b id="ws-score">${this.state.score}</b> · HIGH <b id="ws-high">${this.state.highScore}</b></div>
            <div class="par-sub" id="ws-cat" style="color: ${this.state.category.themeColor}; font-weight: 700;">${this.state.category.name}</div>
          </div>
          <button class="icon-btn" data-act="hint" id="ws-hint-btn" aria-label="Hint">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 6h8c1.5-1.5 3-3.5 3-6a7 7 0 0 0-7-7z"/></svg>
            <span>Hint</span>
          </button>
        </div>

        <div class="board-wrap" style="align-items: center; justify-content: center; position: relative;">
          <canvas id="ws-canvas" width="340" height="340" style="touch-action: none; border-radius: 14px; max-width: 92vw; max-height: 52vh; cursor: crosshair;"></canvas>
          
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
        <div id="ws-word-list" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 12px 8px 0; max-width: 360px;">
          ${this.renderWordPills()}
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector<HTMLCanvasElement>("#ws-canvas");
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

  private renderWordPills(): string {
    return this.state.placedWords
      .map((pw) => {
        if (pw.found) {
          return `<span style="padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 12px; background: rgba(0,0,0,0.5); border: 1.5px solid ${pw.color}; color: ${pw.color}; text-decoration: line-through; text-shadow: 0 0 8px ${pw.color};">✓ ${pw.word}</span>`;
        }
        return `<span style="padding: 4px 10px; font-size: 11px; font-weight: 600; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: #B0C4DE;">${pw.word}</span>`;
      })
      .join("");
  }

  private updateWordListDom(): void {
    const listEl = this.container?.querySelector("#ws-word-list");
    if (listEl) {
      listEl.innerHTML = this.renderWordPills();
    }
    const scoreEl = this.container?.querySelector("#ws-score");
    const highEl = this.container?.querySelector("#ws-high");
    if (scoreEl) scoreEl.textContent = this.state.score.toString();
    if (highEl) highEl.textContent = this.state.highScore.toString();
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
    });

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

      this.canvas.addEventListener("pointerdown", (e) => {
        const cell = getCellFromEvent(e.clientX, e.clientY);
        if (!cell) return;
        this.isDragging = true;
        this.dragStartPos = cell;
        updateSelection(this.state, cell, cell);
      });

      this.canvas.addEventListener("pointermove", (e) => {
        if (!this.isDragging || !this.dragStartPos) return;
        const cell = getCellFromEvent(e.clientX, e.clientY);
        if (cell) {
          updateSelection(this.state, this.dragStartPos, cell);
        }
      });

      const handlePointerEnd = (): void => {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.dragStartPos = null;

        const foundWord = commitSelection(this.state);
        if (foundWord) {
          synth.combo();
          hapticTap();
          this.updateWordListDom();

          if (this.state.isCompleted) {
            synth.star();
            if (this.canvas) {
              const dpr = window.devicePixelRatio || 1;
              this.renderer.emitVictoryBurst(this.canvas.width / dpr, this.canvas.height / dpr);
            }
            if (this.saveData && this.onSave) {
              const updated = recordHighScore(this.saveData, "wordsearch", this.state.score);
              this.saveData = updated;
              this.onSave(updated);
            }
            const modal = this.container?.querySelector<HTMLElement>("#ws-winmodal");
            const stats = this.container?.querySelector<HTMLElement>("#ws-final-stats");
            if (modal) modal.style.display = "flex";
            if (stats) stats.textContent = `SCORE: ${this.state.score} · BEST: ${this.state.highScore}`;
          }
        }
      };

      this.canvas.addEventListener("pointerup", handlePointerEnd);
      this.canvas.addEventListener("pointercancel", handlePointerEnd);
    }
  }

  private advanceNextLevel(): void {
    const nextLvl = this.state.level + 1;
    const currentHigh = this.saveData?.arcadeHighScores?.["wordsearch"] ?? this.state.highScore;
    const carriedScore = this.state.score;
    this.state = createWordSearchGame(nextLvl, currentHigh, 8);
    this.state.score = carriedScore;
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
    if (this.container) {
      this.container.innerHTML = "";
    }
  }
}
