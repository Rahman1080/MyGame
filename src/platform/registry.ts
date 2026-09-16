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
      thumbnail: "/fusion-thumb.jpg",
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
      thumbnail: "/prism-thumb.jpg",
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
      thumbnail: "/glyph-thumb.jpg",
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
      thumbnail: "/blocks-thumb.jpg",
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
      thumbnail: "/arrows-thumb.jpg",
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
      thumbnail: "/snake-thumb.jpg",
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
      thumbnail: "/breaker-thumb.jpg",
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
      thumbnail: "/matrix-thumb.jpg",
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
      thumbnail: "/wordsearch-thumb.jpg",
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
      thumbnail: "/wordconnect-thumb.jpg",
      accent: "#FF9900",
      status: "ready",
      hasGauntlet: false,
    },
    load: () => import("../games/wordconnect"),
  },
  {
    meta: {
      id: "meowdoku",
      name: "MEOWDOKU",
      tagline: "Cats logic puzzle",
      icon: "meowdoku",
      thumbnail: "/meowdoku-thumb.jpg",
      accent: "#FF4081",
      status: "ready",
      hasGauntlet: false,
    },
    load: () => import("../games/meowdoku"),
  },
];

export function findGame(id: string): GameDescriptor | undefined {
  return GAMES.find((g) => g.meta.id === id);
}

export function isGameId(id: string): id is GameId {
  return GAMES.some((g) => g.meta.id === id);
}
