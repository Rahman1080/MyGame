import { WORD_CATEGORIES, type WordCategory } from "./words";

export interface GridPos {
  r: number;
  c: number;
}

export interface PlacedWord {
  word: string;
  start: GridPos;
  end: GridPos;
  color: string;
  found: boolean;
}

export interface WordSelection {
  start: GridPos;
  end: GridPos;
  cells: GridPos[];
  currentWord: string;
}

export type WordSearchDifficulty = "easy" | "hard" | "master";

export const DIFFICULTY_CONFIG: Record<
  WordSearchDifficulty,
  { size: number; wordCount: number; minWordLen: number }
> = {
  easy: { size: 8, wordCount: 5, minWordLen: 4 },
  hard: { size: 10, wordCount: 7, minWordLen: 5 },
  master: { size: 12, wordCount: 9, minWordLen: 6 },
};

export interface WordSearchState {
  size: number;
  grid: string[][];
  category: WordCategory;
  placedWords: PlacedWord[];
  activeSelection: WordSelection | null;
  score: number;
  highScore: number;
  level: number;
  isCompleted: boolean;
  hintCell: GridPos | null;
  hintTimerMs: number;
  difficulty: WordSearchDifficulty;
}

export const HIGHLIGHT_PALETTE = [
  "#00F2FF", // Electric Cyan
  "#FF007F", // Neon Pink
  "#FFD700", // Gold
  "#00FFA3", // Emerald Green
  "#BD10E0", // Vivid Purple
  "#FF6B4A", // Coral
  "#4FC3FF", // Sky Blue
  "#E45CFF", // Magenta
];

const DIRECTIONS = [
  { dr: 0, dc: 1 }, // Right
  { dr: 1, dc: 0 }, // Down
  { dr: 1, dc: 1 }, // Down-Right
  { dr: -1, dc: 1 }, // Up-Right
  { dr: 0, dc: -1 }, // Left
  { dr: -1, dc: 0 }, // Up
  { dr: 1, dc: -1 }, // Down-Left
  { dr: -1, dc: -1 }, // Up-Left
];

export function createWordSearchGame(
  level = 1,
  highScore = 0,
  difficultyOrSize: WordSearchDifficulty | number = "hard",
  rng = Math.random,
): WordSearchState {
  const difficulty: WordSearchDifficulty =
    typeof difficultyOrSize === "number"
      ? difficultyOrSize <= 8
        ? "easy"
        : difficultyOrSize <= 10
        ? "hard"
        : "master"
      : difficultyOrSize;

  const config = DIFFICULTY_CONFIG[difficulty];
  const size = config.size;
  const categoryIndex = (level - 1) % WORD_CATEGORIES.length;
  const category = WORD_CATEGORIES[categoryIndex]!;

  const { grid, placedWords } = generateWordGrid(
    size,
    category.words,
    rng,
    config.wordCount,
    config.minWordLen,
  );

  return {
    size,
    grid,
    category,
    placedWords,
    activeSelection: null,
    score: 0,
    highScore,
    level,
    isCompleted: false,
    hintCell: null,
    hintTimerMs: 0,
    difficulty,
  };
}

export function setWordSearchDifficulty(
  state: WordSearchState,
  difficulty: WordSearchDifficulty,
  rng = Math.random,
): void {
  state.difficulty = difficulty;
  const config = DIFFICULTY_CONFIG[difficulty];
  state.size = config.size;
  const { grid, placedWords } = generateWordGrid(
    config.size,
    state.category.words,
    rng,
    config.wordCount,
    config.minWordLen,
  );
  state.grid = grid;
  state.placedWords = placedWords;
  state.activeSelection = null;
  state.hintCell = null;
  state.hintTimerMs = 0;
  state.isCompleted = false;
}

