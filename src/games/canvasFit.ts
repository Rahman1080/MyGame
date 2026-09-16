export interface FittedBox {
  w: number;
  h: number;
}

/**
 * Fits an `aspect`-ratio box (width / height) inside an available area while
 * never exceeding either dimension. Used by canvas games so the backing buffer
 * and the rendered element always agree on the same box; letting CSS clamp a
 * differently sized buffer distorts the board and breaks pointer mapping.
 */
export function fitBox(
  availW: number,
  availH: number,
  aspect = 1,
  maxSize = Number.POSITIVE_INFINITY,
): FittedBox {
  const safeW = Math.max(1, Math.floor(availW));
  const safeH = Math.max(1, Math.floor(availH));
  const ratio = aspect > 0 ? aspect : 1;

  let h = safeH;
  let w = h * ratio;
  if (w > safeW) {
    w = safeW;
    h = w / ratio;
  }

  const longest = Math.max(w, h);
  if (Number.isFinite(maxSize) && longest > maxSize) {
    const scale = maxSize / longest;
    w *= scale;
    h *= scale;
  }

  return { w: Math.max(1, Math.floor(w)), h: Math.max(1, Math.floor(h)) };
}
