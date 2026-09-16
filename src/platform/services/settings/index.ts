import type { SaveV2 } from "../../../save/schema";
import type { SettingsService } from "../../types";

export function createSettings(getSave: () => SaveV2, setSave: (s: SaveV2) => void): SettingsService {
  return {
    muted: () => getSave().profile.muted,
    setMuted(v: boolean) {
      const s = getSave();
      s.profile.muted = v;
      setSave(s);
    },
    reduceMotion: () => {
      const pref = getSave().profile.reduceMotion;
      if (pref === "on") return true;
      if (pref === "off") return false;
      return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    },
    setReduceMotion(v) {
      const s = getSave();
      s.profile.reduceMotion = v;
      setSave(s);
    },
    theme: () => getSave().profile.theme,
    setTheme(id: string) {
      const s = getSave();
      s.profile.theme = id;
      setSave(s);
    },
  };
}
