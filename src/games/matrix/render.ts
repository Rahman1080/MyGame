import type { MatrixGameState } from "./engine";

interface TileTheme {
  bg: string;
  glow: string;
  text: string;
  shadowBlur: number;
}

const TILE_THEMES: Record<number, TileTheme> = {
  2: { bg: "#0d2838", glow: "#00F2FF", text: "#00F2FF", shadowBlur: 6 },
  4: { bg: "#133550", glow: "#29DDF4", text: "#FFFFFF", shadowBlur: 8 },
  8: { bg: "#281b45", glow: "#9900FF", text: "#E0Aaff", shadowBlur: 10 },
  16: { bg: "#42184d", glow: "#D050FF", text: "#FFFFFF", shadowBlur: 12 },
  32: { bg: "#4d1d2b", glow: "#FF007F", text: "#FFFFFF", shadowBlur: 12 },
  64: { bg: "#5a1f26", glow: "#FF3366", text: "#FFFFFF", shadowBlur: 14 },
  128: { bg: "#523714", glow: "#FF9900", text: "#FFE5B4", shadowBlur: 16 },
  256: { bg: "#5c4811", glow: "#FFD700", text: "#FFFFFF", shadowBlur: 18 },
  512: { bg: "#16472b", glow: "#00FF66", text: "#E0FFED", shadowBlur: 20 },
  1024: { bg: "#144955", glow: "#00E5FF", text: "#FFFFFF", shadowBlur: 22 },
  2048: { bg: "#591c5c", glow: "#FF00FF", text: "#FFFFFF", shadowBlur: 26 },
};

export class MatrixRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    state: MatrixGameState,
    width: number,
    height: number,
  ): void {
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Deep neon background
    ctx.fillStyle = "#07080D";
    ctx.fillRect(0, 0, width, height);

    const pad = 12;
    const size = Math.min(width, height) - pad * 2;
    const startX = (width - size) / 2;
    const startY = (height - size) / 2;

    // Grid container frame
    ctx.save();
    ctx.fillStyle = "#0b0f19";
    ctx.strokeStyle = "rgba(41, 221, 244, 0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(startX, startY, size, size, 12);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const gap = 8;
    const cellSize = (size - gap * (state.size + 1)) / state.size;

    // Empty cell slots
    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        const x = startX + gap + c * (cellSize + gap);
        const y = startY + gap + r * (cellSize + gap);
        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        ctx.beginPath();
        ctx.roundRect(x, y, cellSize, cellSize, 8);
        ctx.fill();
      }
    }

    // Filled tiles
    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        const val = state.grid[r]?.[c];
        if (val === null || val === undefined) continue;

        const x = startX + gap + c * (cellSize + gap);
        const y = startY + gap + r * (cellSize + gap);
        const theme = TILE_THEMES[val] ?? {
          bg: "#441144",
          glow: "#FF00FF",
          text: "#FFFFFF",
          shadowBlur: 24,
        };

        ctx.save();
        ctx.fillStyle = theme.bg;
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = theme.shadowBlur;
        ctx.beginPath();
        ctx.roundRect(x, y, cellSize, cellSize, 8);
        ctx.fill();

        // Neon border outline
        ctx.strokeStyle = theme.glow;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Text value
        ctx.fillStyle = theme.text;
        ctx.shadowBlur = 4;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const fontSize = val < 100 ? cellSize * 0.46 : val < 1000 ? cellSize * 0.38 : cellSize * 0.3;
        ctx.font = `bold ${Math.floor(fontSize)}px "JetBrains Mono", monospace`;
        ctx.fillText(val.toString(), x + cellSize / 2, y + cellSize / 2);

        ctx.restore();
      }
    }

    ctx.restore();
  }
}
