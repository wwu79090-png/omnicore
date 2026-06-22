export class WorldPartitionGrid {
  constructor({ cellSize = 256, actors = [] } = {}) {
    this.cellSize = Number(cellSize) || 256;
    this.actors = normalizeArray(actors).map((actor) => ({
      id: String(actor.id),
      x: Number(actor.x || 0),
      y: Number(actor.y || 0),
      layers: normalizeArray(actor.layers).map(String),
      spatial: actor.spatial !== false,
      payload: clone(actor.payload || {})
    }));
  }

  evaluate({ sources = [], activeLayers = [] } = {}) {
    const layerSet = new Set(normalizeArray(activeLayers).map(String));
    const loadedCells = this._loadedCells(sources);
    const loadedActors = [];
    const unloadedActors = [];

    for (const actor of this.actors) {
      const cell = this.cellFor(actor.x, actor.y);
      const inLoadedCell = !actor.spatial || loadedCells.has(cell.key);
      const layerActive = actor.layers.length === 0 || actor.layers.some((layer) => layerSet.has(layer));
      const entry = { ...actor, cell: cell.key };
      if (inLoadedCell && layerActive) loadedActors.push(entry);
      else unloadedActors.push(entry);
    }

    return {
      loadedCells: [...loadedCells].sort(),
      loadedActors: sortById(loadedActors),
      unloadedActors: sortById(unloadedActors)
    };
  }

  cellFor(x, y) {
    const cx = Math.floor(Number(x || 0) / this.cellSize);
    const cy = Math.floor(Number(y || 0) / this.cellSize);
    return { x: cx, y: cy, key: `${cx},${cy}` };
  }

  _loadedCells(sources = []) {
    const cells = new Set();
    for (const source of normalizeArray(sources)) {
      const radius = Math.max(0, Number(source.radius || 0));
      const min = this.cellFor(Number(source.x || 0) - radius, Number(source.y || 0) - radius);
      const max = this.cellFor(Number(source.x || 0) + radius, Number(source.y || 0) + radius);
      for (let cx = min.x; cx <= max.x; cx += 1) {
        for (let cy = min.y; cy <= max.y; cy += 1) {
          const centerX = cx * this.cellSize + this.cellSize / 2;
          const centerY = cy * this.cellSize + this.cellSize / 2;
          if (distance(centerX, centerY, source.x || 0, source.y || 0) <= radius + this.cellSize * 0.75) {
            cells.add(`${cx},${cy}`);
          }
        }
      }
    }
    return cells;
  }
}

function distance(ax, ay, bx, by) {
  return Math.hypot(Number(ax) - Number(bx), Number(ay) - Number(by));
}

function sortById(entries) {
  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default WorldPartitionGrid;
