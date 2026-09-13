import type { Cell, ColorName } from "./types";

// The Color Gates pack is live: the orb carries a color, a gate recolours it,
// and the exit portal only opens for the color it demands. Ordinary arrows are
// purely visual and never change the token color.
export const COLOR_MECHANIC_ENABLED = true;

// Token color rule:
//  - a `gate` with a color sets the carried color,
//  - every other cell (including arrows) leaves it untouched.
export function resolveTokenColor(cell: Cell, current: ColorName): ColorName {
  if (!COLOR_MECHANIC_ENABLED) return current;
  if (cell.type === "gate" && cell.color) return cell.color;
  return current;
}

/** Color the exit demands, or undefined when the level has no color rule. */
export function requiredExitColor(cell: Cell | undefined): ColorName | undefined {
  if (!COLOR_MECHANIC_ENABLED) return undefined;
  if (!cell || cell.type !== "exit") return undefined;
  return cell.color;
}
