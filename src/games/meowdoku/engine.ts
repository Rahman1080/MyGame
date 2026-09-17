/* ── Meowdoku – pure game-logic engine ──
   Queens-style constraint puzzle with colored regions.
   Place one cat per region, row, column — no adjacent cats. */

// ── Seeded PRNG (mulberry32) ──
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

// ── Types ──
export type CellMark = 'empty' | 'cat' | 'x';

export interface Cell {
  region: number;
  mark: CellMark;
  correct: boolean; // true if this cell is the solution position
}

export type Phase = 'play' | 'won' | 'over';

export interface UndoEntry {
  row: number;
  col: number;
  prevMark: CellMark;
}

// ── Region neon colours ──
export const REGION_COLORS = [
  '#00e5ff', // cyan
  '#e040fb', // magenta
  '#76ff03', // lime
  '#ff9100', // orange
  '#b388ff', // violet
  '#ff4081', // pink
  '#ffd740', // gold
  '#64ffda', // teal
  '#ff6e40', // coral
];

// ── Grid size from level ──
export function gridSizeForLevel(level: number): number {
  if (level <= 3) return 5;
  if (level <= 7) return 6;
  if (level <= 12) return 7;
  if (level <= 19) return 8;
  return 9;
}

// ── Direction helpers ──
const DIR4: [number, number][] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

export class MeowdokuEngine {
  // ── public state ──
  phase: Phase = 'play';
  grid: Cell[][] = [];
  size = 5;
  level = 1;
  hearts = 3;
  hintsRemaining = 2;
  undoStack: UndoEntry[] = [];
  solution: { row: number; col: number }[] = [];
  catsPlaced = 0;
  invalidCells: { row: number; col: number }[] = [];

  // ── private ──
  private _rng: () => number = Math.random;

  /* ── public API ── */

  /** Start a new level */
  newLevel(level: number, seed?: string): void {
    this.level = level;
    this.size = gridSizeForLevel(level);
    this.phase = 'play';
    this.hearts = 3;
    this.hintsRemaining = 2;
    this.undoStack = [];
    this.catsPlaced = 0;
    this.invalidCells = [];

    const s = seed
      ? hashSeed(seed + '-' + level)
      : hashSeed(`meowdoku-${level}`);
    this._rng = mulberry32(s);
    this._generatePuzzle();
  }

  /** Single tap: cycle empty→x→empty, or remove cat */
  tapCell(
    row: number,
    col: number,
  ): 'x' | 'cleared' | 'removed' | 'invalid' {
    if (this.phase !== 'play') return 'invalid';
    const cell = this.grid[row]?.[col];
    if (!cell) return 'invalid';

    if (cell.mark === 'cat') {
      this.undoStack.push({ row, col, prevMark: 'cat' });
      cell.mark = 'empty';
      this.catsPlaced--;
      return 'removed';
    }
    if (cell.mark === 'empty') {
      this.undoStack.push({ row, col, prevMark: 'empty' });
      cell.mark = 'x';
      return 'x';
    }
    if (cell.mark === 'x') {
      this.undoStack.push({ row, col, prevMark: 'x' });
      cell.mark = 'empty';
      return 'cleared';
    }
    return 'invalid';
  }

  /** Double tap: place cat. Returns true if the placement obeys the rules */
  placeCat(row: number, col: number): boolean {
    if (this.phase !== 'play') return false;
    const cell = this.grid[row]?.[col];
    if (!cell || cell.mark === 'cat') return false;

    const prevMark = cell.mark;
    cell.mark = 'cat';
    this.catsPlaced++;

    if (this._conflictsWith(row, col)) {
      this.hearts--;
      this.invalidCells = [{ row, col }];
      this._findConflicts(row, col);
      // revert placement (wrong answer) and preserve any X the cell held
      cell.mark = prevMark;
      this.catsPlaced--;
      if (this.hearts <= 0) this.phase = 'over';
      return false;
    }

    this.undoStack.push({ row, col, prevMark });
    this.invalidCells = [];
    if (this._checkWin()) this.phase = 'won';
    return true;
  }

  /** Remove a placed cat */
  removeCat(row: number, col: number): void {
    const cell = this.grid[row]?.[col];
    if (!cell || cell.mark !== 'cat') return;
    this.undoStack.push({ row, col, prevMark: 'cat' });
    cell.mark = 'empty';
    this.catsPlaced--;
  }

  /** Undo last action */
  undo(): UndoEntry | null {
    if (this.phase !== 'play') return null;
    const entry = this.undoStack.pop();
    if (!entry) return null;
    const cell = this.grid[entry.row]?.[entry.col];
    if (!cell) return null;
    if (cell.mark === 'cat') this.catsPlaced--;
    cell.mark = entry.prevMark;
    if (entry.prevMark === 'cat') this.catsPlaced++;
    return entry;
  }

