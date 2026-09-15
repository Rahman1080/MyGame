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
      status: "soon",
      hasGauntlet: false,
    },
  },
];

export function findGame(id: string): GameDescriptor | undefined {
  return GAMES.find((g) => g.meta.id === id);
}

export function isGameId(id: string): id is GameId {
  return GAMES.some((g) => g.meta.id === id);
}
