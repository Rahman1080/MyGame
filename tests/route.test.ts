import { describe, expect, it } from "vitest";
import { hashFor, parseHash, type Route } from "../src/platform/router";

describe("router", () => {
  it("defaults to home", () => {
    expect(parseHash("")).toEqual({ name: "home" });
    expect(parseHash("#/home")).toEqual({ name: "home" });
    expect(parseHash("#/nonsense")).toEqual({ name: "home" });
  });

  it("parses game routes and rejects empty ids", () => {
    expect(parseHash("#/game/fusion")).toEqual({ name: "game", id: "fusion" });
    expect(parseHash("#/game/")).toEqual({ name: "home" });
  });

  it("parses daily", () => {
    expect(parseHash("#/daily")).toEqual({ name: "daily" });
  });

  it("round-trips every route shape", () => {
    const routes: Route[] = [
      { name: "home" },
      { name: "game", id: "prism" },
      { name: "daily" },
    ];
    for (const r of routes) expect(parseHash(hashFor(r))).toEqual(r);
  });
});
