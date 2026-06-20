export class HeightfieldNavMesh25D {
  constructor({
    width = 1,
    height = 1,
    cellSize = 32,
    heights = [],
    walkable = [],
    jumpHeight = 1,
    slopeLimit = 0.75
  } = {}) {
    this.width = Math.max(1, Number(width) || 1);
    this.height = Math.max(1, Number(height) || 1);
    this.cellSize = Math.max(1, Number(cellSize) || 32);
    this.heights = heights;
    this.walkable = walkable;
    this.jumpHeight = Math.max(0, Number(jumpHeight) || 0);
    this.slopeLimit = Math.max(0, Number(slopeLimit) || 0);
  }

  worldToCell(point = {}) {
    return {
      x: clamp(Math.floor(Number(point.x || 0) / this.cellSize), 0, this.width - 1),
      y: clamp(Math.floor(Number(point.y || 0) / this.cellSize), 0, this.height - 1)
    };
  }

  cellToWorld(cell = {}) {
    const x = clamp(Number(cell.x || 0), 0, this.width - 1);
    const y = clamp(Number(cell.y || 0), 0, this.height - 1);
    return {
      x: x * this.cellSize,
      y: y * this.cellSize,
      z: this.heightAtCell({ x, y }),
      action: cell.action || 'walk'
    };
  }

  heightAtCell(cell = {}) {
    return Number(this.heights[this.index(cell)] ?? 0);
  }

  isWalkable(cell = {}) {
    const value = this.walkable[this.index(cell)];
    return value !== false && value !== 0;
  }

  findPath(start = {}, goal = {}) {
    const startCell = this.normalizeCell(start);
    const goalCell = this.normalizeCell(goal);
    const open = [{ ...startCell, g: 0, f: this.heuristic(startCell, goalCell), parent: null, action: 'walk' }];
    const visited = new Map();
    while (open.length) {
      open.sort((left, right) => left.f - right.f);
      const current = open.shift();
      const key = this.key(current);
      if (visited.has(key)) continue;
      visited.set(key, current);
      if (current.x === goalCell.x && current.y === goalCell.y) return this.reconstruct(current);
      for (const neighbor of this.neighbors(current)) {
        const nextKey = this.key(neighbor);
        if (visited.has(nextKey)) continue;
        const cost = current.g + this.stepCost(current, neighbor);
        open.push({
          ...neighbor,
          g: cost,
          f: cost + this.heuristic(neighbor, goalCell),
          parent: current
        });
      }
    }
    return [];
  }

  normalizeCell(cell = {}) {
    return {
      x: clamp(Math.round(Number(cell.x || 0)), 0, this.width - 1),
      y: clamp(Math.round(Number(cell.y || 0)), 0, this.height - 1),
      z: this.heightAtCell(cell)
    };
  }

  neighbors(cell) {
    return [
      { x: cell.x + 1, y: cell.y },
      { x: cell.x - 1, y: cell.y },
      { x: cell.x, y: cell.y + 1 },
      { x: cell.x, y: cell.y - 1 }
    ].filter((candidate) => (
      candidate.x >= 0
      && candidate.x < this.width
      && candidate.y >= 0
      && candidate.y < this.height
      && this.isWalkable(candidate)
    )).map((candidate) => {
      const z = this.heightAtCell(candidate);
      const delta = z - this.heightAtCell(cell);
      return {
        ...candidate,
        z,
        action: Math.abs(delta) > this.slopeLimit ? 'jump' : 'walk'
      };
    }).filter((candidate) => Math.abs(candidate.z - this.heightAtCell(cell)) <= this.jumpHeight);
  }

  stepCost(from, to) {
    const dz = Math.abs(Number(to.z || 0) - Number(from.z || 0));
    return 1 + dz * (to.action === 'jump' ? 1.5 : 0.5);
  }

  heuristic(from, to) {
    return Math.abs(from.x - to.x) + Math.abs(from.y - to.y) + Math.abs(this.heightAtCell(from) - this.heightAtCell(to));
  }

  reconstruct(node) {
    const path = [];
    let current = node;
    while (current) {
      path.unshift({
        x: current.x,
        y: current.y,
        z: this.heightAtCell(current),
        action: current.action || 'walk'
      });
      current = current.parent;
    }
    return path;
  }

  index(cell = {}) {
    const x = clamp(Math.round(Number(cell.x || 0)), 0, this.width - 1);
    const y = clamp(Math.round(Number(cell.y || 0)), 0, this.height - 1);
    return y * this.width + x;
  }

  key(cell) {
    return `${cell.x}:${cell.y}`;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default HeightfieldNavMesh25D;
