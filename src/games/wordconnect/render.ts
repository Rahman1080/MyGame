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
  ): Array<{ index: number; letter: string; x: number; y: number; radius: number }> {
    const cx = width / 2;
    const wheelCenterY = height - Math.min(height * 0.27, 132);
    const wheelRadius = Math.min(width * 0.33, height * 0.19, 96);
    const count = state.letters.length;
    const nodeRadius = Math.max(20, Math.min(26, Math.floor(wheelRadius * 0.3)));

    const nodes = [];
    for (let i = 0; i < count; i++) {
      const angle =
        -Math.PI / 2 +
        (2 * Math.PI * i) / count +
        this.currentShuffleAngle;
      const x = cx + Math.cos(angle) * wheelRadius;
      const y = wheelCenterY + Math.sin(angle) * wheelRadius;
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

    // 2. RENDER FLOATING CURRENT WORD PREVIEW BUBBLE
    this.renderFloatingPreview(ctx, state, width, height);

    // 3. RENDER LETTER WHEEL & TRACE LASER
    this.renderWheel(ctx, state, width, height, cursorPos);

    // 4. PARTICLES
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

  private renderWordSlots(
    ctx: CanvasRenderingContext2D,
    state: WordConnectState,
    width: number,
    height: number,
  ): void {
    const slots = state.slots;
    const count = slots.length;
    if (count === 0) return;

    // Determine max word length to scale boxes gracefully
    let maxLen = 3;
    for (const s of slots) {
      if (s.word.length > maxLen) maxLen = s.word.length;
    }

    const availableH = height * 0.44;
    const startY = 16;
    const gap = 6;
    const rowGap = Math.max(6, Math.min(10, Math.floor((availableH - count * 32) / (count + 1))));
    const boxSize = Math.max(26, Math.min(36, Math.floor((width - 40 - (maxLen - 1) * gap) / maxLen)));

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
          // Solved word: vibrant neon amber/gold
          ctx.fillStyle = "rgba(255, 153, 0, 0.22)";
          ctx.strokeStyle = "#FF9900";
          ctx.shadowColor = "#FF9900";
          ctx.shadowBlur = 12;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(bx, by, boxSize, boxSize, 7);
          ctx.fill();
          ctx.stroke();

          // Letter text
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
          ctx.roundRect(bx, by, boxSize, boxSize, 7);
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
          ctx.roundRect(bx, by, boxSize, boxSize, 7);
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
    const wheelCenterY = height - Math.min(height * 0.27, 132);
    const wheelRadius = Math.min(width * 0.33, height * 0.19, 96);
    const cy = wheelCenterY - wheelRadius - 32;

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
    const wheelCenterY = height - Math.min(height * 0.27, 132);
    const wheelRadius = Math.min(width * 0.33, height * 0.19, 96);
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
