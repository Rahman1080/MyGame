import { hashString, mulberry32 } from "../../gen/seededRng";
import { dailySeed } from "../../platform/dailySeed";
import { tierForLevel, timeLimitMs, type Tier } from "../../platform/levels";
import type { GlyphDailyRecord, GlyphSave, LevelRecord } from "../../save/schema";
import { ANSWER_WORDS, VALID_WORDS } from "./words";

export const GLYPH_WORD_LENGTH = 5;
export const GLYPH_MAX_GUESSES = 6;
export const GLYPH_DAILY_ID = "glyph-daily";
export const ENERGY_PER_CLUE = 8;
export const GLYPH_MAX_CLUES = 2;
export const GLYPH_LEVELS = 105;
export const GLYPH_HINT_PENALTY = 25;

export const MODIFIERS = ["clear", "double", "energy", "category"] as const;
export type ModifierId = (typeof MODIFIERS)[number];

export type GlyphMode = "daily" | "level";

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
  mode: GlyphMode;
  level: number;
  hinted: string[];
  timeLimitMs: number;
  timedOut: boolean;
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
  hints: number;
  mode: GlyphMode;
  level: number;
  timeMs: number;
}

export interface GlyphLevelConfig {
  level: number;
  tier: Tier;
  answer: string;
  category: string;
  modifier: ModifierId;
  timeLimitMs: number;
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

export type KeyMark = TileMark | "hint";

const VALID_SET = new Set<string>(VALID_WORDS);
const ANSWER_MAP = new Map<string, string>(ANSWER_WORDS.map((entry) => [entry.word, entry.category]));
const RANK: Record<KeyMark, number> = { absent: 0, hint: 1, present: 2, correct: 3 };

const TIER_MODIFIERS: Record<Tier, readonly ModifierId[]> = {
  easy: ["clear"],
  normal: ["clear", "category"],
  medium: ["category", "double"],
  hard: ["double", "energy"],
  super: ["energy", "double"],
  extra: ["energy", "category"],
  mind: ["double", "energy"],
};

function levelAnswerOrder(): string[] {
  const rng = mulberry32(hashString("glyph:level:order"));
  const words = ANSWER_WORDS.map((entry) => entry.word);
  for (let i = words.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = words[i]!;
    words[i] = words[j]!;
    words[j] = swap;
  }
  return words;
}

const LEVEL_ORDER = levelAnswerOrder();

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
  let modifier = MODIFIERS[Math.floor(rng() * MODIFIERS.length)]!;
  if (modifier === "double" && !doubledLetter(entry.word)) modifier = "clear";
  return { date, answer: entry.word, category: entry.category, modifier };
}

function modifierForTier(tier: Tier, rng: () => number): ModifierId {
  const pool = TIER_MODIFIERS[tier];
  return pool[Math.floor(rng() * pool.length)]!;
}

export function levelConfig(level: number): GlyphLevelConfig {
  const safe = Math.min(GLYPH_LEVELS, Math.max(1, Math.floor(level)));
  const answer = LEVEL_ORDER[safe - 1]!;
  const tier = tierForLevel(safe, GLYPH_LEVELS);
  const rng = mulberry32(hashString(`glyph:level:${safe}`));
  let modifier = modifierForTier(tier, rng);
  if (modifier === "double" && !doubledLetter(answer)) modifier = "clear";
  return {
    level: safe,
    tier,
    answer,
    category: categoryFor(answer),
    modifier,
    timeLimitMs: timeLimitMs(safe, GLYPH_LEVELS),
  };
}

export function levelAnswer(level: number): string {
  return LEVEL_ORDER[Math.min(GLYPH_LEVELS, Math.max(1, Math.floor(level))) - 1]!;
}

export function levelTier(level: number): Tier {
  return tierForLevel(Math.min(GLYPH_LEVELS, Math.max(1, Math.floor(level))), GLYPH_LEVELS);
}

function stateFromConfig(
  config: { answer: string; category: string; modifier: ModifierId },
  over: Partial<GlyphState>,
): GlyphState {
  return {
    date: config.answer,
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
    mode: "daily",
    level: 0,
    hinted: [],
    timeLimitMs: 0,
    timedOut: false,
    ...over,
  };
}

export function startDaily(date: string): GlyphState {
  const config = dailyConfig(date);
  return stateFromConfig(config, { date, mode: "daily", level: 0 });
}

