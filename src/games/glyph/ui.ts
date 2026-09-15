import { localYmd } from "../../gen/daily";
import { setBackHandler } from "../../platform/router";
import { EVENTS } from "../../platform/services/telemetry";
import type { GameContext } from "../../platform/types";
import type { GlyphDailyRecord, GlyphSave } from "../../save/schema";
import {
  GLYPH_MAX_GUESSES,
  MODIFIER_HELP,
  buildRecordShare,
  buildShare,
  dailyConfig,
  dailyRecordFor,
  finalResult,
  isDailyDone,
  isFinished,
  modifierLabel,
  recordGlyphResult,
  starsForGuesses,
  startDaily,
  submitGuess,
  type GlyphState,
  type GuessError,
} from "./logic";
import { announceGuess, boardHtml, cluesHtml, keyboardHtml, modifierBannerHtml } from "./render";

type Screen = "play" | "result" | "help";

interface ResultView {
  won: boolean;
  guesses: number;
  score: number;
  stars: number;
  modifier: string;
  ranked: boolean;
  share: string;
}

const ERROR_TEXT: Record<GuessError, string> = {
  length: "Five letters only.",
  letters: "Letters only, please.",
  unknown: "Not in the word list.",
  finished: "Today's puzzle is done.",
};

let app: HTMLElement;
let ctx: GameContext<GlyphSave> | null = null;
let state: GlyphState | null = null;
let draft = "";
let screen: Screen = "play";
let ranked = false;
let helpFrom: Screen = "play";
let date = "";
let result: ResultView | null = null;
let ac: AbortController | null = null;

function reduced(): boolean {
  return ctx?.settings.reduceMotion() ?? false;
}

function setStatus(message: string): void {
  const el = app.querySelector<HTMLElement>("#glyph-status");
  if (el) el.textContent = message;
}

function renderBoard(): void {
  const board = app.querySelector<HTMLElement>(".glyph-board");
  if (board && state) board.innerHTML = boardHtml(state, draft);
  const banner = app.querySelector<HTMLElement>(".glyph-banner");
  if (banner && state) banner.innerHTML = modifierBannerHtml(state);
  const clues = app.querySelector<HTMLElement>(".glyph-clues-wrap");
  if (clues && state) clues.innerHTML = cluesHtml(state);
}

function renderKeyboard(): void {
  const keyboard = app.querySelector<HTMLElement>(".glyph-keyboard");
  if (keyboard && state) keyboard.innerHTML = keyboardHtml(state);
}

function viewFromState(current: GlyphState, isRanked: boolean): ResultView {
  const final = finalResult(current, ctx?.save.streak ?? 0);
  return {
    won: final.won,
    guesses: final.guesses,
    score: final.score,
    stars: final.stars,
    modifier: final.modifier,
    ranked: isRanked,
    share: buildShare(current, ctx?.save.streak ?? 0),
  };
}

function viewFromRecord(record: GlyphDailyRecord, isRanked: boolean): ResultView {
  return {
    won: record.won,
    guesses: record.guesses,
    score: record.score,
    stars: record.won ? starsForGuesses(record.guesses) : 0,
    modifier: record.modifier,
    ranked: isRanked,
    share: buildRecordShare(date, record),
  };
}

function resultCardHtml(view: ResultView): string {
  const config = dailyConfig(date);
  const title = view.won ? "SOLVED" : "MISSED";
  const stars = view.won ? `${"★".repeat(view.stars)}${"☆".repeat(3 - view.stars)}` : "☆☆☆";
  const badge = view.ranked ? "" : `<div class="glyph-practice">PRACTICE - NO REWARDS</div>`;
  const reveal = view.won ? "" : `<p class="glyph-reveal">The word was <strong>${config.answer.toUpperCase()}</strong>.</p>`;
  return `<div class="overlay">
    <div class="win-card glyph-card">
      <h2>${title}</h2>
      ${badge}
      <div class="stars" aria-label="${view.stars} of 3 stars">${stars}</div>
      <div class="win-meta">${view.guesses}/${GLYPH_MAX_GUESSES} GUESSES · ${view.score} PTS · ${modifierLabel(view.modifier)}</div>
      ${reveal}
      <div class="win-actions">
        <button class="cta-play" data-act="share">Share</button>
        <button class="ghost-btn" data-act="practice">Play again</button>
        <button class="ghost-btn" data-act="help">How to play</button>
        <button class="ghost-btn" data-act="exit">Arcade</button>
      </div>
    </div>
  </div>`;
}

