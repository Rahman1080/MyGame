import { synth } from "../../audio/synth";
import { hapticTap } from "../../audio/haptics";
import { recordHighScore } from "../../save/storage";
import type { BasicScoreSave, SaveData } from "../../save/schema";
import {
  addIndexToPath,
  clearPath,
  createWordConnectGame,
  shuffleWheel,
  submitCurrentWord,
  useHint,
  type WordConnectState,
} from "./engine";
import { WordConnectRenderer } from "./render";
import { hitTestWheelNode } from "./layout";

export class WordConnectController {
  private state: WordConnectState;
  private renderer: WordConnectRenderer;
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animId = 0;
  private lastTime = 0;
  private isDragging = false;
  private cursorPos: { x: number; y: number } | null = null;
  private toastTimer = 0;
  private onBack: (() => void) | null = null;
  private onSave: ((s: SaveData) => void) | null = null;
  private saveData: SaveData | null = null;
  private arcadeSave: BasicScoreSave | null = null;
  private onArcadeSave: ((s: BasicScoreSave) => void) | null = null;
  private onArcadeReport: ((s: BasicScoreSave) => void) | null = null;
  private abortController: AbortController | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    this.state = createWordConnectGame(1, 0);
    this.renderer = new WordConnectRenderer();
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

    this.state = createWordConnectGame(startLevel, save.best ?? 0);
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

    const currentHigh = saveData.arcadeHighScores?.["wordconnect"] ?? 0;
    const startLevel = currentHigh > 0 && currentHigh <= 50 ? currentHigh : 1;
    this.state = createWordConnectGame(startLevel, currentHigh);

