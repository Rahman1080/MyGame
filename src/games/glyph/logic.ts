import { hashString, mulberry32 } from "../../gen/seededRng";
import { dailySeed } from "../../platform/dailySeed";
import type { GlyphDailyRecord, GlyphSave } from "../../save/schema";
import { ANSWER_WORDS, VALID_WORDS } from "./words";

export const GLYPH_WORD_LENGTH = 5;
export const GLYPH_MAX_GUESSES = 6;
export const GLYPH_DAILY_ID = "glyph-daily";
export const ENERGY_PER_CLUE = 8;
export const GLYPH_MAX_CLUES = 2;

export const MODIFIERS = ["clear", "double", "energy", "category"] as const;
export type ModifierId = (typeof MODIFIERS)[number];

export const MODIFIER_LABELS: Record<ModifierId, string> = {
  clear: "CLEAR SKIES",
  double: "DOUBLE LETTER",
  energy: "LETTER ENERGY",
  category: "CATEGORY",
};

export const MODIFIER_HELP: Record<ModifierId, string> = {
  clear: "A classic day. No twists.",
  double: "The answer hides a repeated letter. Match it for bonus points.",
  energy: "Every correct letter charges the meter. Fill it to reveal a clue.",
  category: "After your first guess, the answer's category is revealed.",
};

export type TileMark = "correct" | "present" | "absent";

export interface GlyphGuess {
  word: string;
  marks: TileMark[];
}

export interface GlyphClue {
  index: number;
  letter: string;
}

export interface GlyphState {
  date: string;
  answer: string;
  category: string;
  modifier: ModifierId;
  maxGuesses: number;
  guesses: GlyphGuess[];
  status: "playing" | "won" | "lost";
  energy: number;
  clues: GlyphClue[];
  doubleLetter: string | null;
  doubleHit: boolean;
  categoryRevealed: boolean;
}

export type GuessError = "length" | "letters" | "unknown" | "finished";

export interface GuessOutcome {
  state: GlyphState;
  accepted: boolean;
  error: GuessError | null;
}

export interface DailyConfig {
  date: string;
  answer: string;
  category: string;
  modifier: ModifierId;
}

export interface GlyphResult {
  date: string;
  won: boolean;
  guesses: number;
  answer: string;
  modifier: ModifierId;
  score: number;
  stars: number;
}

export const GLYPH_SCORE = {
  winBase: 100,
  lossBase: 20,
  perGuessLeft: 30,
  perfect: 100,
  doubleBonus: 25,
  streakStep: 5,
  streakMax: 10,
} as const;

const VALID_SET = new Set<string>(VALID_WORDS);
const ANSWER_MAP = new Map<string, string>(ANSWER_WORDS.map((entry) => [entry.word, entry.category]));
const RANK: Record<TileMark, number> = { absent: 0, present: 1, correct: 2 };

export function isWellFormedWord(word: string): boolean {
  return /^[a-z]{5}$/.test(word);
}

export function normalizeWord(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const word = raw.trim().toLowerCase();
  return isWellFormedWord(word) ? word : null;
}

export function isValidWord(word: string): boolean {
  return VALID_SET.has(word);
}

export function answerWords(): readonly string[] {
  return ANSWER_WORDS.map((entry) => entry.word);
}

export function validWordCount(): number {
  return VALID_SET.size;
}

export function categoryFor(word: string): string {
  return ANSWER_MAP.get(word) ?? "mystery";
}

export function doubledLetter(answer: string): string | null {
  const seen = new Set<string>();
  for (const ch of answer) {
    if (seen.has(ch)) return ch;
    seen.add(ch);
  }
  return null;
}

export function evaluateGuess(answer: string, guess: string): TileMark[] {
  const marks: TileMark[] = Array.from({ length: guess.length }, () => "absent");
  const remaining = new Map<string, number>();
  for (const ch of answer) remaining.set(ch, (remaining.get(ch) ?? 0) + 1);
  for (let i = 0; i < guess.length; i += 1) {
    const ch = guess[i]!;
    if (ch === answer[i]) {
      marks[i] = "correct";
      remaining.set(ch, (remaining.get(ch) ?? 0) - 1);
    }
  }
  for (let i = 0; i < guess.length; i += 1) {
    if (marks[i] === "correct") continue;
    const ch = guess[i]!;
    const left = remaining.get(ch) ?? 0;
    if (left > 0) {
      marks[i] = "present";
      remaining.set(ch, left - 1);
    }
  }
  return marks;
}

