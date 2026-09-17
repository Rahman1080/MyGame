import type { GameContext, MiniGame } from "../../platform/types";
import type { BasicScoreSave } from "../../save/schema";
import { SnakeController } from "./controller";

const meta = {
  id: "snake" as const,
  name: "CYBER SNAKE",
  tagline: "Neon trail & combos",
  icon: "snake",
  accent: "#00F2FF",
  status: "ready" as const,
  hasGauntlet: false,
};

let controller: SnakeController | null = null;

export default {
  meta,
  mount(root: HTMLElement, ctx: GameContext) {
    controller = new SnakeController();
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
