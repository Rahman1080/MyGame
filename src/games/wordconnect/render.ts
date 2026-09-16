import type { WordConnectState } from "./engine";
import {
  wheelGeometry,
  wheelNodePositions,
  type WheelNode,
} from "./layout";

export interface WordConnectParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface FlyingLetter {
  char: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number;
  duration: number;
}

export class WordConnectRenderer {
  private particles: WordConnectParticle[] = [];
  private flyingLetters: FlyingLetter[] = [];
  private currentShuffleAngle = 0;
  private targetShuffleAngle = 0;

  triggerVictoryBurst(width: number, height: number): void {
    const colors = ["#FF9900", "#FFD700", "#FF007F", "#00FFA3", "#00F2FF"];
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 200;
      this.particles.push({
        x: width / 2,
        y: height * 0.35,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        color: colors[Math.floor(Math.random() * colors.length)]!,
        size: 3 + Math.random() * 3.5,
        life: 0,
        maxLife: 0.9 + Math.random() * 0.5,
      });
    }
  }

  update(dtSeconds: number, state: WordConnectState): void {
    this.targetShuffleAngle = state.shuffleAngle;
    this.currentShuffleAngle +=
      (this.targetShuffleAngle - this.currentShuffleAngle) * 0.22;

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dtSeconds;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dtSeconds;
      p.y += p.vy * dtSeconds;
      p.vy += 140 * dtSeconds;
      p.vx *= 0.96;
    }

    // Update flying letters
    for (let i = this.flyingLetters.length - 1; i >= 0; i--) {
      const fl = this.flyingLetters[i]!;
      fl.progress += dtSeconds / fl.duration;
      if (fl.progress >= 1) {
        this.flyingLetters.splice(i, 1);
      }
    }
  }

  getWheelNodePositions(
    state: WordConnectState,
    width: number,
    height: number,
  ): WheelNode[] {
    return wheelNodePositions(state, width, height, this.currentShuffleAngle);
  }

  render(
    ctx: CanvasRenderingContext2D,
    state: WordConnectState,
    width: number,
    height: number,
    cursorPos: { x: number; y: number } | null,
  ): void {
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Deep immersive background (NO bounding box or frame border!)
    ctx.fillStyle = "#07080D";
    ctx.fillRect(0, 0, width, height);

    // Subtle ambient top glow
    const topGlow = ctx.createRadialGradient(
      width / 2,
      height * 0.15,
      20,
      width / 2,
      height * 0.15,
      width * 0.6,
    );
    topGlow.addColorStop(0, "rgba(255, 153, 0, 0.08)");
    topGlow.addColorStop(1, "transparent");
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, width, height * 0.5);

    // 1. RENDER TOP WORD SLOTS (Spacious, fluid crossword layout)
    this.renderWordSlots(ctx, state, width, height);

    // 2. BONUS WORD CHIPS / PROMPT (fills the mid-board space)
    this.renderBonusWords(ctx, state, width, height);

    // 3. RENDER FLOATING CURRENT WORD PREVIEW BUBBLE
    this.renderFloatingPreview(ctx, state, width, height);

    // 4. RENDER LETTER WHEEL & TRACE LASER
    this.renderWheel(ctx, state, width, height, cursorPos);

    // 5. PARTICLES
    for (const p of this.particles) {
      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  private slotsLayout(
    width: number,
    slots: WordConnectState["slots"],
  ): {
    count: number;
    maxLen: number;
    gap: number;
    rowGap: number;
    boxSize: number;
    startY: number;
    totalH: number;
    bottomY: number;
  } {
    const count = Math.max(1, slots.length);
    let maxLen = 3;
    for (const s of slots) {
      if (s.word.length > maxLen) maxLen = s.word.length;
    }
    const gap = 8;
    const rowGap = count > 3 ? 10 : 14;
    const boxSize = Math.max(
      28,
      Math.min(52, Math.floor((width - 36 - (maxLen - 1) * gap) / maxLen)),
    );
    const totalH = count * boxSize + (count - 1) * rowGap;
    const startY = 18;
    return {
      count,
      maxLen,
      gap,
      rowGap,
      boxSize,
      startY,
      totalH,
      bottomY: startY + totalH,
    };
  }

  private renderWordSlots(
    ctx: CanvasRenderingContext2D,
    state: WordConnectState,
    width: number,
    _height: number,
  ): void {
    const slots = state.slots;
    if (slots.length === 0) return;

    const { gap, rowGap, boxSize, startY, bottomY } = this.slotsLayout(
      width,
      slots,
    );

    // Soft glass panel behind the answer rows
    ctx.save();
    ctx.fillStyle = "rgba(13, 18, 32, 0.72)";
    ctx.strokeStyle = "rgba(255, 153, 0, 0.22)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(10, 8, width - 20, bottomY - 8 + 12, 16);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    let curY = startY;
    for (const slot of slots) {
      const wordLen = slot.word.length;
      const totalRowW = wordLen * boxSize + (wordLen - 1) * gap;
      const rowStartX = (width - totalRowW) / 2;

      for (let c = 0; c < wordLen; c++) {
        const bx = rowStartX + c * (boxSize + gap);
        const by = curY;
        const char = slot.revealedLetters[c];
        const isRevealed = Boolean(char && char !== "");

        ctx.save();
        if (slot.solved) {
          // Solved word: vibrant neon amber/gold
          ctx.fillStyle = "rgba(255, 153, 0, 0.24)";
          ctx.strokeStyle = "#FF9900";
          ctx.shadowColor = "#FF9900";
          ctx.shadowBlur = 14;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(bx, by, boxSize, boxSize, 9);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#FFFFFF";
          ctx.shadowColor = "#FFD700";
          ctx.shadowBlur = 6;
          ctx.font = `bold ${Math.floor(boxSize * 0.58)}px Orbitron, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(slot.word[c]!, bx + boxSize / 2, by + boxSize / 2 + 1);
        } else if (isRevealed) {
          // Hinted single letter
          ctx.fillStyle = "rgba(41, 221, 244, 0.16)";
          ctx.strokeStyle = "#29DDF4";
          ctx.shadowColor = "#29DDF4";
          ctx.shadowBlur = 10;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.roundRect(bx, by, boxSize, boxSize, 9);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#29DDF4";
          ctx.shadowColor = "#29DDF4";
          ctx.shadowBlur = 6;
          ctx.font = `bold ${Math.floor(boxSize * 0.58)}px Orbitron, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(char!, bx + boxSize / 2, by + boxSize / 2 + 1);
        } else {
          // Empty unsolved slot
          ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
          ctx.strokeStyle = "rgba(255, 153, 0, 0.35)";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.roundRect(bx, by, boxSize, boxSize, 9);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
      curY += boxSize + rowGap;
    }
  }

  /**
   * Fills the middle of the board with found bonus words, or an informative
   * prompt so the composition never reads as empty dead space.
   */
  private renderBonusWords(
    ctx: CanvasRenderingContext2D,
    state: WordConnectState,
    width: number,
    height: number,
  ): void {
    const { bottomY } = this.slotsLayout(width, state.slots);
    const { cy: wheelCenterY, radius: wheelRadius } = wheelGeometry(
      width,
      height,
    );
    const previewY = wheelCenterY - wheelRadius - 34;
    const regionTop = bottomY + 24;
    const regionBottom = previewY - 26;
    if (regionBottom <= regionTop) return;

    const found = state.foundBonusWords;
    const centerY = (regionTop + regionBottom) / 2;

    if (found.length === 0) {
      ctx.save();
      ctx.fillStyle = "rgba(255, 153, 0, 0.55)";
      ctx.font = "700 11px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("SWIPE ACROSS LETTERS TO SPELL", width / 2, centerY - 8);
      if (state.bonusWords.length > 0) {
        ctx.fillStyle = "rgba(255, 215, 64, 0.42)";
        ctx.fillText(
          `${state.bonusWords.length} BONUS WORDS HIDDEN`,
          width / 2,
          centerY + 12,
        );
      }
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.fillStyle = "rgba(255, 215, 64, 0.6)";
    ctx.font = "700 10px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `BONUS WORDS ${found.length}/${state.bonusWords.length}`,
      width / 2,
      regionTop,
    );
    ctx.restore();

    const chipH = 26;
    const chipGap = 8;
    const maxW = width - 32;
    ctx.font = "700 11px Orbitron, sans-serif";
    const rows: string[][] = [];
    let row: string[] = [];
    let rowW = 0;
    for (const word of found) {
      const w = ctx.measureText(word).width + 22;
      const extra = row.length === 0 ? w : rowW + chipGap + w;
      if (extra > maxW && row.length > 0) {
        rows.push(row);
        row = [word];
        rowW = w;
      } else {
        row.push(word);
        rowW = extra;
      }
    }
    if (row.length > 0) rows.push(row);

    const totalH = rows.length * chipH + (rows.length - 1) * chipGap;
    let y = centerY - totalH / 2 + chipH / 2;
    for (const r of rows) {
      let total = 0;
      for (const word of r) total += ctx.measureText(word).width + 22;
      total += (r.length - 1) * chipGap;
      let x = (width - total) / 2;
      for (const word of r) {
        const cw = ctx.measureText(word).width + 22;
        ctx.save();
        ctx.fillStyle = "rgba(255, 215, 64, 0.1)";
        ctx.strokeStyle = "rgba(255, 215, 64, 0.6)";
        ctx.lineWidth = 1.3;
        ctx.shadowColor = "rgba(255, 215, 64, 0.5)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.roundRect(x, y - chipH / 2, cw, chipH, chipH / 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#FFE082";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(word, x + cw / 2, y + 1);
        ctx.restore();
        x += cw + chipGap;
      }
      y += chipH + chipGap;
    }
  }

  private renderFloatingPreview(
    ctx: CanvasRenderingContext2D,
    state: WordConnectState,
    width: number,
    height: number,
  ): void {
    if (state.currentWord.length === 0) return;

    const cx = width / 2;
    const { cy: wheelCenterY, radius: wheelRadius } = wheelGeometry(width, height);
    const cy = wheelCenterY - wheelRadius - 34;

    ctx.save();
    ctx.font = 'bold 20px Orbitron, sans-serif';
    const textMetrics = ctx.measureText(state.currentWord);
    const pillW = Math.max(90, textMetrics.width + 42);
    const pillH = 38;

    // Glowing bubble pill
    ctx.fillStyle = "rgba(11, 16, 29, 0.95)";
    ctx.strokeStyle = "#FF9900";
    ctx.shadowColor = "#FF9900";
    ctx.shadowBlur = 16;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(cx - pillW / 2, cy - pillH / 2, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.stroke();

    // Spelled text
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "#FFD700";
    ctx.shadowBlur = 8;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(state.currentWord, cx, cy + 1);

    ctx.restore();
  }

  private renderWheel(
    ctx: CanvasRenderingContext2D,
    state: WordConnectState,
    width: number,
    height: number,
    cursorPos: { x: number; y: number } | null,
  ): void {
    const cx = width / 2;
    const {
      cy: wheelCenterY,
      radius: wheelRadius,
    } = wheelGeometry(width, height);
    const nodes = this.getWheelNodePositions(state, width, height);

    // 1. Wheel outer glow disc background
    ctx.save();
    const discGrad = ctx.createRadialGradient(
      cx,
      wheelCenterY,
      20,
      cx,
      wheelCenterY,
      wheelRadius + 22,
    );
    discGrad.addColorStop(0, "rgba(17, 24, 39, 0.88)");
    discGrad.addColorStop(0.85, "rgba(11, 15, 25, 0.85)");
    discGrad.addColorStop(1, "rgba(255, 153, 0, 0.12)");

    ctx.beginPath();
    ctx.arc(cx, wheelCenterY, wheelRadius + 22, 0, Math.PI * 2);
    ctx.fillStyle = discGrad;
    ctx.fill();

    // Subtle dashed neon boundary ring
    ctx.strokeStyle = "rgba(255, 153, 0, 0.32)";
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.restore();

    // 2. Active Laser Connecting Line
    if (state.activePath.length > 0) {
      ctx.save();
      // Broad laser glow pass
      ctx.strokeStyle = "rgba(255, 153, 0, 0.4)";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const firstIdx = state.activePath[0]!;
      const firstNode = nodes[firstIdx]!;
      ctx.moveTo(firstNode.x, firstNode.y);

      for (let i = 1; i < state.activePath.length; i++) {
        const nodeIdx = state.activePath[i]!;
        const n = nodes[nodeIdx]!;
        ctx.lineTo(n.x, n.y);
      }
      if (cursorPos) {
        ctx.lineTo(cursorPos.x, cursorPos.y);
      }
      ctx.stroke();

      // Sharp bright laser core pass
      ctx.strokeStyle = "#FFF275";
      ctx.shadowColor = "#FF9900";
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3.6;
      ctx.stroke();
      ctx.restore();
    }

    // 3. Render Circular Letter Nodes
    for (const node of nodes) {
      const isSelected = state.activePath.includes(node.index);
      ctx.save();

      if (isSelected) {
        // High-energy glowing active node
        ctx.fillStyle = "#FF9900";
        ctx.shadowColor = "#FF9900";
        ctx.shadowBlur = 18;
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 1.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#07080D";
        ctx.font = `bold ${Math.floor(node.radius * 1.15)}px Orbitron, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.letter, node.x, node.y + 1);
      } else {
        // Idle node: dark glass with crisp neon rim
        ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
        ctx.strokeStyle = "rgba(255, 153, 0, 0.65)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#FFFFFF";
        ctx.shadowColor = "rgba(255, 153, 0, 0.5)";
        ctx.shadowBlur = 6;
        ctx.font = `bold ${Math.floor(node.radius * 1.1)}px Orbitron, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.letter, node.x, node.y + 1);
      }

      ctx.restore();
    }
  }
}
