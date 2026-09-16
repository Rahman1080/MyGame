import type { WordConnectState } from "./engine";

export interface WheelNode {
  index: number;
  letter: string;
  x: number;
  y: number;
  radius: number;
}

export interface WheelGeometry {
  cx: number;
  cy: number;
  radius: number;
  nodeRadius: number;
}

/**
 * Single source of truth for wheel geometry. Both the renderer and pointer
 * hit-testing MUST use this so the drawn nodes and the tappable nodes always
 * line up exactly.
 */
export function wheelGeometry(width: number, height: number): WheelGeometry {
  const cx = width / 2;
  const cy = height - Math.min(height * 0.26, 160);
  const radius = Math.min(width * 0.36, height * 0.2, 120);
  const nodeRadius = Math.max(22, Math.min(28, Math.floor(radius * 0.3)));
  return { cx, cy, radius, nodeRadius };
}

export function wheelNodePositions(
  state: WordConnectState,
  width: number,
  height: number,
  angleOffset: number,
): WheelNode[] {
  const { cx, cy, radius, nodeRadius } = wheelGeometry(width, height);
  const count = state.letters.length;
  const nodes: WheelNode[] = [];
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / count + angleOffset;
    nodes.push({
      index: i,
      letter: state.letters[i]!,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      radius: nodeRadius,
    });
  }
  return nodes;
}

/** Returns the wheel node index under the point, or -1 when nothing is hit. */
export function hitTestWheelNode(
  x: number,
  y: number,
  nodes: WheelNode[],
  hitScale = 1.55,
): number {
  let best = -1;
  let bestDist = Infinity;
  for (const n of nodes) {
    const r = n.radius * hitScale;
    const dx = x - n.x;
    const dy = y - n.y;
    const dist = dx * dx + dy * dy;
    if (dist <= r * r && dist < bestDist) {
      bestDist = dist;
      best = n.index;
    }
  }
  return best;
}
