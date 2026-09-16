import { getWordConnectLevel, type WordConnectLevel } from "./levels";

export interface WordSlot {
  word: string;
  solved: boolean;
  revealedLetters: string[]; // empty strings or revealed characters
}

export interface WordConnectSubmitResult {
  type: "target" | "bonus" | "already" | "invalid";
  word: string;
  slotIndex?: number;
  scoreGained: number;
}

export interface WordConnectState {
  level: number;
  score: number;
  highScore: number;
  letters: string[];
  slots: WordSlot[];
  bonusWords: string[];
  foundBonusWords: string[];
  activePath: number[]; // Indices of selected letters on wheel
  currentWord: string;
  isCompleted: boolean;
  hintsRemaining: number;
  shuffleAngle: number;
}

export function createWordConnectGame(
  level = 1,
  highScore = 0,
): WordConnectState {
  const lvlConfig: WordConnectLevel = getWordConnectLevel(level);

  const slots: WordSlot[] = lvlConfig.targetWords.map((word) => ({
    word,
    solved: false,
    revealedLetters: Array.from({ length: word.length }, () => ""),
  }));

  return {
    level,
    score: 0,
    highScore,
    letters: [...lvlConfig.letters],
    slots,
    bonusWords: [...lvlConfig.bonusWords],
    foundBonusWords: [],
    activePath: [],
    currentWord: "",
    isCompleted: false,
    hintsRemaining: 3,
    shuffleAngle: 0,
  };
}

export function shuffleWheel(state: WordConnectState, rng = Math.random): void {
  // Fisher-Yates shuffle
  const arr = [...state.letters];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = temp;
  }
  state.letters = arr;
  state.activePath = [];
  state.currentWord = "";
  state.shuffleAngle += Math.PI * 2;
}

export function addIndexToPath(state: WordConnectState, index: number): boolean {
  if (index < 0 || index >= state.letters.length) return false;

  // Cannot select same wheel node twice
  if (state.activePath.includes(index)) {
    // If going back to penultimate letter, allow undoing last selection
    if (
      state.activePath.length >= 2 &&
      state.activePath[state.activePath.length - 2] === index
    ) {
      state.activePath.pop();
      state.currentWord = state.activePath
        .map((i) => state.letters[i]!)
        .join("");
      return true;
    }
    return false;
  }

  state.activePath.push(index);
  state.currentWord = state.activePath.map((i) => state.letters[i]!).join("");
  return true;
}

export function clearPath(state: WordConnectState): void {
  state.activePath = [];
  state.currentWord = "";
}

export function submitCurrentWord(
  state: WordConnectState,
): WordConnectSubmitResult {
  const word = state.currentWord.toUpperCase();
  clearPath(state);

  if (word.length < 2) {
    return { type: "invalid", word, scoreGained: 0 };
  }

  // Check target puzzle slots
  const slotIdx = state.slots.findIndex((s) => s.word === word);
  if (slotIdx !== -1) {
    const slot = state.slots[slotIdx]!;
    if (slot.solved) {
      return { type: "already", word, slotIndex: slotIdx, scoreGained: 0 };
    }

    // Solve the slot!
    slot.solved = true;
    slot.revealedLetters = word.split("");
    const points = word.length * 100;
    state.score += points;
    if (state.score > state.highScore) {
      state.highScore = state.score;
    }

    if (state.slots.every((s) => s.solved)) {
      state.isCompleted = true;
      state.score += 300; // Level clear bonus
      if (state.score > state.highScore) {
        state.highScore = state.score;
      }
    }

    return { type: "target", word, slotIndex: slotIdx, scoreGained: points };
  }

  // Check bonus words
  if (state.bonusWords.includes(word)) {
    if (state.foundBonusWords.includes(word)) {
      return { type: "already", word, scoreGained: 0 };
    }
    state.foundBonusWords.push(word);
    const bonusPoints = 50;
    state.score += bonusPoints;
    if (state.score > state.highScore) {
      state.highScore = state.score;
    }
    return { type: "bonus", word, scoreGained: bonusPoints };
  }

  return { type: "invalid", word, scoreGained: 0 };
}

export function useHint(
  state: WordConnectState,
): { slotIndex: number; charIndex: number; char: string } | null {
  if (state.hintsRemaining <= 0) return null;

  // Find unsolved slots
  const unsolvedSlots = state.slots
    .map((s, idx) => ({ slot: s, idx }))
    .filter((s) => !s.slot.solved);

  if (unsolvedSlots.length === 0) return null;

  // Find an empty unrevealed letter in one of the unsolved slots
  for (const { slot, idx } of unsolvedSlots) {
    for (let c = 0; c < slot.word.length; c++) {
      if (!slot.revealedLetters[c]) {
        const char = slot.word[c]!;
        slot.revealedLetters[c] = char;
        state.hintsRemaining--;

        // If all letters in slot revealed by hint, mark solved
        if (slot.revealedLetters.every((ch) => ch !== "")) {
          slot.solved = true;
          if (state.slots.every((s) => s.solved)) {
            state.isCompleted = true;
          }
        }

        return { slotIndex: idx, charIndex: c, char };
      }
    }
  }

  return null;
}
