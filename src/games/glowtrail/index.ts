import type { GameContext, MiniGame } from "../../platform/types";
import { mountGlowtrail, unmountGlowtrail } from "./ui";

const meta = {
  id: "glowtrail" as const,
  name: "GLOWTRAIL",
  tagline: "Rotate, launch, escape",
  icon: "trail",
  accent: "#29DDF4",
  status: "ready" as const,
  hasGauntlet: true,
};

export default {
  meta,
  mount(root: HTMLElement, ctx: GameContext) {
    mountGlowtrail(root, ctx);
  },
  unmount() {
    unmountGlowtrail();
  },
  daily(seed: string) {
    return { seed };
  },
} satisfies MiniGame;
