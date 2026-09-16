import "./styles/globals.css";
import "./styles/game.css";
import { startRouter } from "./platform/router";
import { NoopAdsService } from "./platform/services/reward";
import { createAudio, createHaptics } from "./platform/services/audio";
import { rngFromSeed } from "./platform/services/rng";
import { createSaveService } from "./platform/services/save";
import { createSettings } from "./platform/services/settings";
import { NoopAnalytics } from "./platform/services/telemetry";

const root = document.querySelector<HTMLDivElement>("#app")!;
const save = createSaveService();
const settings = createSettings(
  () => save.get(),
  (next) => save.set(next),
);
const audio = createAudio(save.get().profile.muted);

startRouter(root, {
  save,
  audio,
  haptics: createHaptics(),
  ads: new NoopAdsService(),
  settings,
  analytics: new NoopAnalytics(),
  rng: rngFromSeed,
});

const nativeShell =
  typeof window !== "undefined" &&
  ("Capacitor" in window || (window as { capacitor?: unknown }).capacitor !== undefined);
if (!nativeShell && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
