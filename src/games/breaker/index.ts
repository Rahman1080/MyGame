import type { GameContext, MiniGame } from "../../platform/types";
import type { BasicScoreSave } from "../../save/schema";
import { BreakerController } from "./controller";

const meta = {
  id: "breaker" as const,
  name: "NEON BREAKER",
  tagline: "Laser brick breaker",
  icon: "breaker",
  accent: "#FF007F",
  status: "ready" as const,
  hasGauntlet: false,
};

let controller: BreakerController | null = null;

export default {
  meta,
  mount(root: HTMLElement, ctx: GameContext) {
    controller = new BreakerController();
    const saveSlice = (ctx.save ?? { best: 0 }) as BasicScoreSave;
    controller.mountArcade(
      root,
      () => ctx.exit(),
      saveSlice,
      (updated) => {
        ctx.updateSave(updated);
      },
      (saved) => {
        ctx.report({ score: saved.best });
      },
    );
  },
  unmount() {
    controller?.destroy();
    controller = null;
  },
  daily(seed: string) {
    return { seed };
  },
} satisfies MiniGame;
