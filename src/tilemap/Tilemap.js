import ChunkManager from './ChunkManager.js';
import AITilemapGenerator from './AITilemapGenerator.js';
import TilemapStreamer from './TilemapStreamer.js';
import TilemapAuthoringTools from './TilemapAuthoringTools.js';
import findPath from '../compute/Pathfinding.js';

/**
 * Parser for Tiled-style JSON maps.
 *
 * Supports:
 * - finite tile/object layers
 * - grouped layers (flattened with `group/name` paths)
 * - infinite tile layers with `chunks`
 * - object collision shapes: rectangle / ellipse / polygon / polyline
 *
 * @example
 * const map = Tilemap.parse(tiledJson);
 * const ground = map.getTileLayer('Ground');
 * ground.tileAt(4, 2);
 */
export class Tilemap {
  constructor({
    width = 0,
    height = 0,
    tileWidth = 0,
    tileHeight = 0,
    layers = [],
    tilesets = [],
    properties = {}
  } = {}) {
    this.width = width;
    this.height = height;
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
    this.layers = layers;
    this.tilesets = tilesets;
    this.properties = properties;
  }

  static parse(json = {}) {
    const mapWidth = json.width || 0;
    const mapHeight = json.height || 0;
    const tileWidth = json.tilewidth || json.tileWidth || 0;
    const tileHeight = json.tileheight || json.tileHeight || 0;
    return new Tilemap({
      width: mapWidth,
      height: mapHeight,
      tileWidth,
      tileHeight,
      tilesets: json.tilesets || [],
      properties: normalizeProperties(json.properties),
      layers: flattenLayers(json.layers || [])
    });
  }

  static generateWithAI(prompt, options = {}) {
    const generated = AITilemapGenerator.generate(prompt, options);
    return {
      ...generated,
      tilemap: Tilemap.parse(generated.tilemapJson)
    };
  }

