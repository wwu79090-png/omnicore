const DEFAULT_WORLD_SIZE = 16384;
const DEFAULT_CELL_SIZE = 32;
const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_MAX_ITEMS = 8;

export class DualSpatialIndex {
  constructor({
    worldWidth = DEFAULT_WORLD_SIZE,
    worldHeight = DEFAULT_WORLD_SIZE,
    cellSize = DEFAULT_CELL_SIZE,
    maxDepth = DEFAULT_MAX_DEPTH,
    maxItems = DEFAULT_MAX_ITEMS
  } = {}) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.cellSize = Math.max(1, cellSize);
    this.staticTree = new QuadtreeNode({ x: 0, y: 0, width: worldWidth, height: worldHeight }, 0, maxDepth, maxItems);
    this.dynamicCells = new Map();
    this.dynamicRecords = new Map();
  }

  addStatic(entity) {
    this.staticTree.insert(entity);
    return entity;
  }

  addDynamic(entity) {
    const keys = this._cellKeys(entity);
    this.dynamicRecords.set(entity, keys);
    for (const key of keys) {
      if (!this.dynamicCells.has(key)) this.dynamicCells.set(key, new Set());
      this.dynamicCells.get(key).add(entity);
    }
    return entity;
  }

  updateDynamic(entity) {
    this.removeDynamic(entity);
    return this.addDynamic(entity);
  }

  removeDynamic(entity) {
    const keys = this.dynamicRecords.get(entity) || [];
    for (const key of keys) this.dynamicCells.get(key)?.delete(entity);
    this.dynamicRecords.delete(entity);
    return entity;
  }

  query(bounds) {
    const hits = new Set(this.staticTree.query(bounds));
    for (const key of this._cellKeys(bounds)) {
      for (const entity of this.dynamicCells.get(key) || []) {
        if (intersects(normalizeBounds(entity), normalizeBounds(bounds))) hits.add(entity);
      }
    }
    return [...hits];
  }

  stats() {
    return {
      staticStructure: 'quadtree',
      dynamicStructure: 'spatial-hash',
      worldWidth: this.worldWidth,
      worldHeight: this.worldHeight,
      worldTiles: Math.round((this.worldWidth / 16) * (this.worldHeight / 16)),
      staticCount: this.staticTree.count(),
      dynamicCount: this.dynamicRecords.size,
      dynamicCells: this.dynamicCells.size
    };
  }

  _cellKeys(bounds) {
    const rect = normalizeBounds(bounds);
    const minX = Math.floor(rect.x / this.cellSize);
    const maxX = Math.floor((rect.x + rect.width) / this.cellSize);
    const minY = Math.floor(rect.y / this.cellSize);
    const maxY = Math.floor((rect.y + rect.height) / this.cellSize);
    const keys = [];
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) keys.push(`${x}:${y}`);
    }
    return keys;
  }
}

class QuadtreeNode {
  constructor(bounds, depth, maxDepth, maxItems) {
    this.bounds = bounds;
    this.depth = depth;
    this.maxDepth = maxDepth;
    this.maxItems = maxItems;
    this.items = [];
    this.children = null;
  }

  insert(entity) {
    if (!intersects(this.bounds, normalizeBounds(entity))) return false;
    if (this.children) {
      const child = this._childFor(entity);
      if (child) return child.insert(entity);
    }
    this.items.push(entity);
    if (this.items.length > this.maxItems && this.depth < this.maxDepth) this._split();
    return true;
  }

  query(bounds, hits = []) {
    if (!intersects(this.bounds, normalizeBounds(bounds))) return hits;
    for (const item of this.items) {
      if (intersects(normalizeBounds(item), normalizeBounds(bounds))) hits.push(item);
    }
    for (const child of this.children || []) child.query(bounds, hits);
    return hits;
  }

  count() {
    return this.items.length + (this.children || []).reduce((sum, child) => sum + child.count(), 0);
  }

  _split() {
    if (this.children) return;
    const { x, y, width, height } = this.bounds;
    const halfW = width / 2;
    const halfH = height / 2;
    this.children = [
      new QuadtreeNode({ x, y, width: halfW, height: halfH }, this.depth + 1, this.maxDepth, this.maxItems),
      new QuadtreeNode({ x: x + halfW, y, width: halfW, height: halfH }, this.depth + 1, this.maxDepth, this.maxItems),
      new QuadtreeNode({ x, y: y + halfH, width: halfW, height: halfH }, this.depth + 1, this.maxDepth, this.maxItems),
      new QuadtreeNode({ x: x + halfW, y: y + halfH, width: halfW, height: halfH }, this.depth + 1, this.maxDepth, this.maxItems)
    ];
    const remaining = [];
    for (const item of this.items) {
      const child = this._childFor(item);
      if (child) child.insert(item);
      else remaining.push(item);
    }
    this.items = remaining;
  }

  _childFor(entity) {
    const rect = normalizeBounds(entity);
    return (this.children || []).find((child) => contains(child.bounds, rect)) || null;
  }
}

function normalizeBounds(value = {}) {
  return {
    x: Number(value.x || 0),
    y: Number(value.y || 0),
    width: Number(value.width ?? value.w ?? 1),
    height: Number(value.height ?? value.h ?? 1)
  };
}

function contains(outer, inner) {
  return inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function intersects(left, right) {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

export default DualSpatialIndex;