export function dailyConfig(date: string): DailyConfig {
  const rng = mulberry32(hashString(dailySeed(date, "glyph")));
  const entry = ANSWER_WORDS[Math.floor(rng() * ANSWER_WORDS.length)]!;
  const modifier = MODIFIERS[Math.floor(rng() * MODIFIERS.length)]!;
  return { date, answer: entry.word, category: entry.category, modifier };
}

export function startDaily(date: string): GlyphState {
  const config = dailyConfig(date);
  return {
    date,
    answer: config.answer,
    category: config.category,
    modifier: config.modifier,
    maxGuesses: GLYPH_MAX_GUESSES,
    guesses: [],
    status: "playing",
    energy: 0,
    clues: [],
    doubleLetter: config.modifier === "double" ? doubledLetter(config.answer) : null,
    doubleHit: false,
    categoryRevealed: false,
  };
}

function applyModifierProgress(state: GlyphState): GlyphState {
  const last = state.guesses[state.guesses.length - 1];
  if (!last) return state;
  let next = state;
  if (next.modifier === "category" && !next.categoryRevealed) {
    next = { ...next, categoryRevealed: true };
  }
  if (next.modifier === "double" && next.doubleLetter !== null && !next.doubleHit) {
    const hit = last.word.split("").some((ch, i) => ch === next.doubleLetter && last.marks[i] === "correct");
    if (hit) next = { ...next, doubleHit: true };
  }
  if (next.modifier === "energy") {
    const gained = last.marks.filter((mark) => mark !== "absent").length;
    let energy = next.energy + gained;
    const clues = next.clues.slice();
    while (energy >= ENERGY_PER_CLUE && clues.length < GLYPH_MAX_CLUES) {
      const index = clues.length;
      const letter = next.answer[index];
      if (letter === undefined) break;
      energy -= ENERGY_PER_CLUE;
      clues.push({ index, letter });
    }
    next = { ...next, energy, clues };
  }
  return next;
}

export function submitGuess(state: GlyphState, raw: unknown): GuessOutcome {
  if (state.status !== "playing") return { state, accepted: false, error: "finished" };
  if (typeof raw !== "string") return { state, accepted: false, error: "letters" };
  const word = raw.trim().toLowerCase();
  if (!/^[a-z]*$/.test(word)) return { state, accepted: false, error: "letters" };
  if (word.length !== GLYPH_WORD_LENGTH) return { state, accepted: false, error: "length" };
  if (!VALID_SET.has(word)) return { state, accepted: false, error: "unknown" };
  const marks = evaluateGuess(state.answer, word);
  const guesses = [...state.guesses, { word, marks }];
  let next: GlyphState = applyModifierProgress({ ...state, guesses });
  if (word === state.answer) next = { ...next, status: "won" };
  else if (guesses.length >= state.maxGuesses) next = { ...next, status: "lost" };
  return { state: next, accepted: true, error: null };
}

export function remainingGuesses(state: GlyphState): number {
  return Math.max(0, state.maxGuesses - state.guesses.length);
}

export function isFinished(state: GlyphState): boolean {
  return state.status !== "playing";
}

export function isWon(state: GlyphState): boolean {
  return state.status === "won";
}

export function isLost(state: GlyphState): boolean {
  return state.status === "lost";
}

export function keyboardState(state: GlyphState): Record<string, TileMark> {
  const out: Record<string, TileMark> = {};
  for (const guess of state.guesses) {
    for (let i = 0; i < guess.word.length; i += 1) {
      const ch = guess.word[i]!;
      const mark = guess.marks[i]!;
      const prev = out[ch];
      if (!prev || RANK[mark] > RANK[prev]) out[ch] = mark;
    }
  }
  return out;
}