export function generateWordGrid(
  size: number,
  wordPool: string[],
  rng = Math.random,
  maxWords = 6,
  minWordLen = 4,
): { grid: string[][]; placedWords: PlacedWord[] } {
  const grid: string[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ""),
  );
  const placedWords: PlacedWord[] = [];

  // Filter words that fit within grid size and meet minimum length
  const eligible = wordPool.filter(
    (w) => w.length >= minWordLen && w.length <= size,
  );
  // Shuffle candidate pool first, then sort longer words first for easier placement
  const candidates = [...eligible]
    .sort(() => rng() - 0.5)
    .sort((a, b) => b.length - a.length);

  let colorIdx = 0;
  for (const word of candidates) {
    if (placedWords.length >= maxWords) break;
    let placed = false;
    // Try multiple random attempts to place word
    const attempts = 100;
    for (let a = 0; a < attempts && !placed; a++) {
      const dir = DIRECTIONS[Math.floor(rng() * DIRECTIONS.length)]!;
      const r = Math.floor(rng() * size);
      const c = Math.floor(rng() * size);

      const endR = r + dir.dr * (word.length - 1);
      const endC = c + dir.dc * (word.length - 1);

      if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;

      // Check if cells are free or have matching characters
      let canPlace = true;
      for (let i = 0; i < word.length; i++) {
        const curR = r + dir.dr * i;
        const curC = c + dir.dc * i;
        const existing = grid[curR]![curC]!;
        if (existing !== "" && existing !== word[i]) {
          canPlace = false;
          break;
        }
      }

      if (canPlace) {
        // Place word characters
        for (let i = 0; i < word.length; i++) {
          const curR = r + dir.dr * i;
          const curC = c + dir.dc * i;
          grid[curR]![curC] = word[i]!;
        }

        placedWords.push({
          word,
          start: { r, c },
          end: { r: endR, c: endC },
          color: HIGHLIGHT_PALETTE[colorIdx % HIGHLIGHT_PALETTE.length]!,
          found: false,
        });
        colorIdx++;
        placed = true;
      }
    }
  }

  // Fill remaining empty cells with random uppercase letters
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!grid[r]![c]) {
        grid[r]![c] = ALPHABET[Math.floor(rng() * ALPHABET.length)]!;
      }
    }
  }

  return { grid, placedWords };
}

/**
 * Snaps any drag end point (r2, c2) to the nearest of 8 ray directions from (r1, c1)
 * and returns the list of cells along that line.
 */
export function getRayCells(
  start: GridPos,
  target: GridPos,
  size: number,
): GridPos[] {
  const dr = target.r - start.r;
  const dc = target.c - start.c;
  if (dr === 0 && dc === 0) {
    return [{ r: start.r, c: start.c }];
  }

  // Determine angle and snap to nearest 45 degrees
  const angle = Math.atan2(dr, dc);
  const snappedStep = Math.round(angle / (Math.PI / 4));
  const stepR = Math.round(Math.sin((snappedStep * Math.PI) / 4));
  const stepC = Math.round(Math.cos((snappedStep * Math.PI) / 4));

  // Determine length of ray
  const dist = Math.max(Math.abs(dr), Math.abs(dc));
  const cells: GridPos[] = [];

  for (let i = 0; i <= dist; i++) {
    const curR = start.r + stepR * i;
    const curC = start.c + stepC * i;
    if (curR < 0 || curR >= size || curC < 0 || curC >= size) break;
    cells.push({ r: curR, c: curC });
  }

  return cells;
}

export function updateSelection(
  state: WordSearchState,
  start: GridPos,
  current: GridPos,
): void {
  const cells = getRayCells(start, current, state.size);
  const currentWord = cells.map((cell) => state.grid[cell.r]![cell.c]!).join("");
  state.activeSelection = {
    start,
    end: cells[cells.length - 1] ?? start,
    cells,
    currentWord,
  };
}

export function commitSelection(state: WordSearchState): PlacedWord | null {
  if (!state.activeSelection) return null;
  const selectedStr = state.activeSelection.currentWord;
  const reversedStr = selectedStr.split("").reverse().join("");

  const start = state.activeSelection.start;
  const end = state.activeSelection.end;

  let matchedWord: PlacedWord | null = null;
  for (const pw of state.placedWords) {
    if (pw.found) continue;

    // Check if word string matches and endpoints match
    const stringMatches = pw.word === selectedStr || pw.word === reversedStr;
    const directCoordsMatch =
      (pw.start.r === start.r &&
        pw.start.c === start.c &&
        pw.end.r === end.r &&
        pw.end.c === end.c) ||
      (pw.start.r === end.r &&
        pw.start.c === end.c &&
        pw.end.r === start.r &&
        pw.end.c === start.c);

    if (stringMatches && directCoordsMatch) {
      pw.found = true;
      matchedWord = pw;
      break;
    }
  }

  state.activeSelection = null;

  if (matchedWord) {
    state.score += matchedWord.word.length * 100;
    if (state.score > state.highScore) {
      state.highScore = state.score;
    }
    // Check if all words are found
    if (state.placedWords.every((w) => w.found)) {
      state.isCompleted = true;
    }
  }

  return matchedWord;
}

export function requestHint(state: WordSearchState): GridPos | null {
  const unfound = state.placedWords.find((w) => !w.found);
  if (!unfound) return null;
  state.hintCell = unfound.start;
  state.hintTimerMs = 3500;
  return unfound.start;
}

export function tickWordSearch(state: WordSearchState, dtMs: number): void {
  if (state.hintTimerMs > 0) {
    state.hintTimerMs -= dtMs;
    if (state.hintTimerMs <= 0) {
      state.hintCell = null;
      state.hintTimerMs = 0;
    }
  }
}
