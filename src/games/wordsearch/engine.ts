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
  hard: { size: 10, wordCount: 7, minWordLen: 4 },
  master: { size: 12, wordCount: 9, minWordLen: 5 },
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
  trickiness: string;
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

export const ALL_DIRECTIONS = [
  { dr: 0, dc: 1 }, // Right
  { dr: 1, dc: 0 }, // Down
  { dr: 1, dc: 1 }, // Down-Right
  { dr: -1, dc: 1 }, // Up-Right
  { dr: 0, dc: -1 }, // Left
  { dr: -1, dc: 0 }, // Up
  { dr: 1, dc: -1 }, // Down-Left
  { dr: -1, dc: -1 }, // Up-Left
];

export function getDirectionsForLevel(level: number) {
  if (level <= 2) {
    // Novice: Horizontal Right & Vertical Down only
    return [ALL_DIRECTIONS[0]!, ALL_DIRECTIONS[1]!];
  }
  if (level <= 4) {
    // Intermediate: Horizontal, Vertical, and Diagonals Down-Right & Up-Right
    return [ALL_DIRECTIONS[0]!, ALL_DIRECTIONS[1]!, ALL_DIRECTIONS[2]!, ALL_DIRECTIONS[3]!];
  }
  if (level <= 7) {
    // Tricky: Adds Reverse Horizontal (Left) & Reverse Vertical (Up)
    return [
      ALL_DIRECTIONS[0]!, ALL_DIRECTIONS[1]!, ALL_DIRECTIONS[2]!,
      ALL_DIRECTIONS[3]!, ALL_DIRECTIONS[4]!, ALL_DIRECTIONS[5]!,
    ];
  }
  // Master (8+): All 8 directions active (including Reverse Diagonals)
  return ALL_DIRECTIONS;
}

export function getTrickinessLabel(level: number): string {
  if (level <= 2) return "STANDARD (2 DIRS)";
  if (level <= 4) return "DIAGONAL (4 DIRS)";
  if (level <= 7) return "TRICKY (6 DIRS + DECOYS)";
  return "EXPERT (8 DIRS + TRAP LETTERS)";
}

export function createWordSearchGame(
  level = 1,
  highScore = 0,
  difficultyOrSize: WordSearchDifficulty | number = "hard",
  rng = Math.random,
  prevCatIndex = -1,
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

  // Pick a fresh category distinct from previous one
  let categoryIndex = Math.floor(rng() * WORD_CATEGORIES.length);
  if (categoryIndex === prevCatIndex) {
    categoryIndex = (categoryIndex + 1) % WORD_CATEGORIES.length;
  }
  const category = WORD_CATEGORIES[categoryIndex]!;

  const { grid, placedWords } = generateWordGrid(
    size,
    category.words,
    rng,
    config.wordCount,
    config.minWordLen,
    level,
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
    trickiness: getTrickinessLabel(level),
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
    state.level,
  );
  state.grid = grid;
  state.placedWords = placedWords;
  state.activeSelection = null;
  state.hintCell = null;
  state.hintTimerMs = 0;
  state.isCompleted = false;
  state.trickiness = getTrickinessLabel(state.level);
}

export function generateWordGrid(
  size: number,
  wordPool: string[],
  rng = Math.random,
  maxWords = 6,
  minWordLen = 4,
  level = 1,
): { grid: string[][]; placedWords: PlacedWord[] } {
  const grid: string[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ""),
  );
  const placedWords: PlacedWord[] = [];

  // Filter words that fit within grid size and meet minimum length
  const eligible = wordPool.filter(
    (w) => w.length >= minWordLen && w.length <= size,
  );
  // Shuffle candidate pool thoroughly on every generation to guarantee unique word sets
  const candidates = [...eligible]
    .sort(() => rng() - 0.5)
    .sort((a, b) => b.length - a.length);

  const availableDirections = getDirectionsForLevel(level);

  let colorIdx = 0;
  for (const word of candidates) {
    if (placedWords.length >= maxWords) break;
    let placed = false;
    const attempts = 150;
    for (let a = 0; a < attempts && !placed; a++) {
      const dir = availableDirections[Math.floor(rng() * availableDirections.length)]!;
      const r = Math.floor(rng() * size);
      const c = Math.floor(rng() * size);

      const endR = r + dir.dr * (word.length - 1);
      const endC = c + dir.dc * (word.length - 1);

      if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;

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

  // Collect target characters for deceptive decoy generation
  const targetChars: string[] = [];
  for (const pw of placedWords) {
    for (const ch of pw.word) {
      targetChars.push(ch);
    }
  }

  // Tricky Decoy Letter Injection
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const decoyRate = level <= 2 ? 0.0 : level <= 5 ? 0.45 : 0.65;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!grid[r]![c]) {
        if (targetChars.length > 0 && rng() < decoyRate) {
          // Decoy letter from target words creates deceptive near-misses
          grid[r]![c] = targetChars[Math.floor(rng() * targetChars.length)]!;
        } else {
          grid[r]![c] = ALPHABET[Math.floor(rng() * ALPHABET.length)]!;
        }
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

  const angle = Math.atan2(dr, dc);
  const snappedStep = Math.round(angle / (Math.PI / 4));
  const stepR = Math.round(Math.sin((snappedStep * Math.PI) / 4));
  const stepC = Math.round(Math.cos((snappedStep * Math.PI) / 4));

  const maxDist = Math.max(Math.abs(dr), Math.abs(dc));
  const cells: GridPos[] = [];

  for (let dist = 0; dist <= maxDist; dist++) {
    const curR = start.r + stepR * dist;
    const curC = start.c + stepC * dist;
    if (curR >= 0 && curR < size && curC >= 0 && curC < size) {
      cells.push({ r: curR, c: curC });
    } else {
      break;
    }
  }

  return cells;
}

export function updateSelection(
  state: WordSearchState,
  start: GridPos,
  current: GridPos,
): WordSelection {
  const cells = getRayCells(start, current, state.size);
  const currentWord = cells.map((cell) => state.grid[cell.r]![cell.c]!).join("");
  const end = cells[cells.length - 1]!;
  const selection: WordSelection = {
    start,
    end,
    cells,
    currentWord,
  };
  state.activeSelection = selection;
  return selection;
}

export function commitSelection(
  state: WordSearchState,
): PlacedWord | null {
  if (!state.activeSelection) {
    return null;
  }

  const spelled = state.activeSelection.currentWord;
  const reversed = spelled.split("").reverse().join("");

  // Check if spelled or reverse matches any un-found placed word
  let matchedWord: PlacedWord | null = null;
  for (const pw of state.placedWords) {
    if (!pw.found && (pw.word === spelled || pw.word === reversed)) {
      matchedWord = pw;
      break;
    }
  }

  state.activeSelection = null;

  if (matchedWord) {
    matchedWord.found = true;
    const wordScore = matchedWord.word.length * 100;
    state.score += wordScore;

    // Check if all words found
    const allFound = state.placedWords.every((w) => w.found);
    if (allFound) {
      state.isCompleted = true;
      state.score += 500; // Bonus for clearing the grid
    }

    return matchedWord;
  }

  return null;
}

export function requestHint(state: WordSearchState): GridPos | null {
  const unfound = state.placedWords.filter((w) => !w.found);
  if (unfound.length === 0) return null;

  // Pick first unfound word and highlight its first cell
  const target = unfound[0]!;
  state.hintCell = target.start;
  state.hintTimerMs = 3000;
  return target.start;
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
