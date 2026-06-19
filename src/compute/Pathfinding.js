function defaultManhattan(left, right) {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function key(point) {
  return `${point.x},${point.y}`;
}

function toPath(node) {
  const path = [];
  let current = node;
  while (current) {
    path.unshift({ x: current.x, y: current.y });
    current = current.parent;
  }
  return path;
}

function neighbors(point, grid) {
  return [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 }
  ].filter((item) => grid[item.y]?.[item.x] === 0);
}

/**
 * A* pathfinding with optional WASM-backed Manhattan heuristic.
 */
export function findPath({ start, goal, grid = [] }, { manhattan = null } = {}) {
  if (!start || !goal || !grid.length) return [];
  const heuristic = typeof manhattan === 'function'
    ? (left, right) => manhattan(left.x, left.y, right.x, right.y)
    : defaultManhattan;
  const open = [{ ...start, g: 0, f: heuristic(start, goal), parent: null }];
  const closed = new Set();

  while (open.length) {
    open.sort((left, right) => left.f - right.f);
    const current = open.shift();
    if (current.x === goal.x && current.y === goal.y) return toPath(current);
    closed.add(key(current));

    for (const next of neighbors(current, grid)) {
      if (closed.has(key(next))) continue;
      const g = current.g + 1;
      const existing = open.find((node) => node.x === next.x && node.y === next.y);
      if (!existing) {
        open.push({ ...next, g, f: g + heuristic(next, goal), parent: current });
      } else if (g < existing.g) {
        existing.g = g;
        existing.f = g + heuristic(existing, goal);
        existing.parent = current;
      }
    }
  }

  return [];
}

export default findPath;
