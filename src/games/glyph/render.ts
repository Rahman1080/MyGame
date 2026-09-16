import {
  GLYPH_LEVELS,
  GLYPH_MAX_GUESSES,
  canHint,
  keyboardState,
  levelTier,
  isLevelUnlocked,
  MODIFIER_HELP,
  MODIFIER_LABELS,
  type GlyphState,
  type KeyMark,
  type TileMark,
} from "./logic";
import { formatClock, TIER_LABELS, tierRanges } from "../../platform/levels";
import type { GlyphSave } from "../../save/schema";
import { ICON_LOCK } from "../../ui/icons";

export const KEYBOARD_ROWS: readonly (readonly string[])[] = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["enter", "z", "x", "c", "v", "b", "n", "m", "back"],
];

const SYMBOL: Record<TileMark, string> = { correct: "✓", present: "~", absent: "·" };
const MARK_WORD: Record<TileMark, string> = { correct: "correct", present: "present", absent: "absent" };
const KEY_WORD: Record<KeyMark, string> = { ...MARK_WORD, hint: "in the word" };

function tile(letter: string, mark: TileMark | null): string {
  const hasLetter = letter.length > 0;
  const stateClass = mark ?? (hasLetter ? "draft" : "empty");
  const label = hasLetter
    ? mark
      ? `${letter.toUpperCase()} ${MARK_WORD[mark]}`
      : `${letter.toUpperCase()} pending`
    : "empty";
  const glyph = mark ? SYMBOL[mark] : "";
  return `<div class="glyph-tile ${stateClass}" role="img" aria-label="${label}"><span class="glyph-letter">${letter.toUpperCase()}</span><span class="glyph-mark" aria-hidden="true">${glyph}</span></div>`;
}

export function boardHtml(state: GlyphState, draft: string): string {
  const rows: string[] = [];
  for (let r = 0; r < state.maxGuesses; r += 1) {
    const guess = state.guesses[r];
    const tiles: string[] = [];
    for (let c = 0; c < 5; c += 1) {
      if (guess) {
        tiles.push(tile(guess.word[c] ?? "", guess.marks[c] ?? "absent"));
      } else if (r === state.guesses.length && state.status === "playing") {
        tiles.push(tile(draft[c] ?? "", null));
      } else {
        tiles.push(tile("", null));
      }
    }
    const current = r === state.guesses.length && state.status === "playing" ? " current" : "";
    rows.push(`<div class="glyph-row${current}" role="group" aria-label="Row ${r + 1}">${tiles.join("")}</div>`);
  }
  return rows.join("");
}

export function keyboardHtml(state: GlyphState): string {
  const marks = keyboardState(state);
  const rows = KEYBOARD_ROWS.map((row) => {
    const keys = row.map((key) => {
      if (key === "enter" || key === "back") {
        const label = key === "enter" ? "Submit guess" : "Delete letter";
        const text = key === "enter" ? "ENTER" : "DEL";
        return `<button type="button" class="glyph-key wide" data-key="${key}" aria-label="${label}">${text}</button>`;
      }
      const mark = marks[key];
      const cls = mark ? ` ${mark}` : "";
      const label = mark ? `${key.toUpperCase()}, ${KEY_WORD[mark]}` : key.toUpperCase();
      return `<button type="button" class="glyph-key${cls}" data-key="${key}" aria-label="${label}">${key.toUpperCase()}</button>`;
    });
    return `<div class="glyph-keyrow">${keys.join("")}</div>`;
  });
  return rows.join("");
}

export function modifierBannerHtml(state: GlyphState): string {
  const label = MODIFIER_LABELS[state.modifier];
  const parts: string[] = [`<span class="glyph-mod-name">${label}</span>`];
  if (state.modifier === "category" && state.categoryRevealed) {
    parts.push(`<span class="glyph-mod-note">${state.category.toUpperCase()}</span>`);
  } else if (state.modifier === "energy") {
    parts.push(`<span class="glyph-mod-note">ENERGY ${state.energy}</span>`);
  } else if (state.modifier === "double" && state.doubleHit) {
    parts.push(`<span class="glyph-mod-note">PAIR MATCHED</span>`);
  }
  return parts.join("");
}

export function modifierHelpHtml(state: GlyphState): string {
  return `<p class="glyph-mod-help">${MODIFIER_HELP[state.modifier]}</p>`;
}

export function cluesHtml(state: GlyphState): string {
  if (state.clues.length === 0) return "";
  const items = state.clues
    .map((clue) => `<span class="glyph-clue">${clue.index + 1}: ${clue.letter.toUpperCase()}</span>`)
    .join("");
  return `<div class="glyph-clues" aria-label="Revealed clues">${items}</div>`;
}

