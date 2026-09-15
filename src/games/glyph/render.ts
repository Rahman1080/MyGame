import { GLYPH_MAX_GUESSES, keyboardState, MODIFIER_HELP, MODIFIER_LABELS, type GlyphState, type TileMark } from "./logic";

export const KEYBOARD_ROWS: readonly (readonly string[])[] = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["enter", "z", "x", "c", "v", "b", "n", "m", "back"],
];

const SYMBOL: Record<TileMark, string> = { correct: "✓", present: "~", absent: "·" };
const MARK_WORD: Record<TileMark, string> = { correct: "correct", present: "present", absent: "absent" };

function tile(letter: string, mark: TileMark | null): string {
  const stateClass = mark ?? "empty";
  const label = letter.length > 0 && mark ? `${letter.toUpperCase()} ${MARK_WORD[mark]}` : "empty";
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
      const label = mark ? `${key.toUpperCase()}, ${MARK_WORD[mark]}` : key.toUpperCase();
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
  if (!last) return "";
  const correct = last.marks.filter((m) => m === "correct").length;
  const present = last.marks.filter((m) => m === "present").length;
  const absent = last.marks.filter((m) => m === "absent").length;
  const base = `${last.word.toUpperCase()}: ${correct} correct, ${present} present, ${absent} absent.`;
  if (state.status === "won") return `${base} Solved in ${state.guesses.length} of ${state.maxGuesses}.`;
  if (state.status === "lost") return `${base} Out of guesses. The word was ${state.answer.toUpperCase()}.`;
  return `${base} ${GLYPH_MAX_GUESSES - state.guesses.length} guesses left.`;
}
