export const SAVE_KEY = "glowtrail:v1";
export const SAVE_VERSION = 1;

export const KNOWN_PACKS = ["pulse", "surge", "color-gates", "lattice", "wormhole", "vector", "daily"] as const;

export const DAILY_LENGTH = 5;
export const MAX_STARS = 3;

export interface SaveData {
  version: number;
  stars: Record<string, number>;
  solved: Record<string, boolean>;
  currentPack: string;
  tutorialDone: boolean;
  streak: number;
  lastDailyDate: string | null;
  dailyDate: string | null;
  dailyCompleted: boolean[];
  dailyStars: number[];
  muted: boolean;
  arcadeHighScores: Record<string, number>;
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    stars: {},
    solved: {},
    currentPack: "pulse",
    tutorialDone: false,
    streak: 0,
    lastDailyDate: null,
    dailyDate: null,
    dailyCompleted: Array.from({ length: DAILY_LENGTH }, () => false),
    dailyStars: Array.from({ length: DAILY_LENGTH }, () => 0),
    muted: false,
    arcadeHighScores: {},
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asBoolMap(value: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!value || typeof value !== "object") return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

function clampStar(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_STARS, Math.round(value)));
}

function asStarMap(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value || typeof value !== "object") return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = clampStar(v);
  }
  return out;
}

function asBoolArr(value: unknown, len: number): boolean[] {
  const base = Array.isArray(value) ? value : [];
  return Array.from({ length: len }, (_, i) => base[i] === true);
}

function asStarArr(value: unknown, len: number): number[] {
  const base = Array.isArray(value) ? value : [];
  return Array.from({ length: len }, (_, i) => clampStar(base[i]));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function asDateOrNull(value: unknown): string | null {
  if (value === null) return null;
  return isDateString(value) ? value : null;
}

export function isKnownPack(value: unknown): value is string {
  return typeof value === "string" && (KNOWN_PACKS as readonly string[]).includes(value);
}

function asHighScoreMap(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value || typeof value !== "object") return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[k] = Math.floor(v);
    }
  }
  return out;
}

export function sanitizeSave(raw: unknown): SaveData {
  const d = defaultSave();
  if (raw == null || typeof raw !== "object") return d;
  const o = asRecord(raw);
  d.stars = asStarMap(o.stars);
  d.solved = asBoolMap(o.solved);
  if (isKnownPack(o.currentPack)) d.currentPack = o.currentPack;
  if (typeof o.tutorialDone === "boolean") d.tutorialDone = o.tutorialDone;
  if (typeof o.streak === "number" && Number.isFinite(o.streak) && o.streak >= 0) {
    d.streak = Math.floor(o.streak);
  }
  d.lastDailyDate = asDateOrNull(o.lastDailyDate);
  d.dailyDate = asDateOrNull(o.dailyDate);
  d.dailyCompleted = asBoolArr(o.dailyCompleted, DAILY_LENGTH);
  d.dailyStars = asStarArr(o.dailyStars, DAILY_LENGTH);
  if (typeof o.muted === "boolean") d.muted = o.muted;
  d.arcadeHighScores = asHighScoreMap(o.arcadeHighScores);
  d.version = SAVE_VERSION;
  return d;
}

export const SAVE_KEY_V1 = SAVE_KEY;
export const SAVE_KEY_V2 = "glowtrail:v2";
export const SAVE_VERSION_V2 = 2;

export type GlowtrailSave = SaveData;

export interface ProfileSave {
  xp: number;
  level: number;
  streak: number;
  lastDailyDate: string | null;
  lastGame: string;
  muted: boolean;
  reduceMotion: "auto" | "on" | "off";
  theme: string;
  cosmetics: string[];
  achievements: string[];
  gauntletDate: string | null;
  gauntletDone: string[];
}

export interface FusionSave {
  best: number;
  runs: number;
  dailyBest: Record<string, number>;
  levels: Record<string, LevelRecord>;
}