  /** Reveal one rule-valid cell (prefers the generated solution) */
  useHint(): { row: number; col: number } | null {
    if (this.phase !== 'play' || this.hintsRemaining <= 0) return null;

    const pickFrom = (
      list: { row: number; col: number }[],
    ): { row: number; col: number } | null =>
      list.length === 0
        ? null
        : list[Math.floor(this._rng() * list.length)] ?? null;

    const solutionCells = this.solution.filter((s) => {
      const cell = this.grid[s.row]?.[s.col];
      return Boolean(cell) && cell!.mark !== 'cat' && !this._conflictsWith(s.row, s.col);
    });
    let pick = pickFrom(solutionCells);

    if (!pick) {
      // The player may be building a different (equally valid) solution, so
      // fall back to any cell that still obeys the rules.
      const validCells: { row: number; col: number }[] = [];
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          const cell = this.grid[r]?.[c];
          if (cell && cell.mark !== 'cat' && !this._conflictsWith(r, c)) {
            validCells.push({ row: r, col: c });
          }
        }
      }
      pick = pickFrom(validCells);
    }

    if (!pick) return null;

    this.hintsRemaining--;
    const cell = this.grid[pick.row]?.[pick.col];
    if (!cell) return null;

    this.undoStack.push({ row: pick.row, col: pick.col, prevMark: cell.mark });
    cell.mark = 'cat';
    this.catsPlaced++;
    this.invalidCells = [];
    if (this._checkWin()) this.phase = 'won';
    return pick;
  }

  /** Star rating 1-3 based on hearts */
  getStars(): number {
    return Math.max(1, this.hearts);
  }

  /** Check whether the board is a complete, rule-valid solution */
  _checkWin(): boolean {
    if (this.catsPlaced !== this.size) return false;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r]?.[c]?.mark === 'cat' && this._conflictsWith(r, c)) {
          return false;
        }
      }
    }
    return true;
  }

  /** True when a cat at (row,col) would break a row/column/region/touch rule */
  private _conflictsWith(row: number, col: number): boolean {
    const n = this.size;
    const self = this.grid[row]?.[col];
    if (!self) return true;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (r === row && c === col) continue;
        const other = this.grid[r]?.[c];
        if (!other || other.mark !== 'cat') continue;
        if (r === row || c === col) return true;
        if (other.region === self.region) return true;
        if (Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1) return true;
      }
    }
    return false;
  }

  /* ── puzzle generation ── */

  private _generatePuzzle(): void {
    const n = this.size;
    let queens: number[] | null = null;
    let regions: number[][] | null = null;

    for (let attempt = 0; attempt < 200; attempt++) {
      queens = this._placeQueens(n);
      if (!queens) continue;
      regions = this._buildRegions(n, queens);
      if (!regions) continue;
      if (this._isUnique(n, regions)) break;
      queens = null;
    }

    if (!queens || !regions) {
      // Hard fallback: a valid non-adjacent permutation, then any region map.
      queens = this._fallbackQueens(n);
      regions =
        this._buildRegions(n, queens) ?? this._bandRegions(n, queens);
    }

    this.grid = [];
    this.solution = [];
    for (let r = 0; r < n; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < n; c++) {
        const correct = queens[r] === c;
        const regionId = regions[r]?.[c] ?? 0;
        row.push({ region: regionId, mark: 'empty', correct });
        if (correct) this.solution.push({ row: r, col: c });
      }
      this.grid.push(row);
    }
  }

  /** Place N non-adjacent queens, one per row & col */
  _placeQueens(n: number): number[] | null {
    const cols: number[] = new Array(n).fill(-1);
    const usedCols = new Set<number>();

    const ok = (row: number, col: number): boolean => {
      if (usedCols.has(col)) return false;
      for (let r = 0; r < row; r++) {
        const cVal = cols[r];
        if (
          cVal !== undefined &&
          Math.abs(r - row) <= 1 &&
          Math.abs(cVal - col) <= 1
        )
          return false;
      }
      return true;
    };

    const solve = (row: number): boolean => {
      if (row === n) return true;
      const order = this._shuffled(n);
      for (const col of order) {
        if (ok(row, col)) {
          cols[row] = col;
          usedCols.add(col);
          if (solve(row + 1)) return true;
          cols[row] = -1;
          usedCols.delete(col);
        }
      }
      return false;
    };

    return solve(0) ? cols : null;
  }

  /** Ever-valid fallback: even columns first, then odd (no two adjacent). */
  private _fallbackQueens(n: number): number[] {
    const cols: number[] = [];
    for (let c = 0; c < n; c += 2) cols.push(c);
    for (let c = 1; c < n; c += 2) cols.push(c);
    return cols;
  }

  /** BFS flood-fill from queen positions to build contiguous regions */
  _buildRegions(n: number, queens: number[]): number[][] | null {
    const reg: number[][] = Array.from({ length: n }, () =>
      new Array(n).fill(-1),
    );
    const frontiers: { row: number; col: number }[][] = [];

    for (let r = 0; r < n; r++) {
      const c = queens[r];
      if (c === undefined) continue;
      const regRow = reg[r];
      if (regRow) {
        regRow[c] = r;
      }
      const f: { row: number; col: number }[] = [];
      for (const [dr, dc] of DIR4) {
        const nr = r + dr,
          nc = c + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n) f.push({ row: nr, col: nc });
      }
      frontiers.push(f);
    }

    let unassigned = n * n - n;
    let safety = n * n * 20;

    while (unassigned > 0 && safety-- > 0) {
      // compute sizes for balanced growth
      const sizes = new Array(n).fill(0);
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const regionId = reg[r]?.[c];
          if (regionId !== undefined && regionId >= 0 && sizes[regionId] !== undefined) {
            sizes[regionId]++;
          }
        }
      }

      const order = Array.from({ length: n }, (_, i) => i)
        .filter((i) => (frontiers[i]?.length ?? 0) > 0)
        .sort((a, b) => (sizes[a] ?? 0) - (sizes[b] ?? 0));

      if (order.length === 0) break;
      let grew = false;

      for (const id of order) {
        const f = frontiers[id];
        if (!f) continue;
        while (f.length > 0) {
          const idx = Math.floor(this._rng() * f.length);
          const top = f[idx];
          const last = f[f.length - 1];
          if (!top || !last) break;
          f[idx] = last;
          f.pop();
          const { row, col } = top;
          if ((reg[row]?.[col] ?? -1) >= 0) continue;

          if (reg[row]) {
            reg[row][col] = id;
          }
          unassigned--;
          grew = true;

          for (const [dr, dc] of DIR4) {
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < n && nc >= 0 && nc < n && (reg[nr]?.[nc] ?? 0) < 0) {
              f.push({ row: nr, col: nc });
            }
          }
          break; // one cell per region per round
        }
      }
      if (!grew) break;
    }

    return unassigned === 0 ? reg : null;
  }

  /** Simple horizontal-band fallback */
  private _bandRegions(n: number, _queens: number[]): number[][] {
    return Array.from({ length: n }, (_, r) => new Array(n).fill(r));
  }

  /** Check that the puzzle has exactly one valid solution */
  _isUnique(n: number, regions: number[][]): boolean {
    const regionCells: { row: number; col: number }[][] = Array.from(
      { length: n },
      () => [],
    );
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const rId = regions[r]?.[c];
        if (rId !== undefined && regionCells[rId]) {
          regionCells[rId].push({ row: r, col: c });
        }
      }
    }

    let solutions = 0;
    const usedRows = new Set<number>();
    const usedCols = new Set<number>();
    const placed: { row: number; col: number }[] = [];

    const ok = (row: number, col: number): boolean => {
      if (usedRows.has(row) || usedCols.has(col)) return false;
      for (const p of placed)
        if (Math.abs(p.row - row) <= 1 && Math.abs(p.col - col) <= 1)
          return false;
      return true;
    };

    const solve = (ri: number): void => {
      if (solutions > 1) return;
      if (ri === n) {
        solutions++;
        return;
      }
      const cells = regionCells[ri] ?? [];
      for (const { row, col } of cells) {
        if (ok(row, col)) {
          usedRows.add(row);
          usedCols.add(col);
          placed.push({ row, col });
          solve(ri + 1);
          placed.pop();
          usedRows.delete(row);
          usedCols.delete(col);
        }
      }
    };

    solve(0);
    return solutions === 1;
  }

  /** Find conflicting cells for a wrong placement */
  private _findConflicts(row: number, col: number): void {
    const n = this.size;
    const cell = this.grid[row]?.[col];
    if (!cell) return;

    for (let c = 0; c < n; c++) {
      const target = this.grid[row]?.[c];
      if (c !== col && target && target.mark === 'cat') {
        this.invalidCells.push({ row, col: c });
      }
    }
    for (let r = 0; r < n; r++) {
      const target = this.grid[r]?.[col];
      if (r !== row && target && target.mark === 'cat') {
        this.invalidCells.push({ row: r, col });
      }
    }
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const target = this.grid[r]?.[c];
        if (
          (r !== row || c !== col) &&
          target &&
          target.region === cell.region &&
          target.mark === 'cat'
        ) {
          this.invalidCells.push({ row: r, col: c });
        }
      }
    }
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n) {
          const target = this.grid[nr]?.[nc];
          if (target && target.mark === 'cat') {
            this.invalidCells.push({ row: nr, col: nc });
          }
        }
      }
    }
  }

  /** Return shuffled 0..n-1 */
  private _shuffled(n: number): number[] {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(this._rng() * (i + 1));
      const valI = a[i];
      const valJ = a[j];
      if (valI !== undefined && valJ !== undefined) {
        a[i] = valJ;
        a[j] = valI;
      }
    }
    return a;
  }
}
