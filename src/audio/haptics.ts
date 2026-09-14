/**
 * Tiny haptics wrapper. Browsers expose `navigator.vibrate`; everything else
 * (SSR, tests, desktop) must silently no-op instead of throwing.
 */
export function vibrate(pattern: number | number[]): boolean {
  try {
    const nav = globalThis.navigator as unknown as { vibrate?: (p: number | number[]) => boolean } | undefined;
    if (!nav || typeof nav.vibrate !== "function") return false;
    return nav.vibrate(pattern);
  } catch {
    return false;
  }
}

export function hapticRotate(): void {
  vibrate(8);
}

export function hapticTap(): void {
  vibrate(5);
}

export function hapticPortal(): void {
  vibrate([6, 22, 6]);
}

export function hapticReveal(): void {
  vibrate([10, 30, 10, 30, 10]);
}

export function hapticFail(): void {
  vibrate(28);
}

export function hapticWin(): void {
  vibrate([12, 40, 12]);
}
