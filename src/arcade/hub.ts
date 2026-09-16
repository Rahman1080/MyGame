import type { SaveData } from "../save/schema";
import type { ArcadeGameMeta } from "./types";
import { ICON_MUTE, ICON_UNMUTE, ICON_FLAME } from "../ui/icons";

export const ARCADE_GAMES: ArcadeGameMeta[] = [
  {
    id: "glowtrail",
    title: "GLOWTRAIL",
    tagline: "Rotate arrows, collect nodes, escape.",
    badge: "120 LEVELS",
    accentColor: "#29DDF4",
    glowColor: "rgba(41, 221, 244, 0.4)",
    iconSvg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    controls: "Tap to rotate · Press launch",
    description: "The flagship neon path puzzle. Complete 120 hand-tuned levels or endless procedurally generated boards.",
  },
  {
    id: "snake",
    title: "CYBER SNAKE",
    tagline: "Neon trail, combos & power orbs.",
    badge: "ACTION",
    accentColor: "#00F2FF",
    glowColor: "rgba(0, 242, 255, 0.4)",
    iconSvg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12"/><path d="M12 6v6l4 2"/></svg>`,
    controls: "Swipe / Arrows · Collect orbs",
    description: "High-speed cyber snake with combo multipliers, phase warping, slow-motion, and energy overcharge.",
  },
  {
    id: "breaker",
    title: "NEON BREAKER",
    tagline: "Laser brick breaker with multiball.",
    badge: "ARCADE",
    accentColor: "#FF007F",
    glowColor: "rgba(255, 0, 127, 0.4)",
    iconSvg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    controls: "Drag paddle · Space / Tap to shoot",
    description: "Shatter neon bricks across progressive waves. Catch multiball, paddle wideners, and laser blaster capsules.",
  },
  {
    id: "matrix",
    title: "CYBER 2048",
    tagline: "Synthesize neon tiles to quantum 2048.",
    badge: "LOGIC",
    accentColor: "#FFD700",
    glowColor: "rgba(255, 215, 0, 0.4)",
    iconSvg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`,
    controls: "Swipe / Arrows · Undo support",
    description: "Slide and merge matching neon energy tiles. Features 1-step undo, smooth tactile response, and endless high scoring.",
  },
];

export function arcadeHubHtml(save: SaveData, totalStars: number): string {
  const snakeHigh = save.arcadeHighScores?.["snake"] ?? 0;
  const breakerHigh = save.arcadeHighScores?.["breaker"] ?? 0;
  const matrixHigh = save.arcadeHighScores?.["matrix"] ?? 0;

  const cardsHtml = ARCADE_GAMES.map((game) => {
    let statLine = "";
    if (game.id === "glowtrail") {
      statLine = `★ ${totalStars} STARS · 120 LEVELS`;
    } else if (game.id === "snake") {
      statLine = `BEST SCORE: ${snakeHigh}`;
    } else if (game.id === "breaker") {
      statLine = `BEST SCORE: ${breakerHigh}`;
    } else if (game.id === "matrix") {
      statLine = `BEST SCORE: ${matrixHigh}`;
    }

    return `
      <div class="arcade-card" data-act="launch-game" data-game="${game.id}" style="--accent: ${game.accentColor}; --glow: ${game.glowColor};">
        <div class="arcade-card-top">
          <span class="arcade-badge">${game.badge}</span>
          <span class="arcade-stat">${statLine}</span>
        </div>
        <div class="arcade-card-body">
          <div class="arcade-icon-wrap" aria-hidden="true">${game.iconSvg}</div>
          <div class="arcade-card-info">
            <h3 class="arcade-card-title">${game.title}</h3>
            <p class="arcade-card-tagline">${game.tagline}</p>
          </div>
          <span class="continue-arrow" aria-hidden="true">›</span>
        </div>
        <div class="arcade-card-controls">
          <span>${game.controls}</span>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="shell enter">
      <div class="home">
        <div class="home-top">
          <div class="wordmark" style="letter-spacing: 0.18em; font-size: 1.3rem;">NEON ARCADE</div>
          <button class="icon-btn sm" data-act="mute" aria-label="${save.muted ? "Unmute" : "Mute"}">
            ${save.muted ? ICON_UNMUTE : ICON_MUTE}
          </button>
        </div>

        <div class="home-stats">
          <span class="stat"><span class="stat-star">★</span>${totalStars} STARS</span>
          <span class="stat amber">${ICON_FLAME}${save.streak} DAY STREAK</span>
          <span class="stat" style="color: #00F2FF;">4 GAMES</span>
        </div>

        <div class="arcade-grid" style="display: flex; flex-direction: column; gap: 12px; margin-top: 6px;">
          ${cardsHtml}
        </div>
      </div>
    </div>
  `;
}
