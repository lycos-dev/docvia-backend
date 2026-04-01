import type { Position } from '../types';

/**
 * Calculate milestone positions along a gentle S-curve path.
 */
export function calculateMilestonePositions(
  totalMilestones: number,
  width: number,
  height: number
): Position[] {
  const positions: Position[] = [];
  const padding = 80;
  const usableWidth = width - padding * 2;
  const centerY = height / 2;
  const amplitude = height * 0.28;

  for (let i = 0; i < totalMilestones; i++) {
    const t = totalMilestones === 1 ? 0.5 : i / (totalMilestones - 1);
    const x = padding + usableWidth * t;
    const y = centerY - Math.sin(t * Math.PI * 1.5) * amplitude;
    positions.push({ x, y });
  }

  return positions;
}

/**
 * Generate a cubic bezier SVG path string through positions.
 */
export function generatePathString(positions: Position[]): string {
  if (positions.length < 2) return '';

  let path = `M ${positions[0].x} ${positions[0].y}`;

  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const curr = positions[i];
    const cp1x = prev.x + (curr.x - prev.x) * 0.5;
    const cp1y = prev.y;
    const cp2x = prev.x + (curr.x - prev.x) * 0.5;
    const cp2y = curr.y;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
  }

  return path;
}

/**
 * Approximate total path length using piecewise linear segments.
 */
export function approximatePathLength(positions: Position[]): number {
  let length = 0;
  for (let i = 1; i < positions.length; i++) {
    const dx = positions[i].x - positions[i - 1].x;
    const dy = positions[i].y - positions[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

/**
 * Get the {x, y} point on the path at a given progress (0–1).
 * Uses SVGPathElement.getPointAtLength for accuracy when available,
 * falls back to linear interpolation between positions.
 */
export function getCarPositionAtProgress(
  progress: number,
  positions: Position[],
  pathEl: SVGPathElement | null
): Position {
  if (pathEl) {
    try {
      const totalLength = pathEl.getTotalLength();
      const pt = pathEl.getPointAtLength(totalLength * progress);
      return { x: pt.x, y: pt.y };
    } catch {
      // fall through to linear fallback
    }
  }

  if (positions.length === 0) return { x: 0, y: 0 };
  if (positions.length === 1) return positions[0];

  const scaled = progress * (positions.length - 1);
  const idx    = Math.min(Math.floor(scaled), positions.length - 2);
  const t      = scaled - idx;
  const a      = positions[idx];
  const b      = positions[idx + 1];
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

/**
 * Compute the tangent angle (radians) at a path position.
 * Used to orient the car to face the direction of travel.
 */
export function getPathTangentAngle(
  progress: number,
  positions: Position[],
  pathEl: SVGPathElement | null
): number {
  const delta = 0.01;
  const p1 = getCarPositionAtProgress(Math.max(0, progress - delta), positions, pathEl);
  const p2 = getCarPositionAtProgress(Math.min(1, progress + delta), positions, pathEl);
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}