  static bakeStaticCollision(layer = {}) {
    const width = Number(layer.width || 0);
    const height = Number(layer.height || 0);
    const tileWidth = Number(layer.tileWidth || layer.tilewidth || 16);
    const tileHeight = Number(layer.tileHeight || layer.tileheight || 16);
    const collisionIds = new Set(layer.collisionTileIds || [1]);
    const data = Array.isArray(layer.data) ? layer.data : [];
    const visited = new Set();
    const polygons = [];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const key = `${x}:${y}`;
        const tileId = data[y * width + x] || 0;
        if (!collisionIds.has(tileId) || visited.has(key)) continue;
        let runWidth = 0;
        while (x + runWidth < width && collisionIds.has(data[y * width + x + runWidth] || 0) && !visited.has(`${x + runWidth}:${y}`)) {
          runWidth += 1;
        }
        let runHeight = 1;
        let canGrow = true;
        while (y + runHeight < height && canGrow) {
          for (let dx = 0; dx < runWidth; dx += 1) {
            if (!collisionIds.has(data[(y + runHeight) * width + x + dx] || 0) || visited.has(`${x + dx}:${y + runHeight}`)) {
              canGrow = false;
              break;
            }
          }
          if (canGrow) runHeight += 1;
        }
        for (let dy = 0; dy < runHeight; dy += 1) {
          for (let dx = 0; dx < runWidth; dx += 1) visited.add(`${x + dx}:${y + dy}`);
        }
        polygons.push({
          x: x * tileWidth,
          y: y * tileHeight,
          width: runWidth * tileWidth,
          height: runHeight * tileHeight,
          mergedTiles: runWidth * runHeight,
          points: [
            { x: x * tileWidth, y: y * tileHeight },
            { x: (x + runWidth) * tileWidth, y: y * tileHeight },
            { x: (x + runWidth) * tileWidth, y: (y + runHeight) * tileHeight },
            { x: x * tileWidth, y: (y + runHeight) * tileHeight }
          ]
        });
      }
    }

    return {
      polygons,
      colliderCount: polygons.length,
      sourceTiles: data.filter((tile) => collisionIds.has(tile)).length
    };
  }

  static bakeCollisionBinary(layer = {}) {
    const { polygons } = Tilemap.bakeStaticCollision(layer);
    const bytes = 8 + polygons.length * 16;
    const buffer = new ArrayBuffer(bytes);
    const view = new DataView(buffer);
    view.setUint32(0, 0x4f434f4c, true);
    view.setUint32(4, polygons.length, true);
    polygons.forEach((polygon, index) => {
      const offset = 8 + index * 16;
      view.setFloat32(offset, polygon.x, true);
      view.setFloat32(offset + 4, polygon.y, true);
      view.setFloat32(offset + 8, polygon.width, true);
      view.setFloat32(offset + 12, polygon.height, true);
    });
    return buffer;
  }

  static readCollisionBinary(buffer) {
    const view = new DataView(buffer);
    const magic = view.getUint32(0, true);
    if (magic !== 0x4f434f4c) return { polygons: [] };
    const count = view.getUint32(4, true);
    const polygons = [];
    for (let index = 0; index < count; index += 1) {
      const offset = 8 + index * 16;
      polygons.push({
        x: view.getFloat32(offset, true),
        y: view.getFloat32(offset + 4, true),
        width: view.getFloat32(offset + 8, true),
        height: view.getFloat32(offset + 12, true)
      });
    }
    return { polygons };
  }

  getLayer(nameOrId) {
    return this.layers.find((layer) => layer.name === nameOrId
      || layer.path === nameOrId
      || layer.id === nameOrId) || null;
  }

  getTileLayer(nameOrId) {
    const layer = this.getLayer(nameOrId);
    return layer?.type === 'tilelayer' ? layer : null;
  }

  getObjectLayer(nameOrId) {
    const layer = this.getLayer(nameOrId);
    return layer?.type === 'objectgroup' ? layer : null;
  }

  tileToWorld(x, y) {
    return {
      x: x * this.tileWidth,
      y: y * this.tileHeight
    };
  }

  getCollisionObjects(nameOrId = 'Collisions') {
    const layer = this.getObjectLayer(nameOrId);
    if (!layer) return [];
    return layer.objects.filter((object) => hasCollisionShape(object));
  }

  createMatterColliders(physics, nameOrId = 'Collisions', options = {}) {
    return this.getCollisionObjects(nameOrId).map((object) => physics.attachBody({
      id: object.id,
      name: object.name,
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
      rotation: object.rotation,
      shape: object.shape
    }, {
      body: { type: 'static', category: options.category || 'world', mask: options.mask || 'player' },
      label: object.name || `collision-${object.id}`,
      ...options
    }));
  }

  bakeNavigationMesh(nameOrId, {
    blockedTileIds = null,
    walkableTileIds = null,
    dynamicObstacles = []
  } = {}) {
    const layer = this.getTileLayer(nameOrId);
    if (!layer) {
      return createNavigationMesh({
        width: 0,
        height: 0,
        tileWidth: this.tileWidth,
        tileHeight: this.tileHeight,
        grid: []
      });
    }
    const blocked = blockedTileIds ? new Set(blockedTileIds) : null;
    const walkable = walkableTileIds ? new Set(walkableTileIds) : null;
    const obstacleKeys = new Set(dynamicObstacles.map((item) => `${item.x}:${item.y}`));
    const grid = [];
    for (let y = 0; y < layer.height; y += 1) {
      const row = [];
      for (let x = 0; x < layer.width; x += 1) {
        const tileId = layer.tileAt(x, y);
        const blockedByTile = blocked ? blocked.has(tileId) : false;
        const walkableByTile = walkable ? walkable.has(tileId) : !blockedByTile;
        row.push(!walkableByTile || obstacleKeys.has(`${x}:${y}`) ? 1 : 0);
      }
      grid.push(row);
    }
    return createNavigationMesh({
      width: layer.width,
      height: layer.height,
      tileWidth: layer.tileWidth || this.tileWidth,
      tileHeight: layer.tileHeight || this.tileHeight,
      grid
    });
  }

  resolveTileProperties(tileId) {
    const gid = Number(tileId || 0);
    if (!gid) return {};
    const tilesets = [...(this.tilesets || [])]
      .filter((tileset) => Number(tileset.firstgid || 1) <= gid)
      .sort((left, right) => Number(right.firstgid || 1) - Number(left.firstgid || 1));
    const tileset = tilesets[0];
    if (!tileset) return {};
    const localId = gid - Number(tileset.firstgid || 1);
    const tile = (tileset.tiles || []).find((item) => Number(item.id) === localId);
    return normalizeProperties(tile?.properties || {});
  }

  getTilePhysicsMaterial(nameOrId, x, y, { fallback = null } = {}) {
    const layer = this.getTileLayer(nameOrId);
    const tileId = layer?.tileAt?.(x, y) || 0;
    if (!tileId) return fallback;
    const properties = this.resolveTileProperties(tileId);
    const name = properties.physicsMaterial || properties.material || properties.name;
    if (!name && !('friction' in properties) && !('restitution' in properties)) return fallback;
    return {
      name: name || `tile-${tileId}`,
      tileId,
      friction: numberOrUndefined(properties.friction),
      restitution: numberOrUndefined(properties.restitution),
      frictionStatic: numberOrUndefined(properties.frictionStatic),
      frictionAir: numberOrUndefined(properties.frictionAir),
      speedMultiplier: numberOrUndefined(properties.speedMultiplier)
    };
  }

  createPhysicsMaterialMap(nameOrId, options = {}) {
    const layer = this.getTileLayer(nameOrId);
    const width = layer?.width || 0;
    const height = layer?.height || 0;
    const cells = [];
    for (let y = 0; y < height; y += 1) {
      const row = [];
      for (let x = 0; x < width; x += 1) row.push(this.getTilePhysicsMaterial(nameOrId, x, y, options));
      cells.push(row);
    }
    return {
      layer: layer?.name || nameOrId,
      width,
      height,
      tileWidth: layer?.tileWidth || this.tileWidth,
      tileHeight: layer?.tileHeight || this.tileHeight,
      cells
    };
  }

  createChunkManager(options = {}) {
    return new ChunkManager(this, options);
  }

  authoringTools() {
    return new TilemapAuthoringTools(this);
  }
}

