import type { GameContext, MiniGame } from "../../platform/types";
import type { ArrowsSave } from "../../save/schema";
import { mountArrows, unmountArrows } from "./ui";

const DAILY_PREFIX = "daily:arrows:";

const meta = {
  id: "arrows" as const,
  name: "NEON ARROWS",
  tagline: "Steer the beam",
  icon: "arrows",
  accent: "#4FC3FF",
  status: "ready" as const,
  hasGauntlet: false,
};

export default {
  meta,
  mount(root: HTMLElement, ctx: GameContext) {
    mountArrows(root, ctx as GameContext<ArrowsSave>);
  },
  unmount() {
    unmountArrows();
  },
  daily(seed: string) {
    const date = seed.startsWith(DAILY_PREFIX) ? seed.slice(DAILY_PREFIX.length) : seed;
    return { date, seed };
  },
} satisfies MiniGame;
