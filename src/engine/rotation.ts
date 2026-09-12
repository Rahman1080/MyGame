import type { Direction } from "./types";

export function directionToDelta(direction: Direction): { dr: number; dc: number } {
  switch (direction) {
    case 0:
      return { dr: -1, dc: 0 };
    case 1:
      return { dr: 0, dc: 1 };
    case 2:
      return { dr: 1, dc: 0 };
    case 3:
      return { dr: 0, dc: -1 };
  }
}

export function rotateDirection(direction: Direction, steps = 1): Direction {
  const n = ((direction + steps) % 4 + 4) % 4;
  return n as Direction;
}

export function clockwiseDistance(from: Direction, to: Direction): number {
  return (to - from + 4) % 4;
}
