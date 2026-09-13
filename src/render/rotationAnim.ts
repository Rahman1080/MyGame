import { clockwiseDistance } from "../engine/rotation";
import type { Direction } from "../engine/types";

/**
 * Angle (radians) for a cell arrow mid-rotation.
 *
 * At t=0 it renders the old direction; at t=1 it renders the new one. Only the
 * single clockwise step between `from` and `to` is interpolated, so a rapid
 * re-tap that replaces the animation can never produce a double rotation.
 */
export function rotationAngle(from: Direction, to: Direction, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const delta = clockwiseDistance(from, to);
  return (from + delta * clamped) * (Math.PI / 2);
}