export function announceGuess(state: GlyphState): string {
  const last = state.guesses[state.guesses.length - 1];
  if (!last) {
    return state.timedOut ? `Time ran out. The word was ${state.answer.toUpperCase()}.` : "";
  }
  const correct = last.marks.filter((m) => m === "correct").length;
  const present = last.marks.filter((m) => m === "present").length;
  const absent = last.marks.filter((m) => m === "absent").length;
  const base = `${last.word.toUpperCase()}: ${correct} correct, ${present} present, ${absent} absent.`;
  if (state.status === "won") return `${base} Solved in ${state.guesses.length} of ${state.maxGuesses}.`;
  if (state.status === "lost") {
    return state.timedOut
      ? `${base} Time ran out. The word was ${state.answer.toUpperCase()}.`
      : `${base} Out of guesses. The word was ${state.answer.toUpperCase()}.`;
  }
  return `${base} ${GLYPH_MAX_GUESSES - state.guesses.length} guesses left.`;
}

export function hintChipsHtml(state: GlyphState): string {
  if (state.hinted.length === 0) return "";
  const chips = state.hinted
    .map((letter) => `<span class="glyph-hint-chip">${letter.toUpperCase()}</span>`)
    .join("");
  return `<div class="glyph-hint-row" aria-label="Letters in the word"><span class="glyph-hint-label">IN THE WORD</span>${chips}</div>`;
}

export function hintButtonHtml(state: GlyphState): string {
  const available = canHint(state);
  const label = state.hinted.length === 0 ? "HINT" : `HINT ${state.hinted.length}`;
  return `<button type="button" class="glyph-hint-btn" data-action="hint"${available ? "" : " disabled"} aria-label="Reveal a letter that is in the word">${label}</button>`;
}

export function timerHtml(state: GlyphState, msLeft: number): string {
  if (state.timeLimitMs <= 0) return "";
  const ratio = Math.max(0, Math.min(1, msLeft / state.timeLimitMs));
  const low = ratio <= 0.25 ? " low" : "";
  return [
    `<div class="glyph-timer${low}" role="timer" aria-label="Time left ${formatClock(msLeft)}">`,
    `<div class="glyph-timer-bar"><span style="width:${Math.round(ratio * 100)}%"></span></div>`,
    `<span class="glyph-timer-clock">${formatClock(msLeft)}</span>`,
    `</div>`,
  ].join("");
}

export function levelHeaderHtml(state: GlyphState): string {
  if (state.mode !== "level") return "";
  return [
    `<div class="glyph-level-head">`,
    `<span class="glyph-level-tag">LEVEL ${state.level}</span>`,
    `<span class="glyph-tier-tag">${TIER_LABELS[levelTier(state.level)]}</span>`,
    `</div>`,
  ].join("");
}

function starDots(stars: number): string {
  const cells = [0, 1, 2].map((i) => `<i class="${i < stars ? "on" : ""}"></i>`).join("");
  return `<span class="glyph-level-stars" aria-hidden="true">${cells}</span>`;
}

function levelTileHtml(save: GlyphSave, level: number): string {
  const record = save.levels[String(level)];
  const solved = record?.won === true;
  const unlocked = isLevelUnlocked(save, level);
  const classes = ["glyph-level-tile"];
  if (solved) classes.push("solved");
  if (!unlocked) classes.push("locked");
  const tier = TIER_LABELS[levelTier(level)];
  const stars = record?.stars ?? 0;
  const hintsUsed = record?.hints ?? 0;
  const best = record?.best ?? 0;
  const label = solved
    ? `Level ${level}, ${tier}, solved, ${stars} stars, best ${best} points${hintsUsed > 0 ? `, ${hintsUsed} hints used` : ""}`
    : unlocked
      ? `Level ${level}, ${tier}, unlocked`
      : `Level ${level}, ${tier}, locked`;
  const inner = unlocked
    ? `<span class="glyph-level-num">${level}</span>${solved ? starDots(stars) : ""}`
    : `<span class="glyph-level-lock">${ICON_LOCK}</span>`;
  const disabled = unlocked ? "" : " disabled";
  return `<button type="button" class="${classes.join(" ")}" data-level="${level}"${disabled} aria-label="${label}">${inner}</button>`;
}

export function levelGridHtml(save: GlyphSave): string {
  const sections = tierRanges(GLYPH_LEVELS).map((range) => {
    const tiles: string[] = [];
    for (let level = range.from; level <= range.to; level += 1) tiles.push(levelTileHtml(save, level));
    return [
      `<section class="glyph-tier" aria-label="${TIER_LABELS[range.tier]} tier">`,
      `<h3 class="glyph-tier-name">${TIER_LABELS[range.tier]}</h3>`,
      `<div class="glyph-level-grid">${tiles.join("")}</div>`,
      `</section>`,
    ].join("");
  });
  return `<div class="glyph-levels">${sections.join("")}</div>`;
}