function playHtml(): string {
  if (!state) return "";
  return `<div class="shell glyph-shell${reduced() ? " reduce" : ""}">
    <div class="glyph-top">
      <button class="icon-btn" data-act="exit" aria-label="Back to arcade">‹</button>
      <div class="glyph-head">
        <div class="glyph-word">GLYPH</div>
        <div class="glyph-date">${date} · ${modifierLabel(state.modifier)}</div>
      </div>
      <button class="icon-btn" data-act="help" aria-label="How to play">?</button>
    </div>
    <div class="glyph-banner">${modifierBannerHtml(state)}</div>
    <div class="glyph-board" role="group" aria-label="Guess board">${boardHtml(state, draft)}</div>
    <div class="glyph-clues-wrap">${cluesHtml(state)}</div>
    <div class="glyph-status" id="glyph-status" role="status" aria-live="polite"></div>
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
        <div class="glyph-mod-title">TODAY: ${modifierLabel(modifier)}</div>
        <p>${MODIFIER_HELP[modifier]}</p>
      </div>
      <p class="glyph-dim">One daily puzzle per day. Practising again never grants extra rewards.</p>
      <button class="cta-play" data-act="close-help">Got it</button>
    </div>
  </div>`;
}

function render(): void {
  if (screen === "play") app.innerHTML = playHtml();
  else if (screen === "help") app.innerHTML = helpHtml();
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
  renderBoard();
}

function backspace(): void {
  if (!state || screen !== "play" || state.status !== "playing") return;
  if (draft.length === 0) return;
  draft = draft.slice(0, -1);
  ctx?.audio.tap();
  renderBoard();
}

function finish(): void {
  if (!state || !ctx) return;
  const view = viewFromState(state, ranked);
  if (ranked && !isDailyDone(ctx.save, state.date)) {
    ctx.updateSave(recordGlyphResult(ctx.save, finalResult(state, ctx.save.streak)));
    ctx.report({ score: view.score, stars: view.stars, solved: view.won, stats: { guesses: view.guesses } });
    ctx.analytics.track(view.won ? EVENTS.dailyCompleted : EVENTS.gameFailed, {
      game: "glyph",
      guesses: view.guesses,
    });
    ctx.haptics.success();
    ctx.audio.levelComplete();
  } else {
    ctx.audio.select();
  }
  result = view;
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
  renderBoard();
  renderKeyboard();
  const message = announceGuess(state);
  if (isFinished(state)) {
    finish();
    return;
  }
  ctx?.audio.select();
  ctx?.haptics.select();
  setStatus(message);
}

async function share(): Promise<void> {
  if (!result) return;
  try {
    const nav = navigator as Navigator & { share?: (data: { text: string; title?: string }) => Promise<void> };
    if (typeof nav.share === "function") {
      await nav.share({ title: "GLYPH", text: result.share });
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

function startPractice(): void {
  if (!ctx) return;
  state = startDaily(date);
  draft = "";
  ranked = false;
  result = null;
  screen = "play";
  render();
}

function onClick(e: MouseEvent): void {
  if (!ctx) return;
  const target = (e.target as HTMLElement).closest<HTMLElement>("[data-act], [data-key]");
  if (!target) return;
  const key = target.dataset.key;
  if (key) {
    if (key === "enter") enter();
    else if (key === "back") backspace();
    else if (key.length === 1) typeLetter(key);
    return;
  }
  const act = target.dataset.act;
  if (act === "exit") {
    ctx.audio.tap();
    ctx.exit();
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
  return false;
}

export function mountGlyph(root: HTMLElement, context: GameContext<GlyphSave>): void {
  app = root;
  ctx = context;
  date = localYmd();
  context.audio.setMuted(context.settings.muted());
  const done = dailyRecordFor(context.save, date);
  if (done) {
    ranked = false;
    result = viewFromRecord(done, false);
    screen = "result";
  } else {
    state = startDaily(date);
    ranked = true;
    screen = "play";
    context.analytics.track(EVENTS.dailyStarted, { game: "glyph" });
  }
  draft = "";
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
  setBackHandler(null);
  state = null;
  result = null;
  draft = "";
  app.innerHTML = "";
}
