import { describe, expect, it } from "vitest";
import { hashString, mulberry32, type Rng } from "../src/gen/seededRng";
import { solvableFrom, trapReachable } from "../src/games/arrows/generate";
import { type ArrowTile, type ArrowsBoard, type Dir, bodyCells } from "../src/games/arrows/logic";

function randomDenseBoard(size: number, count: number, rng: Rng): ArrowsBoard | null {
  const occupied = new Set<number>();
  const arrows: ArrowTile[] = [];
  for (let id = 0; id < count; id += 1) {
    let placed: ArrowTile | null = null;
    for (let t = 0; t < 100 && !placed; t += 1) {
      const head = Math.floor(rng() * size * size);
      const dir = Math.floor(rng() * 4) as Dir;
      const cells = bodyCells(size, dir, head, 1);
      if (cells.some((cell) => occupied.has(cell))) continue;
      placed = { id, dir, head, length: 1, lock: 0 };
      for (const cell of cells) occupied.add(cell);
    }
    if (!placed) return null;
    arrows.push(placed);
  }
  return { size, arrows, seed: "dense" };
}

const heads = (board: ArrowsBoard): number[] => board.arrows.map((arrow) => arrow.head);
const bodies = (board: ArrowsBoard): number[] => board.arrows.map((arrow) => arrow.length);

describe("arrow escape dead ends", () => {
  it("dense scattered boards can reach a real dead end", { timeout: 60000 }, () => {
    const rng = mulberry32(hashString("dead-end-scan"));
    let trapped = 0;
    let solvable = 0;
    for (let i = 0; i < 200; i += 1) {
      const size = 4 + (i % 2);
      const board = randomDenseBoard(size, size + 3, rng);
      if (!board) continue;
      if (solvableFrom(size, board.arrows, heads(board), bodies(board)).solvable) solvable += 1;
      if (trapReachable(board, rng, 80)) trapped += 1;
    }
    expect(solvable).toBeGreaterThan(0);
    expect(trapped).toBeGreaterThan(5);
  });
});