export interface PrismSave {
  solved: string[];
  bestMoves: Record<string, number>;
  levels: Record<string, LevelRecord>;
}

export interface LevelRecord {
  won: boolean;
  stars: number;
  best: number;
  bestTimeMs: number | null;
  hints: number;
  attempts: number;
}

export interface GlyphDailyRecord {
  won: boolean;
  guesses: number;
  modifier: string;
  score: number;
  hints: number;
}

export interface GlyphSave {
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  bestGuesses: number;
  playDates: string[];
  lastResult: string | null;
  daily: Record<string, GlyphDailyRecord>;
  levels: Record<string, LevelRecord>;
}

/** One scored NEON BLOCKS daily run, keyed by local date. */
export interface BlocksDailyRecord {
  score: number;
  lines: number;
  stars: number;
}

export interface BlocksSave {
  best: number;
  runs: number;
  lines: number;
  bestCombo: number;
  dailyStreak: number;
  bestDailyStreak: number;
  daily: Record<string, BlocksDailyRecord>;
}

/** One scored NEON ARROWS daily board, keyed by local date. */
export interface ArrowsDailyRecord {
  solved: boolean;
  /** Successful launches used to clear the board. */
  launches: number;
  stars: number;
}

/** Schema version of the arrows slice; bump to invalidate older progress. */
export const ARROWS_SAVE_VERSION = 2;

export interface ArrowsSave {
  version: number;
  levels: Record<string, LevelRecord>;
  best: number;
  runs: number;
  boards: number;
  bestRun: number;
  perfect: number;
  dailyStreak: number;
  bestDailyStreak: number;
  daily: Record<string, ArrowsDailyRecord>;
}

export interface BasicScoreSave {
  best: number;
  level?: number;
}

export interface SaveV2 {
  version: 2;
  profile: ProfileSave;
  games: {
    glowtrail: GlowtrailSave;
    fusion: FusionSave;
    prism: PrismSave;
    glyph: GlyphSave;
    blocks: BlocksSave;
    arrows: ArrowsSave;
    snake: BasicScoreSave;
    breaker: BasicScoreSave;
    matrix: BasicScoreSave;
    wordsearch: BasicScoreSave;
    wordconnect: BasicScoreSave;
    meowdoku: BasicScoreSave;
  };
}

export function defaultProfile(): ProfileSave {
  return {
    xp: 0,
    level: 1,
    streak: 0,
    lastDailyDate: null,
    lastGame: "glowtrail",
    muted: false,
    reduceMotion: "auto",
    theme: "neon",
    cosmetics: [],
    achievements: [],
    gauntletDate: null,
    gauntletDone: [],
  };
}