    this.renderDom();
    this.setupListeners();
    this.startLoop();
  }

  private renderDom(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="shell enter" style="padding-bottom: max(12px, var(--safe-bottom));">
        <div class="hud" style="grid-template-columns: 44px 1fr 44px;">
          <button class="icon-btn" data-act="back" aria-label="Back to Arcade">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            <span>Hub</span>
          </button>
          <div class="center-meta">
            <div class="lvl">WORD CONNECT · LVL ${this.state.level}</div>
            <div class="par">SCORE <b id="wc-score">${this.state.score}</b> · HIGH <b id="wc-high">${this.state.highScore}</b></div>
            <div class="par-sub" id="wc-progress" style="color: #FF9900; font-weight: 700;">SOLVED 0/${this.state.slots.length}</div>
          </div>
          <button class="icon-btn sm" data-act="reset-lvl" title="Restart Level" style="color: #64748b; font-size: 11px;">
            <span>Restart</span>
          </button>
        </div>

        <div class="board-wrap" style="flex: 1; position: relative; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 0; overflow: hidden;">
          <canvas id="wc-canvas" style="touch-action: none; width: 100%; height: 100%; display: block; cursor: grab;"></canvas>

          <!-- Ergonomic Wheel Flanking Controls (Thumb Level) -->
          <div class="wc-wheel-controls" style="position: absolute; bottom: 20px; width: 100%; max-width: 380px; display: flex; justify-content: space-between; padding: 0 16px; pointer-events: none; z-index: 5;">
            <button class="icon-btn" data-act="shuffle" id="wc-shuffle-btn" title="Shuffle Letters" style="pointer-events: auto; width: 48px; height: 48px; border-radius: 50%; border: 1.5px solid rgba(255,153,0,0.55); background: rgba(17,24,39,0.92); color: #FF9900; box-shadow: 0 0 14px rgba(255,153,0,0.35); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
            </button>

            <button class="icon-btn" data-act="hint" id="wc-hint-btn" title="Hint" style="pointer-events: auto; width: 48px; height: 48px; border-radius: 50%; border: 1.5px solid rgba(255,215,64,0.55); background: rgba(17,24,39,0.92); color: #FFD740; box-shadow: 0 0 14px rgba(255,215,64,0.35); display: flex; flex-direction: column; align-items: center; justify-content: center; backdrop-filter: blur(8px);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 6h8c1.5-1.5 3-3.5 3-6a7 7 0 0 0-7-7z"/></svg>
              <span id="wc-hint-badge" style="font-size: 10px; font-weight: 800; margin-top: -2px;">${this.state.hintsRemaining}</span>
            </button>
          </div>

          <!-- Floating Toast Notification Banner -->
          <div id="wc-toast" style="position: absolute; top: 12px; left: 50%; transform: translateX(-50%); background: rgba(11,16,29,0.95); border: 1.5px solid #FF9900; color: #FFD700; padding: 6px 18px; border-radius: 20px; font-weight: 700; font-size: 13px; pointer-events: none; opacity: 0; transition: opacity 0.2s ease; text-shadow: 0 0 10px rgba(255,153,0,0.6); z-index: 10;"></div>

          <!-- Win Modal Overlay -->
          <div id="wc-winmodal" class="overlay" style="display: none; z-index: 20;">
            <div class="win-card">
              <h2 style="color: #FF9900; text-shadow: 0 0 16px rgba(255,153,0,0.6);">AWESOME!</h2>
              <div class="win-meta" id="wc-final-stats">ALL WORDS SOLVED!</div>
              <div class="win-actions">
                <button class="cta-play" data-act="next-level">Next Level</button>
                <button class="ghost-btn" data-act="back">Return to Hub</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector<HTMLCanvasElement>("#wc-canvas");
    if (this.canvas) {
      this.ctx = this.canvas.getContext("2d");
      this.resizeCanvas();
    }
  }

  private resizeCanvas(): void {
    if (!this.canvas || !this.ctx) return;
    const dpr = window.devicePixelRatio || 1;

    // Keep the element fluid and let the stylesheet lay it out. The backing
    // buffer is then matched to the *rendered* box; if CSS scales a differently
    // sized buffer, pointer coordinates and drawn positions disagree and drags
    // never connect to the wheel nodes.
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width || window.innerWidth));
    const h = Math.max(1, Math.round(rect.height || 560));

    const bufferW = Math.round(w * dpr);
    const bufferH = Math.round(h * dpr);
    if (this.canvas.width !== bufferW) this.canvas.width = bufferW;
    if (this.canvas.height !== bufferH) this.canvas.height = bufferH;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }

  private canvasSize(): { w: number; h: number } {
    const c = this.canvas;
    if (!c) return { w: 0, h: 0 };
    return {
      w: c.clientWidth || c.width,
      h: c.clientHeight || c.height,
    };
  }

  private showToast(msg: string): void {
    this.toastTimer = 1.4;
    const toastEl = this.container?.querySelector<HTMLElement>("#wc-toast");
    if (toastEl) {
      toastEl.textContent = msg;
      toastEl.style.opacity = "1";
    }
  }

  private updateHud(): void {
    const scoreEl = this.container?.querySelector("#wc-score");
    const highEl = this.container?.querySelector("#wc-high");
    const hintBadge = this.container?.querySelector("#wc-hint-badge");
    const progressEl = this.container?.querySelector("#wc-progress");
    if (scoreEl) scoreEl.textContent = this.state.score.toString();
    if (highEl) highEl.textContent = this.state.highScore.toString();
    if (hintBadge) hintBadge.textContent = this.state.hintsRemaining.toString();
    if (progressEl) {
      const solved = this.state.slots.filter((s) => s.solved).length;
      const bonus = this.state.foundBonusWords.length;
      progressEl.textContent =
        `SOLVED ${solved}/${this.state.slots.length}` +
        (bonus > 0 ? ` · BONUS ${bonus}` : "");
    }
  }

  private checkSaveHighScore(): void {
    if (this.state.score > this.state.highScore) {
      this.state.highScore = this.state.score;
    }
    const currentLvl = this.state.level;
    if (this.arcadeSave && this.onArcadeSave) {
      const best = Math.max(this.arcadeSave.best ?? 0, this.state.score);
      this.arcadeSave.best = best;
      this.arcadeSave.level = Math.max(this.arcadeSave.level ?? 1, currentLvl);
      this.onArcadeSave({ best, level: this.arcadeSave.level });
    } else if (this.saveData && this.onSave) {
      const updated = recordHighScore(this.saveData, "wordconnect", this.state.score);
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

        if (target.dataset.act === "shuffle") {
          synth.tap();
          hapticTap();
          shuffleWheel(this.state);
          return;
        }

        if (target.dataset.act === "hint") {
          synth.tap();
          const hintRes = useHint(this.state);
          if (hintRes) {
            synth.powerup();
            hapticTap();
            this.updateHud();
            if (this.state.isCompleted) {
              this.handleVictory();
            }
          } else {
            this.showToast("No Hints Left!");
          }
          return;
        }

        if (target.dataset.act === "reset-lvl") {
          synth.tap();
          this.state = createWordConnectGame(this.state.level, this.state.highScore);
          this.checkSaveHighScore();
          this.renderDom();
          this.setupListeners();
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
      const getCanvasCoords = (clientX: number, clientY: number): { x: number; y: number } => {
        const rect = this.canvas!.getBoundingClientRect();
        return {
          x: clientX - rect.left,
          y: clientY - rect.top,
        };
      };

      const checkNodeCollision = (pos: { x: number; y: number }): number => {
        const { w, h } = this.canvasSize();
        const nodes = this.renderer.getWheelNodePositions(this.state, w, h);
        // 1.55x radius gives effortless touch tracking on mobile screens
        return hitTestWheelNode(pos.x, pos.y, nodes);
      };

      this.canvas.addEventListener(
        "pointerdown",
        (e) => {
          try {
            this.canvas?.setPointerCapture(e.pointerId);
          } catch {}
          const coords = getCanvasCoords(e.clientX, e.clientY);
          const hitIdx = checkNodeCollision(coords);
          if (hitIdx !== -1) {
            this.isDragging = true;
            this.cursorPos = coords;
            addIndexToPath(this.state, hitIdx);
            synth.step();
            hapticTap();
          }
        },
        { signal },
      );

      this.canvas.addEventListener(
        "pointermove",
        (e) => {
          if (!this.isDragging) return;
          const coords = getCanvasCoords(e.clientX, e.clientY);
          this.cursorPos = coords;
          const hitIdx = checkNodeCollision(coords);
          if (hitIdx !== -1) {
            const prevLen = this.state.activePath.length;
            const added = addIndexToPath(this.state, hitIdx);
            if (added && this.state.activePath.length !== prevLen) {
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
        this.cursorPos = null;

        const res = submitCurrentWord(this.state);
        if (res.type === "target") {
          synth.combo();
          hapticTap();
          this.checkSaveHighScore();
          this.showToast("EXCELLENT!");
          this.updateHud();

          if (this.state.isCompleted) {
            this.handleVictory();
          }
        } else if (res.type === "bonus") {
          synth.powerup();
          hapticTap();
          this.checkSaveHighScore();
          this.showToast(`BONUS WORD! +${res.scoreGained}`);
          this.updateHud();
        } else if (res.type === "already") {
          this.showToast("Already Found!");
        } else {
          clearPath(this.state);
        }
      };

      this.canvas.addEventListener("pointerup", handlePointerEnd, { signal });
      this.canvas.addEventListener("pointercancel", handlePointerEnd, { signal });
    }

    if (this.canvas?.parentElement && typeof ResizeObserver !== "undefined") {
      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
      this.resizeObserver.observe(this.canvas.parentElement);
    }

    window.addEventListener("resize", () => this.resizeCanvas(), { signal });
  }

  private handleVictory(): void {
    synth.star();
    const { w, h } = this.canvasSize();
    this.renderer.triggerVictoryBurst(w, h);
    this.checkSaveHighScore();
    this.onArcadeReport?.({
      best: this.state.highScore,
      level: this.state.level,
    });
    const modal = this.container?.querySelector<HTMLElement>("#wc-winmodal");
    const stats = this.container?.querySelector<HTMLElement>("#wc-final-stats");
    if (modal) modal.style.display = "flex";
    if (stats) stats.textContent = `SCORE: ${this.state.score} · BEST: ${this.state.highScore}`;
  }

  private advanceNextLevel(): void {
    const nextLvl = this.state.level + 1;
    const currentHigh =
      this.arcadeSave?.best ?? this.saveData?.arcadeHighScores?.["wordconnect"] ?? this.state.highScore;
    const carriedScore = this.state.score;
    this.state = createWordConnectGame(nextLvl, currentHigh);
    this.state.score = carriedScore;
    if (this.arcadeSave && this.onArcadeSave) {
      const best = Math.max(this.arcadeSave.best ?? 0, carriedScore);
      this.arcadeSave.best = best;
      this.arcadeSave.level = nextLvl;
      this.onArcadeSave({ best, level: nextLvl });
    }
    this.renderDom();
    this.setupListeners();
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(50, now - this.lastTime);
      this.lastTime = now;

      if (this.toastTimer > 0) {
        this.toastTimer -= dt / 1000;
        if (this.toastTimer <= 0) {
          const toastEl = this.container?.querySelector<HTMLElement>("#wc-toast");
          if (toastEl) toastEl.style.opacity = "0";
        }
      }

      this.renderer.update(dt / 1000, this.state);

      if (this.ctx && this.canvas) {
        const { w, h } = this.canvasSize();
        this.renderer.render(this.ctx, this.state, w, h, this.cursorPos);
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
