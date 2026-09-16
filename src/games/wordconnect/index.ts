import type { GameContext, MiniGame } from "../../platform/types";
import type { BasicScoreSave } from "../../save/schema";
import { WordConnectController } from "./controller";

const meta = {
  id: "wordconnect" as const,
  name: "NEON WORD CONNECT",
  tagline: "Swipe & connect anagrams",
  icon: "wordconnect",
  accent: "#FF9900",
  status: "ready" as const,
  hasGauntlet: false,
};

let activeController: WordConnectController | null = null;

export default {
  meta,
  mount(root: HTMLElement, ctx: GameContext) {
    activeController = new WordConnectController();
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
