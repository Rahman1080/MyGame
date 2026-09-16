import type { GameContext, MiniGame } from "../../platform/types";
import type { GlyphSave } from "../../save/schema";
import { mountGlyph, unmountGlyph } from "./ui";

const DAILY_PREFIX = "daily:glyph:";

const meta = {
  id: "glyph" as const,
  name: "GLYPH",
  tagline: "One word a day",
  icon: "glyph",
  accent: "#9CFF4F",
  status: "ready" as const,
  hasGauntlet: false,
};

export default {
  meta,
  mount(root: HTMLElement, ctx: GameContext) {
    mountGlyph(root, ctx as GameContext<GlyphSave>);
  },
  unmount() {
    unmountGlyph();
  },
  daily(seed: string) {
    const date = seed.startsWith(DAILY_PREFIX) ? seed.slice(DAILY_PREFIX.length) : seed;
    return { date, seed };
  },
} satisfies MiniGame;