export function scoreGlyph(state: GlyphState, streak = 0): number {
  if (state.status !== "won") return GLYPH_SCORE.lossBase;
  let score = GLYPH_SCORE.winBase + remainingGuesses(state) * GLYPH_SCORE.perGuessLeft;
  if (state.guesses.length === 1) score += GLYPH_SCORE.perfect;
  if (state.modifier === "double" && state.doubleHit) score += GLYPH_SCORE.doubleBonus;
  score += Math.min(Math.max(0, streak), GLYPH_SCORE.streakMax) * GLYPH_SCORE.streakStep;
  return score;
}

export function starsForGlyph(state: GlyphState): number {
  if (state.status !== "won") return 0;
  const used = state.guesses.length;
  if (used <= 2) return 3;
  if (used <= 4) return 2;
  return 1;
}

export function finalResult(state: GlyphState, streak = 0): GlyphResult {
  return {
    date: state.date,
    won: state.status === "won",
    guesses: state.guesses.length,
    answer: state.answer,
    modifier: state.modifier,
    score: scoreGlyph(state, streak),
    stars: starsForGlyph(state),
  };
}

const MARK_CHAR: Record<TileMark, string> = { correct: "#", present: "+", absent: "." };

export function resultSummary(result: GlyphResult): string {
  const outcome = result.won ? `SOLVED ${result.guesses}/${GLYPH_MAX_GUESSES}` : `MISSED 0/${GLYPH_MAX_GUESSES}`;
  return `${outcome} - ${result.score} pts`;
}

export function buildShare(state: GlyphState, streak = 0): string {
  const lines = state.guesses.map((guess) => guess.marks.map((mark) => MARK_CHAR[mark]).join(" "));
  const outcome = state.status === "won" ? `${state.guesses.length}/${state.maxGuesses}` : `X/${state.maxGuesses}`;
  const tail = `#=correct +=near .=absent`;
  return [
    `GLYPH ${state.date} - ${MODIFIER_LABELS[state.modifier]}`,
    ...lines,
    `${outcome} - ${scoreGlyph(state, streak)} pts - streak ${Math.max(0, Math.floor(streak))}`,
    tail,
    "GLOWTRAIL ARCADE",
  ].join("\n");
}

export function modifierLabel(modifier: string): string {
  return (MODIFIERS as readonly string[]).includes(modifier)
    ? MODIFIER_LABELS[modifier as ModifierId]
    : modifier.toUpperCase();
}

export function buildRecordShare(date: string, record: GlyphDailyRecord): string {
  const outcome = record.won ? `SOLVED ${record.guesses}/${GLYPH_MAX_GUESSES}` : `MISSED 0/${GLYPH_MAX_GUESSES}`;
  return [
    `GLYPH ${date} - ${modifierLabel(record.modifier)}`,
    `${outcome} - ${record.score} pts`,
    "GLOWTRAIL ARCADE",
  ].join("\n");
}

export function starsForGuesses(guesses: number): number {
  if (guesses <= 0) return 0;
  if (guesses <= 2) return 3;
  if (guesses <= 4) return 2;
  return 1;
}

export function emptyGlyphSave(): GlyphSave {
  return {
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    bestGuesses: 0,
    playDates: [],
    lastResult: null,
    daily: {},
  };
}

export function isDailyDone(save: GlyphSave, date: string): boolean {
  return save.daily[date] !== undefined;
}

export function dailyRecordFor(save: GlyphSave, date: string): GlyphDailyRecord | null {
  return save.daily[date] ?? null;
}

export function recordGlyphResult(save: GlyphSave, result: GlyphResult): GlyphSave {
  if (save.daily[result.date] !== undefined) return save;
  const daily = {
    ...save.daily,
    [result.date]: {
      won: result.won,
      guesses: result.guesses,
      modifier: result.modifier,
      score: result.score,
    },
  };
  const playDates = save.playDates.includes(result.date) ? save.playDates : [...save.playDates, result.date];
  const streak = result.won ? save.streak + 1 : 0;
  const bestStreak = Math.max(save.bestStreak, streak);
  const bestGuesses =
    result.won && (save.bestGuesses === 0 || result.guesses < save.bestGuesses)
      ? result.guesses
      : save.bestGuesses;
  return {
    wins: save.wins + (result.won ? 1 : 0),
    losses: save.losses + (result.won ? 0 : 1),
    streak,
    bestStreak,
    bestGuesses,
    playDates,
    lastResult: resultSummary(result),
    daily,
  };
}
