export class Synth {
  private ctx: AudioContext | null = null;
  muted = false;

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  private audio(): AudioContext | null {
    if (this.muted) return null;
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private beep(freq: number, dur: number, type: OscillatorType, gain = 0.04): void {
    const ctx = this.audio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  rotate(): void {
    this.beep(420, 0.06, "square", 0.03);
  }

  launch(): void {
    this.beep(220, 0.12, "sawtooth", 0.04);
  }

  travel(): void {
    this.beep(640, 0.04, "sine", 0.02);
  }

  success(): void {
    this.beep(523, 0.1, "sine", 0.05);
    setTimeout(() => this.beep(784, 0.16, "sine", 0.05), 80);
  }

  fail(): void {
    this.beep(180, 0.18, "triangle", 0.04);
  }
}

export const synth = new Synth();
