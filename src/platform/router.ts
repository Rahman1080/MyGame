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
