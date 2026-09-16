import type { GameContext, MiniGame } from "../../platform/types";
import type { BasicScoreSave } from "../../save/schema";
import { MatrixController } from "./controller";

const meta = {
  id: "matrix" as const,
  name: "CYBER 2048",
  tagline: "Merge the numbers",
  icon: "matrix",
  accent: "#FFD700",
  status: "ready" as const,
  hasGauntlet: false,
};

let controller: MatrixController | null = null;

export default {
  meta,
  mount(root: HTMLElement, ctx: GameContext) {
    controller = new MatrixController();
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