Tilemap.Streamer = TilemapStreamer;
Tilemap.bakeStaticCollision = Tilemap.bakeStaticCollision.bind(Tilemap);
Tilemap.bakeCollisionBinary = Tilemap.bakeCollisionBinary.bind(Tilemap);
Tilemap.readCollisionBinary = Tilemap.readCollisionBinary.bind(Tilemap);

function parseLayerWithContext(layer = {}, groupName = '') {
  const hasName = typeof layer.name === 'string' && layer.name.trim().length > 0;
  const nextPath = groupName && hasName
    ? `${groupName}/${String(layer.name).trim()}`
    : hasName
      ? String(layer.name).trim()
      : groupName;
  if (layer.type === 'group') {
    return flattenLayers(layer.layers || [], nextPath);
  }

  const parsed = parseLayerBody(layer);
  if (!parsed) return null;
  if (!parsed.path && (parsed.name || nextPath)) {
    parsed.path = nextPath || parsed.name || null;
  }
  if (groupName && parsed.name) {
    parsed.group = groupName;
    if (!parsed.path || parsed.name === parsed.path) parsed.path = `${groupName}/${parsed.name}`;
  } else if (groupName) {
    parsed.group = groupName;
  }
  return parsed;
}

function parseLayerBody(layer = {}) {
  const base = (() => {
    if (layer.type === 'tilelayer') return parseTileLayer(layer);
    if (layer.type === 'objectgroup') return parseObjectLayer(layer);
    return {
      ...layer,
      properties: normalizeProperties(layer.properties)
    };
  })();

  if (!base?.name) return base;
  base.name = String(base.name);
  return base;
}

