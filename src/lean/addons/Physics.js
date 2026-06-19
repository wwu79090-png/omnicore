import { createOmniError } from '../../core/OmniError.js';
import PhysicsQuery from '../../physics/PhysicsQuery.js';

/**
 * Lightweight collision addon plus lazy external physics loader.
 */
export class PhysicsAddon {
  constructor({ matter = null, gravity = null } = {}) {
    this.matter = matter;
    this.gravity = gravity;
    this.engine = null;
    this.world = null;
    this.bodies = new Map();
    this.materials = new Map();
    this.external = null;
    this.categoryMap = {
      world: 0x0001,
      player: 0x0002,
      enemy: 0x0004,
      sensor: 0x0008
    };
    this.query = new PhysicsQuery({
      getBodies: () => this._queryBodies(),
      getMatter: () => this.matter || this.external
    });
    this.collisionEventsBound = false;
  }

  mount(bootstrap = null, options = {}) {
    this.bootstrap = bootstrap;
    if (options.matter) this.useMatter(options.matter);
    if (options.gravity) this.gravity = options.gravity;
    this._ensureMatterEngine();
    return this;
  }

  rectIntersects(a, b) {
    return a.x < b.x + b.width
      && a.x + a.width > b.x
      && a.y < b.y + b.height
      && a.y + a.height > b.y;
  }

  ptInRect(point, rect) {
    return point.x >= rect.x
      && point.x <= rect.x + rect.width
      && point.y >= rect.y
      && point.y <= rect.y + rect.height;
  }

  async loadExternal(loader) {
    if (typeof loader !== 'function') throw createOmniError('Physics', '外部物理库加载器必须是函数。');
    this.external = await loader();
    return this.external;
  }

  useMatter(matter) {
    this.matter = matter;
    this.engine = null;
    this.world = null;
    this.collisionEventsBound = false;
    this._ensureMatterEngine();
    return this;
  }

  registerMaterial(name, material = {}) {
    if (!name) return null;
    const normalized = normalizeMaterial(name, material);
    this.materials.set(name, normalized);
    return normalized;
  }

  attachBody(entity, options = {}) {
    const Matter = this.matter || this.external;
    if (!Matter?.Bodies?.rectangle) throw createOmniError('Physics', 'attachBody 需要兼容 Matter.js 的适配器。');
    this._ensureMatterEngine();
    const width = options.width ?? entity.width ?? 1;
    const height = options.height ?? entity.height ?? 1;
    const x = options.x ?? (entity.x ?? 0) + width / 2;
    const y = options.y ?? (entity.y ?? 0) + height / 2;
    const bodyOptions = this._normalizeBodyOptions(options);
    delete bodyOptions.width;
    delete bodyOptions.height;
    delete bodyOptions.x;
    delete bodyOptions.y;
    delete bodyOptions.body;
    delete bodyOptions.sensor;
    delete bodyOptions.material;
    const shapeBody = this._createShapeBody(Matter, {
      entity,
      options,
      shape: options.shape || entity.shape,
      x,
      y,
      width,
      height
    });

    const body = shapeBody || Matter.Bodies.rectangle(x, y, width, height, bodyOptions);
    body.entity = entity;
    entity.body = body;
    this.bodies.set(entity, body);
    this._addBody(body);
    return body;
  }

  syncEntityFromBody(entity) {
    const body = entity?.body || this.bodies.get(entity);
    if (!body?.position || !entity) return entity;
    const width = entity.width ?? body.width ?? 0;
    const height = entity.height ?? body.height ?? 0;
    entity.x = body.position.x - width / 2;
    entity.y = body.position.y - height / 2;
    entity.rotation = body.angle ?? entity.rotation ?? 0;
    return entity;
  }

  step(deltaMs = 16.6667) {
    const Matter = this.matter || this.external;
    if (!Matter?.Engine?.update || !this.engine) return;
    Matter.Engine.update(this.engine, deltaMs);
    for (const entity of this.bodies.keys()) this.syncEntityFromBody(entity);
  }

  unmount() {
    this.external?.destroy?.();
    this.external = null;
    this.bodies.clear();
    this.engine = null;
    this.world = null;
    this.collisionEventsBound = false;
  }

  _ensureMatterEngine() {
    const Matter = this.matter || this.external;
    if (!Matter?.Engine?.create || this.engine) return;
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;
    this._bindCollisionEvents();
    if (this.gravity && this.world?.gravity) {
      Object.assign(this.world.gravity, this.gravity);
    }
  }

  _normalizeBodyOptions(options = {}) {
    const body = options.body || {};
    const next = { ...options };
    if (body.type) next.isStatic = body.type === 'static';
    if (options.sensor || body.sensor) next.isSensor = true;
    if (body.category || body.mask) {
      next.collisionFilter = {
        category: this._category(body.category || 'world'),
        mask: this._mask(body.mask || 'world')
      };
    }
    applyMaterialOptions(next, this._resolveMaterial(options.material));
    return next;
  }