export function defaultSaveV2(): SaveV2 {
  return {
    version: 2,
    profile: defaultProfile(),
    games: {
      glowtrail: defaultSave(),
      fusion: { best: 0, runs: 0, dailyBest: {}, levels: {} },
      prism: { solved: [], bestMoves: {}, levels: {} },
      glyph: {
        wins: 0,
        losses: 0,
        streak: 0,
        bestStreak: 0,
        bestGuesses: 0,
        playDates: [],
        lastResult: null,
        daily: {},
        levels: {},
      },
      blocks: {
        best: 0,
        runs: 0,
        lines: 0,
        bestCombo: 0,
        dailyStreak: 0,
        bestDailyStreak: 0,
        daily: {},
      },
      arrows: {
        version: ARROWS_SAVE_VERSION,
        levels: {},
        best: 0,
        runs: 0,
        boards: 0,
        bestRun: 0,
        perfect: 0,
        dailyStreak: 0,
        bestDailyStreak: 0,
        daily: {},
      },
      snake: { best: 0 },
      breaker: { best: 0 },
      matrix: { best: 0 },
      wordsearch: { best: 0 },
      wordconnect: { best: 0 },
      meowdoku: { best: 0 },
    },
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asNumberMap(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value || typeof value !== "object") return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

function asCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function asGlyphDaily(value: unknown): Record<string, GlyphDailyRecord> {
  const out: Record<string, GlyphDailyRecord> = {};
  if (!value || typeof value !== "object") return out;
  for (const [date, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!isDateString(date)) continue;
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    out[date] = {
      won: e.won === true,
      guesses: asCount(e.guesses),
      modifier: typeof e.modifier === "string" ? e.modifier : "clear",
      score: asCount(e.score),
      hints: asCount(e.hints),
    };
  }
  return out;
}

function asBlocksDaily(value: unknown): Record<string, BlocksDailyRecord> {
  const out: Record<string, BlocksDailyRecord> = {};
  if (!value || typeof value !== "object") return out;
  for (const [date, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!isDateString(date)) continue;
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    out[date] = {
      score: asCount(e.score),
      lines: asCount(e.lines),
      stars: clampStar(e.stars),
    };
  }
  return out;
}

function asArrowsDaily(value: unknown): Record<string, ArrowsDailyRecord> {
  const out: Record<string, ArrowsDailyRecord> = {};
  if (!value || typeof value !== "object") return out;
  for (const [date, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!isDateString(date)) continue;
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    out[date] = {
      solved: e.solved === true,
      launches: asCount(e.launches),
      stars: clampStar(e.stars),
    };
  }
  return out;
}

function asLevelRecords(value: unknown): Record<string, LevelRecord> {
  const out: Record<string, LevelRecord> = {};
  if (!value || typeof value !== "object") return out;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const n = Number(key);
    if (!Number.isInteger(n) || n < 1) continue;
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    out[String(n)] = {
      won: e.won === true,
      stars: clampStar(e.stars),
      best: asCount(e.best),
      bestTimeMs:
        typeof e.bestTimeMs === "number" && Number.isFinite(e.bestTimeMs) && e.bestTimeMs >= 0
          ? Math.floor(e.bestTimeMs)
          : null,
      hints: asCount(e.hints),
      attempts: asCount(e.attempts),
    };
  }
  return out;
}

export function sanitizeProfile(raw: unknown): ProfileSave {
  const d = defaultProfile();
  if (raw == null || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  d.xp = asCount(o.xp);
  if (typeof o.level === "number" && Number.isFinite(o.level) && o.level >= 1) {
    d.level = Math.floor(o.level);
  }
  if (typeof o.streak === "number" && Number.isFinite(o.streak) && o.streak >= 0) {
    d.streak = Math.floor(o.streak);
  }
  d.lastDailyDate = asDateOrNull(o.lastDailyDate);
  if (typeof o.lastGame === "string" && o.lastGame.length > 0) d.lastGame = o.lastGame;
  if (typeof o.muted === "boolean") d.muted = o.muted;
  if (o.reduceMotion === "auto" || o.reduceMotion === "on" || o.reduceMotion === "off") {
    d.reduceMotion = o.reduceMotion;
  }
  if (typeof o.theme === "string") d.theme = o.theme;
  d.cosmetics = asStringArray(o.cosmetics);
  d.achievements = asStringArray(o.achievements);
  d.gauntletDate = asDateOrNull(o.gauntletDate);
  d.gauntletDone = asStringArray(o.gauntletDone);
  return d;
}

export function sanitizeV2(raw: unknown): SaveV2 {
  const d = defaultSaveV2();
  if (raw == null || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  d.profile = sanitizeProfile(o.profile);
  const g = o.games && typeof o.games === "object" ? (o.games as Record<string, unknown>) : {};
  d.games.glowtrail = sanitizeSave(g.glowtrail);
  if (g.fusion && typeof g.fusion === "object") {
    const f = g.fusion as Record<string, unknown>;
    d.games.fusion.best = asCount(f.best);
    d.games.fusion.runs = asCount(f.runs);
    d.games.fusion.dailyBest = asNumberMap(f.dailyBest);
    d.games.fusion.levels = asLevelRecords(f.levels);
  }
  if (g.prism && typeof g.prism === "object") {
    const p = g.prism as Record<string, unknown>;
    d.games.prism.solved = asStringArray(p.solved);
    d.games.prism.bestMoves = asNumberMap(p.bestMoves);
    d.games.prism.levels = asLevelRecords(p.levels);
  }
  if (g.glyph && typeof g.glyph === "object") {
    const w = g.glyph as Record<string, unknown>;
    d.games.glyph.wins = asCount(w.wins);
    d.games.glyph.losses = asCount(w.losses);
    d.games.glyph.streak = asCount(w.streak);
    d.games.glyph.bestStreak = asCount(w.bestStreak);
    d.games.glyph.bestGuesses = asCount(w.bestGuesses);
    d.games.glyph.playDates = asStringArray(w.playDates);
    d.games.glyph.lastResult = typeof w.lastResult === "string" ? w.lastResult : null;
    d.games.glyph.daily = asGlyphDaily(w.daily);
    d.games.glyph.levels = asLevelRecords(w.levels);
  }
  if (g.blocks && typeof g.blocks === "object") {
    const b = g.blocks as Record<string, unknown>;
    d.games.blocks.best = asCount(b.best);
    d.games.blocks.runs = asCount(b.runs);
    d.games.blocks.lines = asCount(b.lines);
    d.games.blocks.bestCombo = asCount(b.bestCombo);
    d.games.blocks.dailyStreak = asCount(b.dailyStreak);
    d.games.blocks.bestDailyStreak = asCount(b.bestDailyStreak);
    d.games.blocks.daily = asBlocksDaily(b.daily);
  }
  if (g.arrows && typeof g.arrows === "object") {
    const a = g.arrows as Record<string, unknown>;
    // Older arrows boards used a step-slide model and are invalid here.
    if (asCount(a.version) === ARROWS_SAVE_VERSION) {
      d.games.arrows.version = ARROWS_SAVE_VERSION;
      d.games.arrows.levels = asLevelRecords(a.levels);
      d.games.arrows.best = asCount(a.best);
      d.games.arrows.runs = asCount(a.runs);
      d.games.arrows.boards = asCount(a.boards);
      d.games.arrows.bestRun = asCount(a.bestRun);
      d.games.arrows.perfect = asCount(a.perfect);
      d.games.arrows.dailyStreak = asCount(a.dailyStreak);
      d.games.arrows.bestDailyStreak = asCount(a.bestDailyStreak);
      d.games.arrows.daily = asArrowsDaily(a.daily);
    }
  }
  if (g.snake && typeof g.snake === "object") {
    const s = g.snake as Record<string, unknown>;
    d.games.snake.best = asCount(s.best);
  }
  if (g.breaker && typeof g.breaker === "object") {
    const b = g.breaker as Record<string, unknown>;
    d.games.breaker.best = asCount(b.best);
  }
  if (g.matrix && typeof g.matrix === "object") {
    const m = g.matrix as Record<string, unknown>;
    d.games.matrix.best = asCount(m.best);
  }
  if (g.wordsearch && typeof g.wordsearch === "object") {
    const ws = g.wordsearch as Record<string, unknown>;
    d.games.wordsearch.best = asCount(ws.best);
    if (typeof ws.level === "number" && Number.isFinite(ws.level) && ws.level >= 1) {
      d.games.wordsearch.level = Math.floor(ws.level);
    }
  }
  if (g.wordconnect && typeof g.wordconnect === "object") {
    const wc = g.wordconnect as Record<string, unknown>;
    d.games.wordconnect.best = asCount(wc.best);
    if (typeof wc.level === "number" && Number.isFinite(wc.level) && wc.level >= 1) {
      d.games.wordconnect.level = Math.floor(wc.level);
    }
  }
  if (g.meowdoku && typeof g.meowdoku === "object") {
    const md = g.meowdoku as Record<string, unknown>;
    d.games.meowdoku.best = asCount(md.best);
    if (typeof md.level === "number" && Number.isFinite(md.level) && md.level >= 1) {
      d.games.meowdoku.level = Math.floor(md.level);
    }
  }
  d.version = 2;
  return d;
}