export function startLevel(level: number): GlyphState {
  const config = levelConfig(level);
  return stateFromConfig(config, {
    date: `level-${config.level}`,
    mode: "level",
    level: config.level,
    timeLimitMs: config.timeLimitMs,
  });
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
    const knownIndices = new Set<number>();
    for (const guess of next.guesses) {
      for (let i = 0; i < guess.word.length; i++) {
        if (guess.marks[i] === "correct") knownIndices.add(i);
      }
    }
    for (const c of clues) knownIndices.add(c.index);

    while (energy >= ENERGY_PER_CLUE && clues.length < GLYPH_MAX_CLUES) {
      let targetIndex = -1;
      for (let i = 0; i < next.answer.length; i++) {
        if (!knownIndices.has(i)) {
          targetIndex = i;
          break;
        }
      }
      if (targetIndex < 0) break;
      const letter = next.answer[targetIndex]!;
      energy -= ENERGY_PER_CLUE;
      knownIndices.add(targetIndex);
      clues.push({ index: targetIndex, letter });
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

export function keyboardState(state: GlyphState): Record<string, KeyMark> {
  const out: Record<string, KeyMark> = {};
  for (const ch of state.hinted) out[ch] = "hint";
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

export function hintedLetters(state: GlyphState): string[] {
  return state.hinted.slice();
}

export function hintableLetters(state: GlyphState): string[] {
  if (state.status !== "playing") return [];
  const known = new Set<string>();
  for (const guess of state.guesses) {
    for (let i = 0; i < guess.word.length; i += 1) {
      if (guess.marks[i] === "correct") known.add(guess.word[i]!);
    }
  }
  const hinted = new Set(state.hinted);
  const out: string[] = [];
  for (const ch of state.answer) {
    if (known.has(ch) || hinted.has(ch) || out.includes(ch)) continue;
    out.push(ch);
  }
  return out;
}

export function canHint(state: GlyphState): boolean {
  return state.status === "playing" && hintableLetters(state).length > 0;
}

export function takeHint(state: GlyphState): GlyphState {
  if (state.status !== "playing") return state;
  const letter = hintableLetters(state)[0];
  if (letter === undefined) return state;
  return { ...state, hinted: [...state.hinted, letter] };
}

export function expireTimer(state: GlyphState): GlyphState {
  if (state.status !== "playing" || state.timeLimitMs <= 0) return state;
  return { ...state, status: "lost", timedOut: true };
}

export function scoreGlyph(state: GlyphState, streak = 0): number {
  if (state.status !== "won") return GLYPH_SCORE.lossBase;
  let score = GLYPH_SCORE.winBase + remainingGuesses(state) * GLYPH_SCORE.perGuessLeft;
  if (state.guesses.length === 1) score += GLYPH_SCORE.perfect;
  if (state.modifier === "double" && state.doubleHit) score += GLYPH_SCORE.doubleBonus;
  score += Math.min(Math.max(0, streak), GLYPH_SCORE.streakMax) * GLYPH_SCORE.streakStep;
  score -= state.hinted.length * GLYPH_HINT_PENALTY;
  return Math.max(0, score);
}

export function starsForGlyph(state: GlyphState): number {
  if (state.status !== "won") return 0;
  const used = state.guesses.length;
  const base = used <= 2 ? 3 : used <= 4 ? 2 : 1;
  return state.hinted.length > 0 ? Math.min(base, 2) : base;
}

export function finalResult(state: GlyphState, streak = 0, elapsedMs = 0): GlyphResult {
  return {
    date: state.date,
    won: state.status === "won",
    guesses: state.guesses.length,
    answer: state.answer,
    modifier: state.modifier,
    score: scoreGlyph(state, streak),
    stars: starsForGlyph(state),
    hints: state.hinted.length,
    mode: state.mode,
    level: state.level,
    timeMs: Math.max(0, Math.floor(elapsedMs)),
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
    levels: {},
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
      hints: result.hints,
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
    levels: save.levels,
  };
}

export function levelRecordFor(save: GlyphSave, level: number): LevelRecord | null {
  return save.levels[String(level)] ?? null;
}

export function isLevelSolved(save: GlyphSave, level: number): boolean {
  return save.levels[String(level)]?.won === true;
}

export function isLevelUnlocked(save: GlyphSave, level: number): boolean {
  const safe = Math.max(1, Math.floor(level));
  if (safe <= 1) return true;
  return isLevelSolved(save, safe - 1);
}

export function isLevelFirstWin(save: GlyphSave, level: number): boolean {
  return !isLevelSolved(save, level);
}

export function nextLevel(save: GlyphSave, from: number): number {
  const safe = Math.max(1, Math.floor(from));
  if (safe >= GLYPH_LEVELS) return safe;
  return isLevelUnlocked(save, safe + 1) ? safe + 1 : safe;
}

export function recordGlyphLevelResult(save: GlyphSave, result: GlyphResult): GlyphSave {
  if (result.mode !== "level" || result.level < 1) return save;
  const key = String(result.level);
  const prev = save.levels[key];
  const won = prev?.won === true || result.won;
  const best = Math.max(prev?.best ?? 0, result.score);
  let bestTimeMs = prev?.bestTimeMs ?? null;
  if (result.won && result.timeMs > 0) {
    bestTimeMs = bestTimeMs === null ? result.timeMs : Math.min(bestTimeMs, result.timeMs);
  }
  const record: LevelRecord = {
    won,
    stars: Math.max(prev?.stars ?? 0, result.stars),
    best,
    bestTimeMs,
    hints: (prev?.hints ?? 0) + result.hints,
    attempts: (prev?.attempts ?? 0) + 1,
  };
  return { ...save, levels: { ...save.levels, [key]: record } };
}

export function buildLevelShare(result: GlyphResult): string {
  const outcome = result.won
    ? `SOLVED ${result.guesses}/${GLYPH_MAX_GUESSES}`
    : `MISSED 0/${GLYPH_MAX_GUESSES}`;
  return [
    `GLYPH LEVEL ${result.level} - ${result.won ? "CLEARED" : "FAILED"}`,
    `${outcome} - ${result.score} pts - ${result.stars} stars`,
    "GLOWTRAIL ARCADE",
  ].join("\n");
}
