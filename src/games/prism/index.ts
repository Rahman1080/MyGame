import type { GameContext, MiniGame } from "../../platform/types";
import type { PrismSave } from "../../save/schema";
import { mountPrism, unmountPrism } from "./ui";

const meta = {
  id: "prism" as const,
  name: "PRISM",
  tagline: "Sort the spectrum",
  icon: "tube",
  accent: "#FFC857",
  status: "ready" as const,
  hasGauntlet: true,
};

export default {
  meta,
  mount(root: HTMLElement, ctx: GameContext) {
    mountPrism(root, ctx as GameContext<PrismSave>);
  },
  unmount() {
    unmountPrism();
  },
  daily(seed: string) {
    return { seed };
  },
} satisfies MiniGame;
