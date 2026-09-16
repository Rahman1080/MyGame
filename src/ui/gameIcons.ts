import type { GameId } from "../platform/types";

const GAME_ICONS: Record<GameId | string, string> = {
  glowtrail: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 24 C 9 27, 15 25, 18 19 C 21 13, 20 6, 26 5" /><circle cx="26" cy="5" r="3" fill="currentColor" /><circle cx="17" cy="17" r="1.8" fill="currentColor" opacity="0.8" /><circle cx="9" cy="24" r="1.2" fill="currentColor" opacity="0.5" /></svg>`,

  fusion: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="16" r="8" stroke="currentColor" opacity="0.7" /><circle cx="20" cy="16" r="8" stroke="currentColor" /><path d="M16 10 C 18.5 12.5, 18.5 19.5, 16 22" stroke="currentColor" stroke-width="2.2" /><circle cx="16" cy="16" r="2.8" fill="currentColor" /></svg>`,

  prism: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 6 L7 22 A4.5 4.5 0 0 0 16 22 L16 6" /><line x1="5" y1="6" x2="18" y2="6" stroke-width="2.5" /><path d="M7 16 L16 16" stroke="currentColor" opacity="0.6" /><circle cx="11.5" cy="20" r="1.5" fill="currentColor" /><path d="M21 10 L21 23 A3.5 3.5 0 0 0 28 23 L28 10" opacity="0.6" /><line x1="19.5" y1="10" x2="29.5" y2="10" opacity="0.6" stroke-width="2" /></svg>`,

  glyph: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="10.5" height="10.5" rx="2.5" fill="currentColor" fill-opacity="0.28" /><rect x="17.5" y="4" width="10.5" height="10.5" rx="2.5" /><rect x="4" y="17.5" width="10.5" height="10.5" rx="2.5" /><rect x="17.5" y="17.5" width="10.5" height="10.5" rx="2.5" fill="currentColor" fill-opacity="0.55" /><path d="M7 9.5 L9.5 12 L13 6.5" stroke="currentColor" stroke-width="2" /></svg>`,

  blocks: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="9" height="9" rx="2" /><rect x="14" y="5" width="9" height="9" rx="2" /><rect x="14" y="14" width="9" height="9" rx="2" fill="currentColor" fill-opacity="0.35" /><rect x="23" y="14" width="9" height="9" rx="2" /></svg>`,

  arrows: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="26" x2="24" y2="8" /><polyline points="14 8 24 8 24 18" /><circle cx="6" cy="26" r="2.2" fill="currentColor" /><line x1="12" y1="20" x2="16" y2="24" opacity="0.6" stroke-dasharray="2 2" /></svg>`,

  snake: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M26 12 C 26 7, 21 5, 16 5 C 11 5, 8 8, 8 13 C 8 18, 15 18, 15 22 C 15 26, 11 27, 6 25" /><circle cx="22.5" cy="8.5" r="1.5" fill="currentColor" /><circle cx="28" cy="18" r="2.2" fill="currentColor" /></svg>`,

  breaker: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="6.5" height="4" rx="1" fill="currentColor" fill-opacity="0.3" /><rect x="12.8" y="5" width="6.5" height="4" rx="1" /><rect x="21.5" y="5" width="6.5" height="4" rx="1" fill="currentColor" fill-opacity="0.3" /><line x1="11" y1="22" x2="17.5" y2="13.5" stroke-dasharray="2 3" opacity="0.6" /><circle cx="17.5" cy="13.5" r="2.5" fill="currentColor" /><rect x="6" y="24" width="20" height="4" rx="2" fill="currentColor" fill-opacity="0.45" /></svg>`,

  matrix: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="24" height="24" rx="4" /><line x1="16" y1="4" x2="16" y2="28" opacity="0.35" /><line x1="4" y1="16" x2="28" y2="16" opacity="0.35" /><rect x="5.5" y="5.5" width="9" height="9" rx="2" fill="currentColor" fill-opacity="0.25" /><rect x="17.5" y="17.5" width="9" height="9" rx="2" fill="currentColor" fill-opacity="0.55" /></svg>`,

  wordsearch: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3" stroke-dasharray="3 3" opacity="0.45" /><line x1="7" y1="7" x2="17" y2="17" stroke-width="2.5" /><circle cx="21" cy="14" r="5.5" /><line x1="25" y1="18" x2="28.5" y2="21.5" stroke-width="2.5" /></svg>`,

  wordconnect: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="7" r="3.5" fill="currentColor" fill-opacity="0.3" /><circle cx="25" cy="16" r="3.5" fill="currentColor" fill-opacity="0.3" /><circle cx="7" cy="16" r="3.5" fill="currentColor" fill-opacity="0.3" /><circle cx="16" cy="25" r="3.5" fill="currentColor" fill-opacity="0.55" /><path d="M16 7 L25 16 L16 25" stroke-width="2" /></svg>`,

  meowdoku: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 24 C 6 20, 5 15, 6 11 L10 14 C 13 13, 19 13, 22 14 L26 11 C 27 15, 26 20, 24 24 C 20 27, 12 27, 8 24 Z" fill="currentColor" fill-opacity="0.25" /><circle cx="12" cy="18" r="1.5" fill="currentColor" /><circle cx="20" cy="18" r="1.5" fill="currentColor" /><path d="M15 21 L16 22 L17 21" stroke-width="1.8" /><line x1="10" y1="19" x2="6" y2="18.5" opacity="0.6" /><line x1="22" y1="19" x2="26" y2="18.5" opacity="0.6" /></svg>`,
};

export function getGameIcon(gameId: GameId | string): string {
  return GAME_ICONS[gameId] ?? GAME_ICONS.glowtrail!;
}
