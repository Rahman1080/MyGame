import type { GameContext, MiniGame } from "../../platform/types";
import type { BasicScoreSave } from "../../save/schema";
import { WordSearchController } from "./controller";

const meta = {
  id: "wordsearch" as const,
  name: "NEON WORD SEARCH",
  tagline: "Find hidden words",
  icon: "wordsearch",
  accent: "#00FFA3",
  status: "ready" as const,
  hasGauntlet: false,
};

let activeController: WordSearchController | null = null;

export default {
  meta,
  mount(root: HTMLElement, ctx: GameContext) {
    activeController = new WordSearchController();
    const saveSlice = (ctx.save ?? { best: 0 }) as BasicScoreSave;

    activeController.mountArcade(
      root,
      () => ctx.exit(),
      saveSlice,
      (updated) => {
        ctx.updateSave(updated);
        ctx.report({ score: updated.best });
      },
    );
  },
  unmount() {
    activeController?.destroy();
    activeController = null;
  },
  daily(seed: string) {
    return { seed };
  },
} satisfies MiniGame;