  _createShapeBody(Matter, { shape, entity, options, x, y, width, height }) {
    if (!shape || typeof shape !== 'object') return null;
    const bodyOptions = { ...this._normalizeBodyOptions(options) };
    const shapeType = shape.type || '';

    if (shapeType === 'ellipse') {
      const radiusX = Number(shape.radiusX) || width / 2;
      const radiusY = Number(shape.radiusY) || height / 2;
      if (Matter.Bodies.circle && typeof Matter.Bodies.circle === 'function') {
        const radius = Math.max(radiusX, radiusY);
        return Matter.Bodies.circle(x + (Number(shape.offsetX) || 0), y + (Number(shape.offsetY) || 0), radius, bodyOptions);
      }
      return Matter.Bodies.rectangle(
        x + (width / 2),
        y + (height / 2),
        width,
        height,
        bodyOptions
      );
    }

    if (shapeType === 'polygon' || shapeType === 'polyline') {
      const vertices = normalizeVertices(shape.vertices || shape.points || [], entity.x ?? 0, entity.y ?? 0);
      if (vertices.length >= 3 && Matter.Bodies.fromVertices) {
        const cx = x;
        const cy = y;
        return Matter.Bodies.fromVertices(cx, cy, [vertices], bodyOptions, true);
      }
      if (shapeType === 'polygon' && vertices.length >= 3) {
        return Matter.Bodies.polygon?.(x, y, vertices.length, Math.max(width, height) / 2, bodyOptions) || null;
      }
      if (shapeType === 'polyline' && vertices.length >= 2) {
        const minX = Math.min(...vertices.map((point) => point.x));
        const maxX = Math.max(...vertices.map((point) => point.x));
        const minY = Math.min(...vertices.map((point) => point.y));
        const maxY = Math.max(...vertices.map((point) => point.y));
        return Matter.Bodies.rectangle(x, y, Math.max(1, maxX - minX), Math.max(1, maxY - minY), bodyOptions);
      }
      return null;
    }

    if (shapeType === 'rectangle') {
      return Matter.Bodies.rectangle(x, y, width, height, bodyOptions);
    }

    if (shape.vertices?.length) {
      const vertices = normalizeVertices(shape.vertices, entity.x ?? 0, entity.y ?? 0);
      if (vertices.length >= 3 && Matter.Bodies.fromVertices) {
        return Matter.Bodies.fromVertices(x, y, [vertices], bodyOptions, true);
      }
    }
    return null;
  }

  _category(name) {
    if (typeof name === 'number') return name;
    return this.categoryMap[name] || this.categoryMap.world;
  }

  _mask(mask) {
    if (Array.isArray(mask)) return [...new Set(mask.map((item) => this._category(item)))].reduce((value, item) => value + item, 0);
    return this._category(mask);
  }

  _resolveMaterial(nameOrMaterial) {
    if (!nameOrMaterial) return null;
    if (typeof nameOrMaterial === 'string') return this.materials.get(nameOrMaterial) || null;
    return normalizeMaterial(nameOrMaterial.name || 'material', nameOrMaterial);
  }

  _bindCollisionEvents() {
    const Matter = this.matter || this.external;
    if (this.collisionEventsBound || !Matter?.Events?.on || !this.engine) return;
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs || []) this._emitCollision(pair.bodyA, pair.bodyB, pair);
    });
    this.collisionEventsBound = true;
  }

  _emitCollision(bodyA, bodyB, pair) {
    const entityA = bodyA?.entity;
    const entityB = bodyB?.entity;
    entityA?.emit?.('collision', entityB, { pair, self: bodyA, other: bodyB });
    entityB?.emit?.('collision', entityA, { pair, self: bodyB, other: bodyA });
  }

  _addBody(body) {
    const Matter = this.matter || this.external;
    if (Matter?.Composite?.add && this.world) {
      Matter.Composite.add(this.world, body);
      return;
    }
    if (Matter?.World?.add && this.world) Matter.World.add(this.world, body);
  }

  _queryBodies() {
    if (Array.isArray(this.world?.bodies)) return this.world.bodies;
    return [...this.bodies.values()];
  }
}

function normalizeVertices(points, offsetX = 0, offsetY = 0) {
  if (!Array.isArray(points)) return [];
  return points
    .map((point) => ({
      x: Number(point.x) - offsetX,
      y: Number(point.y) - offsetY
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function normalizeMaterial(name, material = {}) {
  return {
    name,
    friction: numberOrUndefined(material.friction),
    frictionStatic: numberOrUndefined(material.frictionStatic),
    frictionAir: numberOrUndefined(material.frictionAir),
    restitution: numberOrUndefined(material.restitution),
    speedMultiplier: numberOrUndefined(material.speedMultiplier)
  };
}

function applyMaterialOptions(options, material) {
  if (!material) return;
  for (const key of ['friction', 'frictionStatic', 'frictionAir', 'restitution']) {
    if (material[key] !== undefined) options[key] = material[key];
  }
  if (material.speedMultiplier !== undefined) options.speedMultiplier = material.speedMultiplier;
  options.plugin = {
    ...(options.plugin || {}),
    physicsMaterial: material.name
  };
}

function numberOrUndefined(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export default PhysicsAddon;
