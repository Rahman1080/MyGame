import { localYmd } from "../../gen/daily";
import { hintGate, isExpired, TIER_LABELS } from "../../platform/levels";
import { setBackHandler } from "../../platform/router";
import { EVENTS } from "../../platform/services/telemetry";
import type { GameContext } from "../../platform/types";
import type { GlyphDailyRecord, GlyphSave } from "../../save/schema";
import {
  GLYPH_LEVELS,
  GLYPH_MAX_GUESSES,
  MODIFIER_HELP,
  buildLevelShare,
  buildRecordShare,
  buildShare,
  canHint,
  dailyConfig,
  dailyRecordFor,
  expireTimer,
  finalResult,
  isDailyDone,
  isFinished,
  isLevelSolved,
  isLevelUnlocked,
  levelTier,
  modifierLabel,
  recordGlyphLevelResult,
  recordGlyphResult,
  starsForGuesses,
  startDaily,
  startLevel,
  submitGuess,
  takeHint,
  type GlyphMode,
  type GlyphState,
  type GuessError,
} from "./logic";
import {
  announceGuess,
  boardHtml,
  cluesHtml,
  hintButtonHtml,
  hintChipsHtml,
  keyboardHtml,
  levelGridHtml,
  levelHeaderHtml,
  modifierBannerHtml,
  timerHtml,
} from "./render";

type Screen = "select" | "play" | "result" | "help";

interface ResultView {
  won: boolean;
  guesses: number;
  score: number;
  stars: number;
  modifier: string;
  ranked: boolean;
  share: string;
  emojiGrid?: string;
  mode: GlyphMode;
  level: number;
  hints: number;
  timeMs: number;
  timedOut: boolean;
  answer: string;
  firstWin: boolean;
  next: number | null;
}

const ERROR_TEXT: Record<GuessError, string> = {
  length: "Five letters only.",
  letters: "Letters only, please.",
  unknown: "Not in the word list.",
  finished: "This puzzle is done.",
};

let app: HTMLElement;
let ctx: GameContext<GlyphSave> | null = null;
let state: GlyphState | null = null;
let draft = "";
let screen: Screen = "select";
let ranked = false;
let helpFrom: Screen = "select";
let date = "";
let result: ResultView | null = null;
let ac: AbortController | null = null;
let timerId: number | null = null;
let startedAt = 0;
let elapsedMs = 0;

function reduced(): boolean {
  return ctx?.settings.reduceMotion() ?? false;
}

function currentElapsed(): number {
  if (state && state.timeLimitMs > 0 && startedAt > 0) {
    return Math.min(elapsedMs || performance.now() - startedAt, state.timeLimitMs);
  }
  return elapsedMs;
}

function setStatus(message: string): void {
  const el = app.querySelector<HTMLElement>("#glyph-status");
  if (el) el.textContent = message;
}

