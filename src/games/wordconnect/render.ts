import type { WordConnectState } from "./engine";

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
  progress: number; // 0 to 1
  duration: number;
}

export class WordConnectRenderer {
  private particles: WordConnectParticle[] = [];
  private flyingLetters: FlyingLetter[] = [];
  private currentShuffleAngle = 0;
  private targetShuffleAngle = 0;

  triggerVictoryBurst(width: number, height: number): void {
    const colors = ["#FF9900", "#FFD700", "#FF007F", "#00FFA3", "#00F2FF"];
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 180;
      this.particles.push({
        x: width / 2,
        y: height * 0.4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        color: colors[Math.floor(Math.random() * colors.length)]!,
        size: 3 + Math.random() * 3,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.4,
      });
    }
  }

  update(dtSeconds: number, state: WordConnectState): void {
    // Smooth shuffle rotation
    this.targetShuffleAngle = state.shuffleAngle;
    this.currentShuffleAngle +=
      (this.targetShuffleAngle - this.currentShuffleAngle) * 0.2;

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
      p.vy += 120 * dtSeconds; // Gravity
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
  ): Array<{ index: number; letter: string; x: number; y: number; radius: number }> {
    const cx = width / 2;
    const cy = height - 98;
    const wheelRadius = Math.min(width * 0.28, 76);
    const nodeRadius = 22;
    const count = state.letters.length;

    const nodes = [];
    for (let i = 0; i < count; i++) {
      const angle =
        -Math.PI / 2 +
        (2 * Math.PI * i) / count +
        this.currentShuffleAngle;
      const x = cx + Math.cos(angle) * wheelRadius;
      const y = cy + Math.sin(angle) * wheelRadius;
      nodes.push({
        index: i,
        letter: state.letters[i]!,
        x,
        y,
        radius: nodeRadius,
      });
    }
    return nodes;
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

    // Deep neon background
    ctx.fillStyle = "#07080D";
    ctx.fillRect(0, 0, width, height);

    // Bounding frame
    ctx.strokeStyle = "rgba(255, 153, 0, 0.25)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // 1. RENDER TOP WORD SLOTS
    this.renderWordSlots(ctx, state, width);

    // 2. RENDER FLOATING CURRENT WORD PREVIEW BUBBLE
    this.renderFloatingPreview(ctx, state, width, height);

    // 3. RENDER LETTER WHEEL & TRACE LINE
    this.renderWheel(ctx, state, width, height, cursorPos);

    // 4. PARTICLES
    for (const p of this.particles) {
      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  private renderWordSlots(
    ctx: CanvasRenderingContext2D,
    state: WordConnectState,
    width: number,
  ): void {
    const slots = state.slots;
    const count = slots.length;
    if (count === 0) return;

    const startY = 16;
    const boxSize = 28;
    const gap = 5;
    const rowGap = 8;

    // Distribute slots vertically
    let curY = startY;
    for (let s = 0; s < count; s++) {
      const slot = slots[s]!;
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
          // Solved word box: rich neon gold / orange fill
          ctx.fillStyle = "rgba(255, 153, 0, 0.25)";
          ctx.strokeStyle = "#FF9900";
          ctx.shadowColor = "#FF9900";
          ctx.shadowBlur = 10;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.roundRect(bx, by, boxSize, boxSize, 6);
          ctx.fill();
          ctx.stroke();

          // Letter text
          ctx.fillStyle = "#FFFFFF";
          ctx.shadowColor = "#FFD700";
          ctx.shadowBlur = 4;
          ctx.font = `bold ${Math.floor(boxSize * 0.6)}px "JetBrains Mono", monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(slot.word[c]!, bx + boxSize / 2, by + boxSize / 2);
        } else if (isRevealed) {
          // Individual letter revealed by hint
          ctx.fillStyle = "rgba(0, 255, 163, 0.2)";
          ctx.strokeStyle = "#00FFA3";
          ctx.shadowColor = "#00FFA3";
          ctx.shadowBlur = 8;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(bx, by, boxSize, boxSize, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#00FFA3";
          ctx.font = `bold ${Math.floor(boxSize * 0.6)}px "JetBrains Mono", monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(char!, bx + boxSize / 2, by + boxSize / 2);
        } else {
          // Empty unsolved box
          ctx.fillStyle = "#0B101D";
          ctx.strokeStyle = "rgba(255, 153, 0, 0.35)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.roundRect(bx, by, boxSize, boxSize, 6);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }

      curY += boxSize + rowGap;
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
    const cy = height - 200;

    ctx.save();
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    const textMetrics = ctx.measureText(state.currentWord);
    const pillW = Math.max(80, textMetrics.width + 36);
    const pillH = 34;

    // Glowing bubble pill
    ctx.fillStyle = "rgba(11, 16, 29, 0.9)";
    ctx.strokeStyle = "#FF9900";
    ctx.shadowColor = "#FF9900";
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - pillW / 2, cy - pillH / 2, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.stroke();

    // Spelled text
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "#FFD700";
    ctx.shadowBlur = 6;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(state.currentWord, cx, cy);

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
    const cy = height - 98;
    const wheelRadius = Math.min(width * 0.28, 76);
    const nodes = this.getWheelNodePositions(state, width, height);

    // 1. Wheel outer glow halo
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, wheelRadius + 18, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 153, 0, 0.04)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 153, 0, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.restore();

    // 2. Active Laser Connecting Line
    if (state.activePath.length > 0) {
      ctx.save();
      ctx.strokeStyle = "#FF9900";
      ctx.shadowColor = "#FF9900";
      ctx.shadowBlur = 14;
      ctx.lineWidth = 4.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      const firstIdx = state.activePath[0]!;
      const firstNode = nodes[firstIdx]!;
      ctx.moveTo(firstNode.x, firstNode.y);

      for (let i = 1; i < state.activePath.length; i++) {
        const nodeIdx = state.activePath[i]!;
        const node = nodes[nodeIdx]!;
        ctx.lineTo(node.x, node.y);
      }

      // Draw line to current cursor
      if (cursorPos) {
        ctx.lineTo(cursorPos.x, cursorPos.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 3. Wheel Letter Orbs
    for (const node of nodes) {
      const isSelected = state.activePath.includes(node.index);

      ctx.save();
      if (isSelected) {
        // Active selected orb
        ctx.fillStyle = "#FF9900";
        ctx.shadowColor = "#FF9900";
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 1.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#07080D";
        ctx.shadowBlur = 0;
      } else {
        // Idle orb
        ctx.fillStyle = "#111827";
        ctx.shadowColor = "rgba(255, 153, 0, 0.4)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(255, 153, 0, 0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#FFFFFF";
        ctx.shadowBlur = 4;
        ctx.shadowColor = "#FF9900";
      }

      ctx.font = 'bold 20px "JetBrains Mono", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.letter, node.x, node.y);

      ctx.restore();
    }
  }
}
