import { synth } from "../../audio/synth";
import { hapticTap } from "../../audio/haptics";
import { recordHighScore } from "../../save/storage";
import type { SaveData } from "../../save/schema";
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

  constructor() {
    this.state = createWordConnectGame(1, 0);
    this.renderer = new WordConnectRenderer();
  }

  mountArcade(
    container: HTMLElement,
    onBack: () => void,
    save: { best: number },
    onSave: (s: { best: number }) => void,
  ): void {
    this.container = container;
    this.onBack = onBack;
    this.state = createWordConnectGame(1, save.best ?? 0);
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

    const currentHigh = saveData.arcadeHighScores?.["wordconnect"] ?? 0;
    this.state = createWordConnectGame(1, currentHigh);

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
            <div class="lvl">WORD CONNECT · LVL ${this.state.level}</div>
            <div class="par">SCORE <b id="wc-score">${this.state.score}</b> · HIGH <b id="wc-high">${this.state.highScore}</b></div>
            <div class="par-sub" id="wc-bonus-info" style="color: #FF9900; font-weight: 700;">SWIPE LETTERS TO CONNECT</div>
          </div>
          <button class="icon-btn" data-act="hint" id="wc-hint-btn" aria-label="Hint">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 6h8c1.5-1.5 3-3.5 3-6a7 7 0 0 0-7-7z"/></svg>
            <span id="wc-hint-text">Hint (${this.state.hintsRemaining})</span>
          </button>
        </div>

        <div class="board-wrap" style="align-items: center; justify-content: center; position: relative;">
          <canvas id="wc-canvas" width="340" height="460" style="touch-action: none; border-radius: 14px; max-width: 92vw; max-height: 56vh; cursor: grab;"></canvas>

          <!-- Floating Toast Notification Banner -->
          <div id="wc-toast" style="position: absolute; top: 12px; left: 50%; transform: translateX(-50%); background: rgba(11,16,29,0.92); border: 1.5px solid #FF9900; color: #FFD700; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 12px; pointer-events: none; opacity: 0; transition: opacity 0.2s ease; text-shadow: 0 0 8px rgba(255,153,0,0.6);"></div>

          <!-- Win Modal Overlay -->
          <div id="wc-winmodal" class="overlay" style="display: none;">
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

        <!-- Controls: Shuffle Prop Button -->
        <div class="dock" style="display: flex; justify-content: center; gap: 16px; margin-top: 8px;">
          <button class="icon-btn" data-act="shuffle" id="wc-shuffle-btn" style="padding: 6px 18px; border-radius: 20px; border: 1px solid rgba(255,153,0,0.4); background: rgba(17,24,39,0.8); color: #FF9900; font-weight: 700;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
            <span style="margin-left: 6px;">Shuffle</span>
          </button>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector<HTMLCanvasElement>("#wc-canvas");
    if (this.canvas) {
      this.ctx = this.canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      const w = Math.min(340, Math.floor(window.innerWidth * 0.92));
      const h = Math.floor(w * (460 / 340));
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
      if (this.ctx) {
        this.ctx.scale(dpr * (w / 340), dpr * (h / 460));
      }
    }
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
    const hintText = this.container?.querySelector("#wc-hint-text");
    if (scoreEl) scoreEl.textContent = this.state.score.toString();
    if (highEl) highEl.textContent = this.state.highScore.toString();
    if (hintText) hintText.textContent = `Hint (${this.state.hintsRemaining})`;
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

      if (target.dataset.act === "next-level") {
        synth.tap();
        this.advanceNextLevel();
        return;
      }
    });

    if (this.canvas) {
      const getCanvasCoords = (clientX: number, clientY: number): { x: number; y: number } => {
        const rect = this.canvas!.getBoundingClientRect();
        const normX = (clientX - rect.left) / rect.width;
        const normY = (clientY - rect.top) / rect.height;
        return { x: normX * 340, y: normY * 460 };
      };

      const checkNodeCollision = (pos: { x: number; y: number }): number => {
        const nodes = this.renderer.getWheelNodePositions(this.state, 340, 460);
        for (const n of nodes) {
          const dx = pos.x - n.x;
          const dy = pos.y - n.y;
          if (dx * dx + dy * dy <= (n.radius * 1.3) * (n.radius * 1.3)) {
            return n.index;
          }
        }
        return -1;
      };

      this.canvas.addEventListener("pointerdown", (e) => {
        const coords = getCanvasCoords(e.clientX, e.clientY);
        const hitIdx = checkNodeCollision(coords);
        if (hitIdx !== -1) {
          this.isDragging = true;
          this.cursorPos = coords;
          addIndexToPath(this.state, hitIdx);
          synth.step();
          hapticTap();
        }
      });

      this.canvas.addEventListener("pointermove", (e) => {
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
      });

      const handlePointerEnd = (): void => {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.cursorPos = null;

        const res = submitCurrentWord(this.state);
        if (res.type === "target") {
          synth.combo();
          hapticTap();
          this.showToast("AWESOME!");
          this.updateHud();

          if (this.state.isCompleted) {
            this.handleVictory();
          }
        } else if (res.type === "bonus") {
          synth.powerup();
          hapticTap();
          this.showToast(`BONUS WORD! +${res.scoreGained}`);
          this.updateHud();
        } else if (res.type === "already") {
          this.showToast("Already Found!");
        } else {
          clearPath(this.state);
        }
      };

      this.canvas.addEventListener("pointerup", handlePointerEnd);
      this.canvas.addEventListener("pointercancel", handlePointerEnd);
    }
  }

  private handleVictory(): void {
    synth.star();
    this.renderer.triggerVictoryBurst(340, 460);
    if (this.saveData && this.onSave) {
      const updated = recordHighScore(this.saveData, "wordconnect", this.state.score);
      this.saveData = updated;
      this.onSave(updated);
    }
    const modal = this.container?.querySelector<HTMLElement>("#wc-winmodal");
    const stats = this.container?.querySelector<HTMLElement>("#wc-final-stats");
    if (modal) modal.style.display = "flex";
    if (stats) stats.textContent = `SCORE: ${this.state.score} · BEST: ${this.state.highScore}`;
  }

  private advanceNextLevel(): void {
    const nextLvl = this.state.level + 1;
    const currentHigh = this.saveData?.arcadeHighScores?.["wordconnect"] ?? this.state.highScore;
    const carriedScore = this.state.score;
    this.state = createWordConnectGame(nextLvl, currentHigh);
    this.state.score = carriedScore;
    this.renderDom();
    this.setupListeners();
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(50, now - this.lastTime);
      this.lastTime = now;

      // Update toast timer
      if (this.toastTimer > 0) {
        this.toastTimer -= dt / 1000;
        if (this.toastTimer <= 0) {
          const toastEl = this.container?.querySelector<HTMLElement>("#wc-toast");
          if (toastEl) toastEl.style.opacity = "0";
        }
      }

      this.renderer.update(dt / 1000, this.state);

      if (this.ctx && this.canvas) {
        this.renderer.render(this.ctx, this.state, 340, 460, this.cursorPos);
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