function parseTileLayer(layer = {}) {
  const sourceChunks = normalizeSourceChunks(layer.chunks || []);
  const chunks = sourceChunks.length > 0
    ? sourceChunks
    : buildChunks(layer);
  const tileWidth = layer.tilewidth || layer.tileWidth || 0;
  const tileHeight = layer.tileheight || layer.tileHeight || 0;
  return {
    id: layer.id,
    name: layer.name || '',
    type: 'tilelayer',
    width: layer.width || 0,
    height: layer.height || 0,
    chunkSize: layer.chunkSize || 16,
    opacity: layer.opacity ?? 1,
    visible: layer.visible ?? true,
    data: [...(layer.data || [])],
    properties: normalizeProperties(layer.properties),
    tileWidth,
    tileHeight,
    infinite: layer.infinite || sourceChunks.length > 0,
    sourceChunks,
    chunks,
    get tileAt() {
      return (x, y) => {
        if (this.infinite) {
          for (const source of this.sourceChunks || []) {
            const localX = x - source.x;
            const localY = y - source.y;
            if (localX < 0 || localY < 0 || localX >= source.width || localY >= source.height) continue;
            return source.data[localY * source.width + localX] || 0;
          }
          return 0;
        }
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
        return this.data[y * this.width + x] || 0;
      };
    },
    getVisibleChunks(viewport = {}) {
      return (this.chunks || this.sourceChunks || []).filter((chunk) => intersects(chunk.bounds, viewport));
    }
  };
}

function flattenLayers(layers = []) {
  return flattenLayersWithContext(layers, '').filter(Boolean);
}

function flattenLayersWithContext(layers = [], contextPath = '') {
  return layers.reduce((flattened, layer) => {
    const items = parseLayerWithContext(layer, contextPath);
    if (Array.isArray(items)) {
      flattened.push(...items);
    } else if (items) {
      flattened.push(items);
    }
    return flattened;
  }, []);
}

function parseObjectLayer(layer = {}) {
  return {
    id: layer.id,
    name: layer.name || '',
    type: 'objectgroup',
    opacity: layer.opacity ?? 1,
    visible: layer.visible ?? true,
    properties: normalizeProperties(layer.properties),
    objects: (layer.objects || []).map(normalizeObject)
  };
}

function normalizeSourceChunks(chunks = []) {
  return chunks
    .map((chunk = {}) => {
      const width = Number(chunk.width || 0);
      const height = Number(chunk.height || 0);
      const data = Array.isArray(chunk.data) ? [...chunk.data] : [];
      if (!width || !height || !data.length) return null;
      const tileWidth = Number(chunk.tilewidth || chunk.width || 16);
      const tileHeight = Number(chunk.tileheight || chunk.height || 16);
      const x = Number(chunk.x || chunk.startx || 0);
      const y = Number(chunk.y || chunk.starty || 0);
      return {
        x,
        y,
        width,
        height,
        data,
        tileWidth,
        tileHeight,
        bounds: {
          x: x * tileWidth,
          y: y * tileHeight,
          width: width * tileWidth,
          height: height * tileHeight
        }
      };
    })
    .filter(Boolean);
}

function normalizeObject(object = {}) {
  const width = Number(object.width || 0);
  const height = Number(object.height || 0);
  return {
    ...object,
    width,
    height,
    properties: normalizeProperties(object.properties),
    shape: buildShape(object)
  };
}

function buildShape(object = {}) {
  const width = Number(object.width || 0);
  const height = Number(object.height || 0);
  if (object.shape) return object.shape;
  if (object.ellipse) {
    return {
      type: 'ellipse',
      width,
      height,
      radiusX: width / 2,
      radiusY: height / 2
    };
  }

  if (Array.isArray(object.polygon)) {
    const points = normalizePoints(object.polygon, object.x || 0, object.y || 0);
    return {
      type: 'polygon',
      points,
      vertices: pointsToVertices(points)
    };
  }

  if (Array.isArray(object.polyline)) {
    return {
      type: 'polyline',
      points: normalizePoints(object.polyline, object.x || 0, object.y || 0)
    };
  }

  return null;
}