function stopTimer(): void {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function updateTimerDom(): void {
  const wrap = app.querySelector<HTMLElement>(".glyph-timer-wrap");
  if (wrap && state && state.timeLimitMs > 0) wrap.innerHTML = timerHtml(state, state.timeLimitMs - currentElapsed());
}

function tickTimer(): void {
  if (!state || state.status !== "playing" || state.timeLimitMs <= 0) {
    stopTimer();
    return;
  }
  elapsedMs = performance.now() - startedAt;
  updateTimerDom();
  if (isExpired(state.timeLimitMs, elapsedMs)) {
    state = expireTimer(state);
    finish();
  }
}

function beginTimer(): void {
  stopTimer();
  startedAt = 0;
  elapsedMs = 0;
  if (!state || state.timeLimitMs <= 0) return;
  startedAt = performance.now();
  timerId = window.setInterval(tickTimer, 250);
}

function renderPlayChrome(): void {
  if (!state) return;
  const banner = app.querySelector<HTMLElement>(".glyph-banner");
  if (banner) banner.innerHTML = modifierBannerHtml(state);
  const board = app.querySelector<HTMLElement>(".glyph-board");
  if (board) board.innerHTML = boardHtml(state, draft);
  const clues = app.querySelector<HTMLElement>(".glyph-clues-wrap");
  if (clues) clues.innerHTML = cluesHtml(state);
  const hints = app.querySelector<HTMLElement>(".glyph-hint-wrap");
  if (hints) hints.innerHTML = hintChipsHtml(state);
  const hintBtn = app.querySelector<HTMLElement>(".glyph-hint-btn-wrap");
  if (hintBtn) hintBtn.innerHTML = hintButtonHtml(state);
  const keyboard = app.querySelector<HTMLElement>(".glyph-keyboard");
  if (keyboard) keyboard.innerHTML = keyboardHtml(state);
  updateTimerDom();
}

function finalFor(current: GlyphState): ReturnType<typeof finalResult> {
  const streak = current.mode === "daily" ? ctx?.save.streak ?? 0 : 0;
  return finalResult(current, streak, currentElapsed());
}

function viewFromState(current: GlyphState, final: ReturnType<typeof finalResult>, firstWin: boolean): ResultView {
  const isLevel = current.mode === "level";
  const next =
    isLevel && final.won && current.level < GLYPH_LEVELS && isLevelUnlocked(ctx?.save ?? emptySave(), current.level + 1)
      ? current.level + 1
      : null;
  const EMOJI_MAP: Record<string, string> = { correct: "🟩", present: "🟨", absent: "⬛" };
  const emojiGrid = current.guesses
    .map((g) => g.marks.map((m) => EMOJI_MAP[m] ?? "⬛").join(""))
    .join("<br>");
  return {
    won: final.won,
    guesses: final.guesses,
    score: final.score,
    stars: final.stars,
    modifier: final.modifier,
    ranked: current.mode === "daily" && ranked,
    share: isLevel ? buildLevelShare(final) : buildShare(current, ctx?.save.streak ?? 0),
    emojiGrid,
    mode: current.mode,
    level: current.level,
    hints: final.hints,
    timeMs: final.timeMs,
    timedOut: current.timedOut,
    answer: current.answer,
    firstWin,
    next,
  };
}

function emptySave(): GlyphSave {
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

function viewFromRecord(record: GlyphDailyRecord): ResultView {
  const config = dailyConfig(date);
  return {
    won: record.won,
    guesses: record.guesses,
    score: record.score,
    stars: record.won ? starsForGuesses(record.guesses) : 0,
    modifier: record.modifier,
    ranked: false,
    share: buildRecordShare(date, record),
    mode: "daily",
    level: 0,
    hints: record.hints,
    timeMs: 0,
    timedOut: false,
    answer: config.answer,
    firstWin: false,
    next: null,
  };
}

function starsText(view: ResultView): string {
  return view.won ? `${"★".repeat(view.stars)}${"☆".repeat(3 - view.stars)}` : "☆☆☆";
}

function resultCardHtml(view: ResultView): string {
  const isLevel = view.mode === "level";
  const title = view.won ? (isLevel ? "CLEARED" : "SOLVED") : view.timedOut ? "TIME UP" : isLevel ? "FAILED" : "MISSED";
  const badge = isLevel
    ? view.firstWin
      ? `<div class="glyph-practice reward">FIRST CLEAR +XP</div>`
      : `<div class="glyph-practice">${view.won ? "PRACTICE - NO REWARDS" : "LEVEL MODE"}</div>`
    : view.ranked
      ? ""
      : `<div class="glyph-practice">PRACTICE - NO REWARDS</div>`;
  const reveal = view.won
    ? ""
    : `<p class="glyph-reveal">The word was <strong>${view.answer.toUpperCase()}</strong>.</p>`;
  const nextBtn = view.next ? `<button class="cta-play" data-act="next" data-level="${view.next}">Next level</button>` : "";
  const meta = isLevel
    ? `${view.guesses}/${GLYPH_MAX_GUESSES} GUESSES · ${view.score} PTS · ${view.hints} HINTS`
    : `${view.guesses}/${GLYPH_MAX_GUESSES} GUESSES · ${view.score} PTS · ${modifierLabel(view.modifier)}`;
  return `<div class="overlay">
    <div class="win-card glyph-card">
      <h2>${title}</h2>
      ${badge}
      <div class="stars" aria-label="${view.stars} of 3 stars">${starsText(view)}</div>
      <div class="win-meta">${meta}</div>
      ${view.emojiGrid ? `<div class="glyph-emoji-grid" aria-hidden="true">${view.emojiGrid}</div>` : ""}
      ${reveal}
      <div class="win-actions">
        ${nextBtn}
        ${isLevel && !view.won ? `<button class="ghost-btn" data-act="retry" data-level="${view.level}">Try again</button>` : ""}
        ${!isLevel && !view.ranked ? `<button class="ghost-btn" data-act="practice">Play again</button>` : ""}
        <button class="cta-play" data-act="share">Share</button>
        <button class="ghost-btn" data-act="select">Levels</button>
        <button class="ghost-btn" data-act="help">How to play</button>
        <button class="ghost-btn" data-act="arcade">Arcade</button>
      </div>
    </div>
  </div>`;
}

function dailyCardHtml(): string {
  const record = ctx ? dailyRecordFor(ctx.save, date) : null;
  const modifier = modifierLabel(dailyConfig(date).modifier);
  const status = record
    ? record.won
      ? `SOLVED ${record.guesses}/${GLYPH_MAX_GUESSES} · ${record.score} PTS`
      : `MISSED · PRACTICE ONLY`
    : "TODAY'S RANKED PUZZLE";
  return `<button type="button" class="glyph-daily-card${record ? " done" : ""}" data-act="daily">
    <span class="glyph-daily-label">DAILY</span>
    <span class="glyph-daily-date">${date} · ${modifier}</span>
    <span class="glyph-daily-status">${status}</span>
  </button>`;
}

function selectHtml(): string {
  const save = ctx?.save ?? emptySave();
  return `<div class="shell glyph-shell${reduced() ? " reduce" : ""}">
    <div class="glyph-top">
      <button class="icon-btn" data-act="arcade" aria-label="Back to arcade">‹</button>
      <div class="glyph-head">
        <div class="glyph-word">GLYPH</div>
        <div class="glyph-date">${GLYPH_LEVELS} LEVELS · 7 TIERS</div>
      </div>
      <button class="icon-btn" data-act="help" aria-label="How to play">?</button>
    </div>
    ${dailyCardHtml()}
    ${levelGridHtml(save)}
  </div>`;
}

function playHtml(): string {
  if (!state) return "";
  const isLevel = state.mode === "level";
  const subtitle = isLevel
    ? `${TIER_LABELS[levelTier(state.level)]} · ${modifierLabel(state.modifier)}`
    : `${date} · ${modifierLabel(state.modifier)}`;
  return `<div class="shell glyph-shell${reduced() ? " reduce" : ""}">
    <div class="glyph-top">
      <button class="icon-btn" data-act="select" aria-label="Back to levels">‹</button>
      <div class="glyph-head">
        <div class="glyph-word">${isLevel ? `LEVEL ${state.level}` : "GLYPH"}</div>
        <div class="glyph-date">${subtitle}</div>
      </div>
      <button class="icon-btn" data-act="help" aria-label="How to play">?</button>
    </div>
    ${levelHeaderHtml(state)}
    <div class="glyph-timer-wrap">${timerHtml(state, state.timeLimitMs)}</div>
    <div class="glyph-banner">${modifierBannerHtml(state)}</div>
    <div class="glyph-hint-wrap">${hintChipsHtml(state)}</div>
    <div class="glyph-board" role="group" aria-label="Guess board">${boardHtml(state, draft)}</div>
    <div class="glyph-clues-wrap">${cluesHtml(state)}</div>
    <div class="glyph-status" id="glyph-status" role="status" aria-live="polite"></div>
    <div class="glyph-hint-btn-wrap">${hintButtonHtml(state)}</div>
    <div class="glyph-keyboard">${keyboardHtml(state)}</div>
  </div>`;
}

function helpHtml(): string {
  const modifier = state ? state.modifier : dailyConfig(date).modifier;
  return `<div class="shell glyph-shell${reduced() ? " reduce" : ""}">
    <div class="glyph-top">
      <button class="icon-btn" data-act="close-help" aria-label="Close help">‹</button>
      <div class="glyph-head"><div class="glyph-word">HOW TO PLAY</div></div>
      <span class="glyph-spacer"></span>
    </div>
    <div class="glyph-help">
      <p>Guess the hidden five letter word in six tries.</p>
      <p>Every guess must be a real word from the GLYPH dictionary.</p>
      <ul class="glyph-legend">
        <li><span class="glyph-tile correct" aria-hidden="true"><span class="glyph-mark">✓</span></span> Right letter, right spot.</li>
        <li><span class="glyph-tile present" aria-hidden="true"><span class="glyph-mark">~</span></span> Right letter, wrong spot.</li>
        <li><span class="glyph-tile absent" aria-hidden="true"><span class="glyph-mark">·</span></span> Letter is not in the word.</li>
      </ul>
      <div class="glyph-mod-box">
        <div class="glyph-mod-title">MODIFIER: ${modifierLabel(modifier)}</div>
        <p>${MODIFIER_HELP[modifier]}</p>
      </div>
      <p>Stuck? Hints reveal a letter that is in the word, never a position. Timed levels fail when the clock runs out.</p>
      <p class="glyph-dim">Levels unlock in order. First clears earn XP; replays are practice. The Daily keeps your streak and never mixes with level progress.</p>
      <button class="cta-play" data-act="close-help">Got it</button>
    </div>
  </div>`;
}

function render(): void {
  if (screen === "play") app.innerHTML = playHtml();
  else if (screen === "help") app.innerHTML = helpHtml();
  else if (screen === "select") app.innerHTML = selectHtml();
  else app.innerHTML = `<div class="shell glyph-shell${reduced() ? " reduce" : ""}">${resultCardHtml(result!)}</div>`;
}

function feedback(message: string, good = false): void {
  setStatus(message);
  if (!good) {
    ctx?.audio.invalid();
    ctx?.haptics.fail();
  }
}

function typeLetter(letter: string): void {
  if (!state || screen !== "play" || state.status !== "playing") return;
  if (draft.length >= 5) return;
  draft += letter;
  ctx?.audio.tap();
  renderPlayChrome();
}

function backspace(): void {
  if (!state || screen !== "play" || state.status !== "playing") return;
  if (draft.length === 0) return;
  draft = draft.slice(0, -1);
  ctx?.audio.tap();
  renderPlayChrome();
}

function finish(): void {
  if (!state || !ctx) return;
  stopTimer();
  const current = state;
  const final = finalFor(current);
  const isLevel = current.mode === "level";
  const alreadySolved = isLevel && isLevelSolved(ctx.save, current.level);
  const firstWin = isLevel && final.won && !alreadySolved;
  if (isLevel) {
    if (!alreadySolved) {
      ctx.updateSave(recordGlyphLevelResult(ctx.save, final));
    }
    if (firstWin) {
      ctx.report({ score: final.score, stars: final.stars, solved: true, stats: { level: current.level, guesses: final.guesses } });
      ctx.haptics.success();
      ctx.audio.levelComplete();
    } else if (final.won) {
      ctx.audio.select();
    } else {
      ctx.haptics.fail();
      ctx.audio.invalid();
      ctx.analytics.track(EVENTS.gameFailed, {
        game: "glyph",
        level: current.level,
        timed_out: current.timedOut ? 1 : 0,
      });
    }
  } else if (ranked && !isDailyDone(ctx.save, current.date)) {
    ctx.updateSave(recordGlyphResult(ctx.save, final));
    ctx.report({ score: final.score, stars: final.stars, solved: final.won, stats: { guesses: final.guesses } });
    ctx.analytics.track(final.won ? EVENTS.dailyCompleted : EVENTS.gameFailed, {
      game: "glyph",
      guesses: final.guesses,
    });
    if (final.won) {
      ctx.haptics.success();
      ctx.audio.levelComplete();
    } else {
      ctx.haptics.fail();
    }
  } else {
    ctx.audio.select();
  }
  result = viewFromState(current, final, firstWin);
  screen = "result";
  render();
}

function enter(): void {
  if (!state || screen !== "play" || state.status !== "playing") return;
  const outcome = submitGuess(state, draft);
  if (!outcome.accepted) {
    feedback(ERROR_TEXT[outcome.error ?? "unknown"]);
    return;
  }
  state = outcome.state;
  draft = "";
  renderPlayChrome();
  const message = announceGuess(state);
  if (isFinished(state)) {
    finish();
    return;
  }
  ctx?.audio.select();
  ctx?.haptics.select();
  setStatus(message);
}

async function useHint(): Promise<void> {
  if (!ctx || !state || screen !== "play" || !canHint(state)) return;
  const granted = ctx.ads.enabled ? await ctx.ads.rewarded().show() : true;
  if (!hintGate(ctx.ads.enabled, granted)) {
    feedback("Finish the ad to unlock the hint.");
    return;
  }
  if (!canHint(state)) return;
  state = takeHint(state);
  ctx.analytics.track(EVENTS.hintUsed, { game: "glyph", mode: state.mode, level: state.level });
  ctx.audio.select();
  ctx.haptics.select();
  renderPlayChrome();
  const remaining = GLYPH_MAX_GUESSES - state.guesses.length;
  setStatus(`Hint added. ${remaining} guesses left.`);
}

async function share(): Promise<void> {
  if (!result) return;
  try {
    const nav = navigator as Navigator & { share?: (data: { text: string; title?: string }) => Promise<void> };
    if (typeof nav.share === "function") {
      await nav.share({ title: result.mode === "level" ? `GLYPH Level ${result.level}` : "GLYPH", text: result.share });
      return;
    }
    if (nav.clipboard) {
      await nav.clipboard.writeText(result.share);
      feedback("Result copied to clipboard.", true);
      return;
    }
    feedback("Sharing is not available on this device.");
  } catch {
    feedback("Share cancelled.");
  }
}

function startDailyPlay(): void {
  if (!ctx) return;
  const done = dailyRecordFor(ctx.save, date);
  draft = "";
  result = null;
  if (done) {
    result = viewFromRecord(done);
    ranked = false;
    screen = "result";
    render();
    return;
  }
  state = startDaily(date);
  ranked = true;
  screen = "play";
  render();
  beginTimer();
  ctx.analytics.track(EVENTS.dailyStarted, { game: "glyph" });
}

function startLevelPlay(level: number): void {
  if (!ctx) return;
  state = startLevel(level);
  draft = "";
  ranked = false;
  result = null;
  screen = "play";
  render();
  beginTimer();
}

function goSelect(): void {
  stopTimer();
  state = null;
  result = null;
  draft = "";
  screen = "select";
  render();
}

function startPractice(): void {
  if (!ctx) return;
  const practiceSeed = `${date}:practice:${Date.now()}`;
  state = startDaily(practiceSeed);
  ranked = false;
  draft = "";
  result = null;
  screen = "play";
  render();
  beginTimer();
}

function onClick(e: MouseEvent): void {
  if (!ctx) return;
  const target = (e.target as HTMLElement).closest<HTMLElement>("[data-act], [data-key], [data-level], [data-action]");
  if (!target) return;
  if (target.dataset.action === "hint") {
    void useHint();
    return;
  }
  const key = target.dataset.key;
  if (key) {
    if (key === "enter") enter();
    else if (key === "back") backspace();
    else if (key.length === 1) typeLetter(key);
    return;
  }
  const levelAttr = target.dataset.level;
  if (levelAttr && !target.dataset.act) {
    const level = Number(levelAttr);
    if (ctx && isLevelUnlocked(ctx.save, level)) {
      ctx.audio.tap();
      startLevelPlay(level);
    }
    return;
  }
  const act = target.dataset.act;
  if (act === "arcade") {
    ctx.audio.tap();
    ctx.exit();
  } else if (act === "select") {
    ctx.audio.tap();
    goSelect();
  } else if (act === "daily") {
    ctx.audio.tap();
    startDailyPlay();
  } else if (act === "next" || act === "retry") {
    ctx.audio.tap();
    startLevelPlay(Number(levelAttr));
  } else if (act === "help") {
    ctx.audio.tap();
    helpFrom = screen === "help" ? helpFrom : screen;
    screen = "help";
    render();
  } else if (act === "close-help") {
    ctx.audio.tap();
    screen = helpFrom;
    render();
  } else if (act === "share") {
    ctx.audio.tap();
    void share();
  } else if (act === "practice") {
    ctx.audio.tap();
    startPractice();
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (screen !== "play") return;
  if (e.key === "Enter") {
    e.preventDefault();
    enter();
  } else if (e.key === "Backspace") {
    e.preventDefault();
    backspace();
  } else if (/^[a-zA-Z]$/.test(e.key)) {
    typeLetter(e.key.toLowerCase());
  }
}

function handleBack(): boolean {
  if (screen === "help") {
    screen = helpFrom;
    render();
    return true;
  }
  if (screen === "play" || screen === "result") {
    goSelect();
    return true;
  }
  return false;
}

export function mountGlyph(root: HTMLElement, context: GameContext<GlyphSave>): void {
  app = root;
  ctx = context;
  date = localYmd();
  context.audio.setMuted(context.settings.muted());
  state = null;
  result = null;
  draft = "";
  ranked = false;
  helpFrom = "select";
  screen = "select";
  ac = new AbortController();
  const { signal } = ac;
  app.addEventListener("click", onClick, { signal });
  window.addEventListener("keydown", onKeyDown, { signal });
  setBackHandler(handleBack);
  render();
}

export function unmountGlyph(): void {
  ac?.abort();
  ac = null;
  stopTimer();
  setBackHandler(null);
  state = null;
  result = null;
  draft = "";
  app.innerHTML = "";
}
