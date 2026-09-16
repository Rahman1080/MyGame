import type { GameContext, MiniGame } from "../../platform/types";
import type { BasicScoreSave } from "../../save/schema";
import { MeowdokuController } from "./controller";

const meta = {
  id: "meowdoku" as const,
  name: "MEOWDOKU",
  tagline: "Cats logic puzzle",
  icon: "meowdoku",
  accent: "#FF4081",
  status: "ready" as const,
  hasGauntlet: false,
};

let controller: MeowdokuController | null = null;

export default {
  meta,
  mount(root: HTMLElement, ctx: GameContext) {
    controller = new MeowdokuController();
    const saveSlice = (ctx.save ?? { best: 0 }) as BasicScoreSave;
    controller.mountArcade(root, () => ctx.exit(), saveSlice, (updated) => {
      ctx.updateSave(updated);
      ctx.report({ score: updated.best });
    });
  },
  unmount() {
    controller?.destroy();
    controller = null;
  },
  daily(seed: string) {
    return { seed };
  },
} satisfies MiniGame;
