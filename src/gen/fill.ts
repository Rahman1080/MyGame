import type { Cell } from "../engine/types";

export function fillFromMap(size: number, map: Map<string, Cell>): Cell[] {
  const cells: Cell[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      cells.push(
        map.get(`${row},${col}`) ?? {
          row,
          col,
          type: "empty",
          required: false,
        },
      );
    }
  }
  return cells;
}
