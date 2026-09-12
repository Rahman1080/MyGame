# GLOWTRAIL Implementation Plan

> **For agentic workers:** Implement task-by-task. Engine and tests before UI. Do not fake gameplay.

**Goal:** Ship a complete playable GLOWTRAIL PWA matching the locked spec.

**Architecture:** Pure engine (grid, simulate, solve, score) separate from Canvas/UI. Seeded generator produces only validated puzzles. localStorage save. One rAF loop for board animation.

**Tech Stack:** Vite 6, TypeScript strict, Vitest, Canvas 2D, Web Audio, PWA service worker.

## Global Constraints

- No React / Next / game engines / backend / accounts
- Visual identity locked (Glow Trail v2)
- `allowedHosts: ['.monkeycode-ai.live']`
- Tests: `npm test` must cover engine, generator, save, daily
- Offline after first visit

## File map

`src/engine/*` simulation and scoring. `src/gen/*` RNG and packs. `src/save/*` persistence. `src/ui/*` screens. `src/render/board.ts` Canvas. `src/audio/synth.ts`. `src/ads/adService.ts` noop. `src/levels/tutorial.ts`. `tests/*.test.ts`.

## Tasks

1. Scaffold Vite + TS + Vitest + PWA manifest
2. Engine types, rotation, simulate, session (undo/reset/retry/hint)
3. Solver + par + stars
4. Tutorial puzzles
5. Seeded generator + daily
6. Save schema
7. UI + Canvas + audio
8. PWA + polish + verify tests
