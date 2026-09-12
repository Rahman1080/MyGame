import type { ColorName } from "../engine/types";

export const PALETTE = {
  bg: "#07080D",
  cyan: "#29DDF4",
  magenta: "#E45CFF",
  amber: "#FFC857",
  lime: "#9CFF4F",
  dim: "#1a2436",
  text: "#E8F4FF",
};

export function colorHex(name: ColorName | undefined): string {
  switch (name) {
    case "magenta":
      return PALETTE.magenta;
    case "amber":
      return PALETTE.amber;
    case "lime":
      return PALETTE.lime;
    default:
      return PALETTE.cyan;
  }
}

export function withAlpha(hex: string, a: number): string {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
