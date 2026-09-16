export type MatrixDirection = "up" | "down" | "left" | "right";

export interface MatrixTile {
  value: number;
  id: number;
  merged?: boolean;
}

export interface MatrixHistoryEntry {
  grid: (number | null)[][];
  score: number;
}

export interface MatrixGameState {
  size: number;
  grid: (number | null)[][];
  score: number;
  highScore: number;
  won: boolean;
  gameOver: boolean;
  history: MatrixHistoryEntry[];
}

export function createMatrixGame(size = 4, highScore = 0): MatrixGameState {
  const grid: (number | null)[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );

  const state: MatrixGameState = {
    size,
    grid,
    score: 0,
    highScore,
    won: false,
    gameOver: false,
    history: [],
  };

  spawnRandomTile(state);
  spawnRandomTile(state);
  return state;
}

export function cloneGrid(grid: (number | null)[][]): (number | null)[][] {
  return grid.map((row) => [...row]);
}

export function spawnRandomTile(
  state: MatrixGameState,
  rng = Math.random,
): { r: number; c: number; value: number } | null {
  const empty: Array<{ r: number; c: number }> = [];
  for (let r = 0; r < state.size; r++) {
    for (let c = 0; c < state.size; c++) {
      if (state.grid[r]![c] === null) {
        empty.push({ r, c });
      }
    }
  }

  if (empty.length === 0) return null;
  const pick = empty[Math.floor(rng() * empty.length)]!;
  const value = rng() < 0.9 ? 2 : 4;
  state.grid[pick.r]![pick.c] = value;
  return { r: pick.r, c: pick.c, value };
}

export interface MatrixMoveResult {
  moved: boolean;
  scoreGained: number;
  mergedValues: number[];
  mergedTiles?: { r: number; c: number; value: number }[];
  reached2048: boolean;
  isGameOver: boolean;
  spawnedTile?: { r: number; c: number; value: number } | null;
}

export function moveMatrix(
  state: MatrixGameState,
  direction: MatrixDirection,
  rng = Math.random,
): MatrixMoveResult {
  const result: MatrixMoveResult = {
    moved: false,
    scoreGained: 0,
    mergedValues: [],
    mergedTiles: [],
    reached2048: false,
    isGameOver: false,
  };

  if (state.gameOver) return result;

  const prevGrid = cloneGrid(state.grid);
  const prevScore = state.score;
  const size = state.size;

  const rotate = (g: (number | null)[][]): (number | null)[][] => {
    const rotated: (number | null)[][] = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => null),
    );
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        rotated[c]![size - 1 - r] = g[r]![c]!;
      }
    }
    return rotated;
  };

  // Standardize move as sliding left
  let rotations = 0;
  if (direction === "up") rotations = 3;
  else if (direction === "right") rotations = 2;
  else if (direction === "down") rotations = 1;

  let current = cloneGrid(state.grid);
  for (let i = 0; i < rotations; i++) current = rotate(current);

  // Slide and merge rows left
  let moved = false;
  let gained = 0;
  const mergedVals: number[] = [];
  const mergedCoords: { r: number; c: number; value: number }[] = [];

  for (let r = 0; r < size; r++) {
    const row = current[r]!.filter((v) => v !== null) as number[];
    const mergedRow: number[] = [];

    let i = 0;
    while (i < row.length) {
      if (i + 1 < row.length && row[i] === row[i + 1]) {
        const merged = row[i]! * 2;
        mergedRow.push(merged);
        gained += merged;
        mergedVals.push(merged);
        mergedCoords.push({ r, c: mergedRow.length - 1, value: merged });
        if (merged === 2048 && !state.won) {
          result.reached2048 = true;
          state.won = true;
        }
        i += 2;
      } else {
        mergedRow.push(row[i]!);
        i += 1;
      }
    }

    while (mergedRow.length < size) {
      mergedRow.push(null as unknown as number);
    }

    for (let c = 0; c < size; c++) {
      const val: number | null = mergedRow[c] ?? null;
      if (current[r]![c] !== val) {
        moved = true;
      }
      current[r]![c] = val;
    }
  }

  // Rotate back to original orientation
  const backRotations = (4 - rotations) % 4;
  for (let i = 0; i < backRotations; i++) current = rotate(current);

  // Rotate merged coordinates back to original orientation
  const rotatePoint = (pt: { r: number; c: number }): { r: number; c: number } => ({
    r: pt.c,
    c: size - 1 - pt.r,
  });
  result.mergedTiles = mergedCoords.map((mc) => {
    let p = { r: mc.r, c: mc.c };
    for (let i = 0; i < backRotations; i++) p = rotatePoint(p);
    return { r: p.r, c: p.c, value: mc.value };
  });

  if (moved) {
    // Save history for undo
    state.history.push({ grid: prevGrid, score: prevScore });
    if (state.history.length > 5) state.history.shift();

    state.grid = current;
    state.score += gained;
    if (state.score > state.highScore) {
      state.highScore = state.score;
    }
    result.moved = true;
    result.scoreGained = gained;
    result.mergedValues = mergedVals;

    result.spawnedTile = spawnRandomTile(state, rng);

    if (!canMove(state)) {
      state.gameOver = true;
      result.isGameOver = true;
    }
  }

  return result;
}

export function canMove(state: MatrixGameState): boolean {
  const size = state.size;
  // Check empty cells
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (state.grid[r]![c] === null) return true;
    }
  }

  // Check horizontal and vertical merges
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const val = state.grid[r]![c];
      if (c + 1 < size && state.grid[r]![c + 1] === val) return true;
      if (r + 1 < size && state.grid[r + 1]![c] === val) return true;
    }
  }

  return false;
}

export function undoMatrix(state: MatrixGameState): boolean {
  const prev = state.history.pop();
  if (!prev) return false;
  state.grid = cloneGrid(prev.grid);
  state.score = prev.score;
  state.gameOver = false;
  return true;
}
