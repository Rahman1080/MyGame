import type { Cell, Coord, Puzzle } from "./types";

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function cloneCells(cells: Cell[]): Cell[] {
  return cells.map((c) => ({ ...c }));
}

export function inBounds(size: number, row: number, col: number): boolean {
  return row >= 0 && col >= 0 && row < size && col < size;
}

export function indexOfCell(cells: Cell[], row: number, col: number): number {
  return cells.findIndex((c) => c.row === row && c.col === col);
}

export function getCell(cells: Cell[], row: number, col: number): Cell | undefined {
  return cells.find((c) => c.row === row && c.col === col);
}

export function cellAt(puzzle: Puzzle, coord: Coord): Cell | undefined {
  return getCell(puzzle.cells, coord.row, coord.col);
}

export function requiredCount(cells: Cell[]): number {
  return cells.reduce((n, c) => n + (c.required ? 1 : 0), 0);
}

export function directionsOf(cells: Cell[]): (number | undefined)[] {
  return cells.map((c) => c.direction);
}