function normalizePoints(points = [], originX = 0, originY = 0) {
  return points.map((point) => ({
    x: (point.x || 0) + originX,
    y: (point.y || 0) + originY
  }));
}

function pointsToVertices(points = []) {
  return points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({ x: point.x, y: point.y }));
}

function hasCollisionShape(object = {}) {
  const width = Number(object.width || 0);
  const height = Number(object.height || 0);
  if (width > 0 && height > 0) return true;
  if (!object.shape) return false;
  if (object.shape.type === 'polygon' && Array.isArray(object.shape.points)) return object.shape.points.length >= 3;
  if (object.shape.type === 'polyline' && Array.isArray(object.shape.points)) return object.shape.points.length >= 2;
  if (object.shape.type === 'ellipse') return true;
  return false;
}

function buildChunks(layer, chunkSize = 16) {
  const chunks = [];
  const tileWidth = layer.tileWidth || 16;
  const tileHeight = layer.tileHeight || 16;
  const readTile = typeof layer.tileAt === 'function'
    ? (tileX, tileY) => layer.tileAt(tileX, tileY)
    : (tileX, tileY) => {
      if (tileX < 0 || tileY < 0 || tileX >= layer.width || tileY >= layer.height) return 0;
      return layer.data?.[tileY * layer.width + tileX] || 0;
    };
  for (let y = 0; y < layer.height; y += chunkSize) {
    for (let x = 0; x < layer.width; x += chunkSize) {
      const width = Math.min(chunkSize, layer.width - x);
      const height = Math.min(chunkSize, layer.height - y);
      chunks.push({
        x,
        y,
        width,
        height,
        bounds: {
          x: x * tileWidth,
          y: y * tileHeight,
          width: width * tileWidth,
          height: height * tileHeight
        },
        tileAt(localX, localY) {
          if (localX < 0 || localY < 0 || localX >= width || localY >= height) return 0;
          return readTile(x + localX, y + localY);
        }
      });
    }
  }
  return chunks;
}

function intersects(left, right) {
  return (left.x || 0) < (right.x || 0) + (right.width || 0)
    && (left.x || 0) + (left.width || 0) > (right.x || 0)
    && (left.y || 0) < (right.y || 0) + (right.height || 0)
    && (left.y || 0) + (left.height || 0) > (right.y || 0);
}

function normalizeProperties(properties = {}) {
  if (Array.isArray(properties)) {
    return Object.fromEntries(properties.map((item) => [item.name, item.value]));
  }
  return { ...properties };
}

function createNavigationMesh({ width, height, tileWidth, tileHeight, grid }) {
  return {
    width,
    height,
    tileWidth,
    tileHeight,
    grid,
    isWalkable(x, y) {
      return grid[y]?.[x] === 0;
    },
    worldToCell(point = {}) {
      return {
        x: Math.floor(Number(point.x || 0) / Math.max(1, tileWidth || 1)),
        y: Math.floor(Number(point.y || 0) / Math.max(1, tileHeight || 1))
      };
    },
    cellToWorld(cell = {}, { center = true } = {}) {
      const offsetX = center ? (tileWidth || 0) / 2 : 0;
      const offsetY = center ? (tileHeight || 0) / 2 : 0;
      return {
        x: Number(cell.x || 0) * (tileWidth || 0) + offsetX,
        y: Number(cell.y || 0) * (tileHeight || 0) + offsetY
      };
    },
    findPath(start, goal) {
      return findPath({ start, goal, grid });
    },
    setDynamicObstacles(obstacles = []) {
      const next = grid.map((row) => [...row]);
      for (const obstacle of obstacles) {
        if (next[obstacle.y]?.[obstacle.x] === 0) next[obstacle.y][obstacle.x] = 1;
      }
      return createNavigationMesh({ width, height, tileWidth, tileHeight, grid: next });
    }
  };
}

function numberOrUndefined(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export default Tilemap;
