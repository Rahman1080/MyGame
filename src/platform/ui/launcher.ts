import { ICON_MUTE, ICON_UNMUTE } from "../../ui/icons";
import { GAMES, isGameId } from "../registry";
import type { SaveService } from "../services/save";
import type { AudioService, SettingsService } from "../types";
import { escapeHtml, streakPill } from "./chrome";

export interface HomeDeps {
  save: SaveService;
  audio: AudioService;
  settings: SettingsService;
}

type Navigate = (hash: string) => void;

let homeEvents: AbortController | null = null;

function countStars(stars: Record<string, number>): number {
  return Object.values(stars).reduce((n, v) => n + v, 0);
}

export function renderHome(root: HTMLElement, deps: HomeDeps, navigate: Navigate): void {
  homeEvents?.abort();
  homeEvents = new AbortController();

  const profile = deps.save.get().profile;
  const muted = deps.settings.muted();
  const lastId = isGameId(profile.lastGame) ? profile.lastGame : "glowtrail";
  const last =
    GAMES.find((g) => g.meta.id === lastId && g.meta.status === "ready") ??
    GAMES.find((g) => g.meta.status === "ready")!;
  const stars = countStars(deps.save.get().games.glowtrail.stars);

  const cards = GAMES.map(({ meta }) => {
    const ready = meta.status === "ready";
    const label = `${escapeHtml(meta.name)} — ${escapeHtml(meta.tagline)}`;
    return `<button class="arcade-card${ready ? "" : " soon"}" style="--accent:${meta.accent}" data-game="${meta.id}" ${
      ready ? "" : "disabled"
    } aria-label="${label}">
      <span class="arcade-name">${escapeHtml(meta.name)}</span>
      <span class="arcade-tag">${escapeHtml(meta.tagline)}</span>
      <span class="arcade-state">${ready ? "PLAY" : "SOON"}</span>
    </button>`;
  }).join("");

  root.innerHTML = `<div class="shell arcade">
    <header class="arcade-top">
      <div class="arcade-brand">
        <div class="arcade-word">GLOWTRAIL<span>ARCADE</span></div>
        <div class="arcade-sub">NEON PUZZLE ARCADE</div>
      </div>
      <div class="arcade-top-right">
        ${streakPill(profile.streak)}
        <button class="icon-btn sm" data-act="mute" aria-label="${muted ? "Unmute" : "Mute"}">${
          muted ? ICON_UNMUTE : ICON_MUTE
        }</button>
      </div>
    </header>

    <button class="continue-card arcade-continue" data-act="continue">
      <span class="continue-text">
        <span class="k">CONTINUE PLAYING</span>
        <span class="lvl-big">${escapeHtml(last.meta.name)}</span>
        <span class="sub">${escapeHtml(last.meta.tagline)} · ${last.meta.id === "glowtrail" ? `★ ${stars}` : `LV ${profile.level}`}</span>
      </span>
      <span class="continue-arrow" aria-hidden="true">›</span>
    </button>

    <div class="arcade-section-title">ARCADE</div>
    <div class="arcade-grid">${cards}</div>
    <div class="arcade-foot">MORE GAMES SOON</div>
  </div>`;

  root.addEventListener(
    "click",
    (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>("[data-game],[data-act]");
      if (!t) return;
      const game = t.dataset.game;
      if (game) {
        const desc = GAMES.find((g) => g.meta.id === game);
        if (desc?.meta.status === "ready") navigate(`#/game/${desc.meta.id}`);
        return;
      }
      if (t.dataset.act === "continue") {
        navigate(`#/game/${last.meta.id}`);
      } else if (t.dataset.act === "mute") {
        const next = !deps.settings.muted();
        deps.settings.setMuted(next);
        deps.audio.setMuted(next);
        renderHome(root, deps, navigate);
      }
    },
    { signal: homeEvents.signal },
  );
}
