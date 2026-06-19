/**
 * Build-time static sprite batch compiler.
 *
 * Converts immutable repeated sprites into deterministic vertex batches that
 * can be loaded by renderers without spending frame time discovering merges.
 */
export class StaticBatchCompiler {
  static compileScene(scene = {}, {
    scenePath = scene.path || scene.source || null,
    now = () => new Date().toISOString()
  } = {}) {
    const entities = normalizeEntities(scene);
    const staticSprites = entities.filter((entity) => StaticBatchCompiler.isStaticBatchable(entity));
    const groups = new Map();

    for (const entity of staticSprites) {
      const key = StaticBatchCompiler.batchKey(entity);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          texture: entity.texture || entity.sprite || entity.atlas || entity.atlasKey,
          blendMode: entity.blendMode || 'normal',
          pluginName: entity.pluginName || 'batch',
          static: true,
          immutable: true,
          spriteCount: 0,
          entityIds: [],
          vertices: [],
          bounds: null
        });
      }
      const batch = groups.get(key);
      const quad = StaticBatchCompiler.createQuad(entity);
      batch.spriteCount += 1;
      batch.entityIds.push(entity.id || entity.name || `sprite-${batch.spriteCount}`);
      batch.vertices.push(...quad.vertices);
      batch.bounds = mergeBounds(batch.bounds, quad.bounds);
    }

    const batches = [...groups.values()].map((batch) => ({
      ...batch,
      vertexBuffer: StaticBatchCompiler.createVertexBuffer(batch.vertices, batch.spriteCount)
    }));
    return {
      version: 1,
      scene: scene.name || scene.id || 'untitled',
      source: scenePath,
      generatedAt: now(),
      drawCallsBefore: staticSprites.length,
      drawCallsAfter: batches.length,
      savedDrawCalls: Math.max(0, staticSprites.length - batches.length),
      staticSpriteCount: staticSprites.length,
      batches
    };
  }

  static isStaticBatchable(entity = {}) {
    const hasTexture = Boolean(entity.texture || entity.sprite || entity.atlas || entity.atlasKey);
    const spriteLike = entity.type === 'sprite' || hasTexture;
    if (!spriteLike || !hasTexture) return false;
    if (!(entity.static === true || entity.isStatic === true || entity.batchStatic === true)) return false;
    if (entity.visible === false || entity.renderable === false) return false;
    if (entity.dynamic || entity.movable || entity.animated) return false;
    if (entity.mask || entity.shader || entity.filters?.length) return false;
    return true;
  }

  static batchKey(entity = {}) {
    return [
      entity.batchKey || entity.atlasKey || entity.atlas || entity.texture || entity.sprite,
      entity.blendMode || 'normal',
      entity.pluginName || 'batch'
    ].join('|');
  }

  static createQuad(entity = {}) {
    const x = Number(entity.x || 0);
    const y = Number(entity.y || 0);
    const width = Math.max(0, Number(entity.width || entity.w || entity.tileWidth || 0));
    const height = Math.max(0, Number(entity.height || entity.h || entity.tileHeight || 0));
    const scale = entity.scale ?? 1;
    const scaleX = Number(entity.scaleX ?? scale);
    const scaleY = Number(entity.scaleY ?? scale);
    const finalWidth = width * scaleX;
    const finalHeight = height * scaleY;
    const anchorX = Number(entity.anchor?.x || 0) * finalWidth;
    const anchorY = Number(entity.anchor?.y || 0) * finalHeight;
    const left = x - anchorX;
    const top = y - anchorY;
    const right = left + finalWidth;
    const bottom = top + finalHeight;
    const entityId = entity.id || entity.name || null;
    const color = entity.tint || entity.color || '#ffffff';
    const alpha = Number(entity.alpha ?? 1);
    return {
      bounds: { x: left, y: top, width: finalWidth, height: finalHeight },
      vertices: [
        { x: left, y: top, u: 0, v: 0, entityId, color, alpha },
        { x: right, y: top, u: 1, v: 0, entityId, color, alpha },
        { x: right, y: bottom, u: 1, v: 1, entityId, color, alpha },
        { x: left, y: bottom, u: 0, v: 1, entityId, color, alpha }
      ]
    };
  }

  static createVertexBuffer(vertices = [], spriteCount = 0) {
    const strideFloats = 8;
    const data = new Float32Array(Math.max(0, vertices.length * strideFloats));
    vertices.forEach((vertex, index) => {
      const offset = index * strideFloats;
      const color = parseHexColor(vertex.color || '#ffffff');
      data[offset] = finiteNumber(vertex.x, 0);
      data[offset + 1] = finiteNumber(vertex.y, 0);
      data[offset + 2] = finiteNumber(vertex.u, 0);
      data[offset + 3] = finiteNumber(vertex.v, 0);
      data[offset + 4] = color.r;
      data[offset + 5] = color.g;
      data[offset + 6] = color.b;
      data[offset + 7] = finiteNumber(vertex.alpha, 1);
    });
    return {
      format: 'float32',
      layout: 'x,y,u,v,r,g,b,a',
      strideFloats,
      byteLength: data.byteLength,
      vertexCount: vertices.length,
      spriteCount,
      data
    };
  }
}

function normalizeEntities(scene = {}) {
  if (Array.isArray(scene)) return scene;
  if (Array.isArray(scene.entities)) return scene.entities;
  if (Array.isArray(scene.children)) return scene.children;
  if (Array.isArray(scene.objects)) return scene.objects;
  return [];
}

function mergeBounds(left, right) {
  if (!right) return left;
  if (!left) return { ...right };
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const maxX = Math.max(left.x + left.width, right.x + right.width);
  const maxY = Math.max(left.y + left.height, right.y + right.height);
  return {
    x,
    y,
    width: maxX - x,
    height: maxY - y
  };
}

function parseHexColor(color) {
  if (typeof color !== 'string' || !color.startsWith('#')) return { r: 1, g: 1, b: 1 };
  const clean = color.slice(1);
  if (clean.length !== 6) return { r: 1, g: 1, b: 1 };
  return {
    r: Number.parseInt(clean.slice(0, 2), 16) / 255,
    g: Number.parseInt(clean.slice(2, 4), 16) / 255,
    b: Number.parseInt(clean.slice(4, 6), 16) / 255
  };
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export default StaticBatchCompiler;
