import type { GameContext, MiniGame } from "../../platform/types";
import type { FusionSave } from "../../save/schema";
import { mountFusion, unmountFusion } from "./ui";

const meta = {
  id: "fusion" as const,
  name: "FUSION",
  tagline: "Merge the glow",
  icon: "orb",
  accent: "#E45CFF",
  status: "ready" as const,
  hasGauntlet: true,
};

export default {
  meta,
  mount(root: HTMLElement, ctx: GameContext) {
    mountFusion(root, ctx as GameContext<FusionSave>);
  },
  unmount() {
    unmountFusion();
  },
  daily(seed: string) {
    return { seed };
  },
} satisfies MiniGame;
