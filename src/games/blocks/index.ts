import type { GameContext, MiniGame } from "../../platform/types";
import type { BlocksSave } from "../../save/schema";
import { mountBlocks, unmountBlocks } from "./ui";

const DAILY_PREFIX = "daily:blocks:";

const meta = {
  id: "blocks" as const,
  name: "NEON BLOCKS",
  tagline: "Block Puzzle",
  icon: "blocks",
  accent: "#7C6BFF",
  status: "ready" as const,
  hasGauntlet: false,
};

export default {
  meta,
  mount(root: HTMLElement, ctx: GameContext) {
    mountBlocks(root, ctx as GameContext<BlocksSave>);
  },
  unmount() {
    unmountBlocks();
  },
  daily(seed: string) {
    const date = seed.startsWith(DAILY_PREFIX) ? seed.slice(DAILY_PREFIX.length) : seed;
    return { date, seed };
  },
} satisfies MiniGame;
