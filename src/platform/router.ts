import type { Rng } from "../gen/seededRng";
import { findGame } from "./registry";
import type { SaveService } from "./services/save";
import type {
  AdsService,
  AnalyticsService,
  AnyGameSave,
  AudioService,
  GameContext,
  GameId,
  HapticsService,
  MiniGame,
  SettingsService,
} from "./types";
import { renderHome } from "./ui/launcher";

export type Route = { name: "home" } | { name: "game"; id: string } | { name: "daily" };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, "").replace(/\/$/, "");
  if (h.startsWith("game/")) {
    const id = h.slice("game/".length);
    return id ? { name: "game", id } : { name: "home" };
  }
  if (h === "daily") return { name: "daily" };
  return { name: "home" };
}

export function hashFor(route: Route): string {
  if (route.name === "game") return `#/game/${route.id}`;
  if (route.name === "daily") return "#/daily";
  return "#/home";
}

export function navigate(route: Route): void {
  if (typeof location !== "undefined") location.hash = hashFor(route);
}

let backHandler: (() => boolean) | null = null;

export function setBackHandler(fn: (() => boolean) | null): void {
  backHandler = fn;
}

export interface PlatformDeps {
  save: SaveService;
  audio: AudioService;
  haptics: HapticsService;
  ads: AdsService;
  settings: SettingsService;
  analytics: AnalyticsService;
  rng: (seed: string) => Rng;
}

function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  return "Capacitor" in window || (window as { capacitor?: unknown }).capacitor !== undefined;
}

export function startRouter(root: HTMLElement, deps: PlatformDeps): void {
  let current: MiniGame | null = null;
  let appOpenTracked = false;

  const contextFor = (id: GameId): GameContext => ({
    root,
    audio: deps.audio,
    haptics: deps.haptics,
    ads: deps.ads,
    settings: deps.settings,
    analytics: deps.analytics,
    rng: deps.rng,
    save: deps.save.get().games[id],
    updateSave: (slice) => {
      deps.save.mutate((draft) => {
        (draft.games as Record<GameId, AnyGameSave>)[id] = slice;
      });
    },
    report: (result) => {
      deps.analytics.track("game_completed", {
        game: id,
        score: result.score,
        solved: result.solved === true,
      });
    },
    exit: () => {
      navigate({ name: "home" });
    },
  });

  const clearCurrent = (): void => {
    if (current) {
      try {
        current.unmount();
      } catch {
        /* a game must never block navigation */
      }      current = null;
    }
    setBackHandler(null);
    root.innerHTML = "";
  };

  const showHome = (): void => {
    clearCurrent();
    if (!appOpenTracked) {
      appOpenTracked = true;
      deps.analytics.track("app_open", {});
    }
    renderHome(root, deps, (hash) => {
      location.hash = hash;
    });
    setBackHandler(() => false);
  };

  const mountGame = async (id: string): Promise<void> => {
    const desc = findGame(id);
    if (!desc || !desc.load) {
      navigate({ name: "home" });
      return;
    }
    clearCurrent();
    const mod = await desc.load();
    current = mod.default;
    deps.analytics.track("game_switched", { game: desc.meta.id });
    await current.mount(root, contextFor(desc.meta.id));
  };

  const route = (): void => {
    const r = parseHash(typeof location !== "undefined" ? location.hash : "");
    if (r.name === "game") void mountGame(r.id);
    else showHome();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("hashchange", route);
  }
  route();

  if (isNativeShell()) {
    void import("@capacitor/app")
      .then(({ App }) => {
        void App.addListener("backButton", () => {
          if (backHandler && backHandler()) return;
          const r = parseHash(location.hash);
          if (r.name !== "home") {
            navigate({ name: "home" });
            return;
          }
          void App.exitApp();
        });
      })
      .catch(() => undefined);
  }
}
