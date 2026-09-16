import type { GameId, GameMeta, MiniGame } from "./types";

export interface GameDescriptor {
  meta: GameMeta;
  load?: () => Promise<{ default: MiniGame }>;
}

export const GAMES: GameDescriptor[] = [
  {
    meta: {
      id: "glowtrail",
      name: "GLOWTRAIL",
      tagline: "Rotate, launch, escape",
      icon: "trail",
      thumbnail: "/glowtrail-thumb.jpg",
      accent: "#29DDF4",
      status: "ready",
      hasGauntlet: true,
    },
    load: () => import("../games/glowtrail"),
  },
  {
    meta: {
      id: "fusion",
      name: "FUSION",
      tagline: "Merge the glow",
      icon: "orb",
      accent: "#E45CFF",
      status: "ready",
      hasGauntlet: true,
    },
    load: () => import("../games/fusion"),
  },
  {
    meta: {
      id: "prism",
      name: "PRISM",
      tagline: "Sort the spectrum",
      icon: "tube",
      accent: "#FFC857",
      status: "ready",
      hasGauntlet: true,
    },
    load: () => import("../games/prism"),
  },
  {
    meta: {
      id: "glyph",
      name: "GLYPH",
      tagline: "One word a day",
      icon: "glyph",
      accent: "#9CFF4F",
      status: "ready",
      hasGauntlet: false,
    },
    load: () => import("../games/glyph"),
  },
  {
    meta: {
      id: "blocks",
      name: "NEON BLOCKS",
      tagline: "Block Puzzle",
      icon: "blocks",
      accent: "#7C6BFF",
      status: "ready",
      hasGauntlet: false,
    },
    load: () => import("../games/blocks"),
  },
  {
    meta: {
      id: "arrows",
      name: "NEON ARROWS",
      tagline: "Arrow Escape",
      icon: "arrows",
      accent: "#4FC3FF",
      status: "ready",
      hasGauntlet: false,
    },
    load: () => import("../games/arrows"),
  },
  {
    meta: {
      id: "snake",
      name: "CYBER SNAKE",
      tagline: "Neon trail & combos",
      icon: "snake",
      accent: "#00F2FF",
      status: "ready",
      hasGauntlet: false,
    },
    load: () => import("../games/snake"),
  },
  {
    meta: {
      id: "breaker",
      name: "NEON BREAKER",
      tagline: "Laser brick breaker",
      icon: "breaker",
      accent: "#FF007F",
      status: "ready",
      hasGauntlet: false,
    },
    load: () => import("../games/breaker"),
  },
  {
    meta: {
      id: "matrix",
      name: "CYBER 2048",
      tagline: "Merge the numbers",
      icon: "matrix",
      accent: "#FFD700",
      status: "ready",
      hasGauntlet: false,
    },
    load: () => import("../games/matrix"),
  },
  {
    meta: {
      id: "wordsearch",
      name: "NEON WORD SEARCH",
      tagline: "Find hidden words",
      icon: "wordsearch",
      accent: "#00FFA3",
      status: "ready",
      hasGauntlet: false,
    },
    load: () => import("../games/wordsearch"),
  },
  {
    meta: {
      id: "wordconnect",
      name: "NEON WORD CONNECT",
      tagline: "Swipe & connect anagrams",
      icon: "wordconnect",
      accent: "#FF9900",
      status: "ready",
      hasGauntlet: false,
    },
    load: () => import("../games/wordconnect"),
  },
];

export function findGame(id: string): GameDescriptor | undefined {
  return GAMES.find((g) => g.meta.id === id);
}

export function isGameId(id: string): id is GameId {
  return GAMES.some((g) => g.meta.id === id);
}
