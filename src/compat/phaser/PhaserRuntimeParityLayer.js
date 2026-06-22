import { createOmniError } from '../../core/OmniError.js';

export class PhaserRuntimeParityLayer {
  constructor() {
    this.scenes = new Map();
    this.activeScene = null;
    this.activeKey = null;
    this.arcadeBodies = [];
    this.arcade = {
      bodies: this.arcadeBodies,
      addBody: (target, options = {}) => this._addArcadeBody(target, options)
    };
    this.tilemaps = {
      createLayer: (options = {}) => createTileLayer(options)
    };
  }

  addScene(key, scene) {
    const sceneKey = String(key);
    this.scenes.set(sceneKey, scene || {});
    return this;
  }

  start(key, data = {}) {
    const sceneKey = String(key);
    const scene = this.scenes.get(sceneKey);
    if (!scene) {
      throw createOmniError('PhaserRuntimeParityLayer', `Scene not found: ${sceneKey}`, {
        code: 'OMNICORE_PHASER_SCENE_NOT_FOUND'
      });
    }
    this.activeKey = sceneKey;
    this.activeScene = scene;
    scene.init?.(data);
    scene.preload?.();
    scene.create?.();
    return scene;
  }

  step(delta = 0) {
    this.activeScene?.update?.(delta);
    for (const body of this.arcadeBodies) stepArcadeBody(body, delta);
    return {
      activeScene: this.activeKey,
      bodyCount: this.arcadeBodies.length
    };
  }

  _addArcadeBody(target = {}, options = {}) {
    const body = {
      target,
      velocity: vec2(options.velocity),
      gravity: vec2(options.gravity),
      immovable: Boolean(options.immovable),
      collideWorldBounds: Boolean(options.collideWorldBounds),
      worldBounds: options.worldBounds || null
    };
    target.body = body;
    this.arcadeBodies.push(body);
    return body;
  }
}

function stepArcadeBody(body, delta) {
  if (body.immovable) return;
  body.velocity.x += body.gravity.x * delta;
  body.velocity.y += body.gravity.y * delta;
  body.target.x = clampNumber((body.target.x || 0) + body.velocity.x * delta);
  body.target.y = clampNumber((body.target.y || 0) + body.velocity.y * delta);
  if (body.collideWorldBounds && body.worldBounds) clampToWorldBounds(body);
}

function clampToWorldBounds(body) {
  const bounds = body.worldBounds;
  const maxX = (bounds.x || 0) + (bounds.width || 0) - (body.target.width || 0);
  const maxY = (bounds.y || 0) + (bounds.height || 0) - (body.target.height || 0);
  body.target.x = Math.min(Math.max(body.target.x, bounds.x || 0), maxX);
  body.target.y = Math.min(Math.max(body.target.y, bounds.y || 0), maxY);
}

function createTileLayer({ width = 0, height = 0, tileWidth = 16, tileHeight = 16, data = [] } = {}) {
  return {
    width,
    height,
    tileWidth,
    tileHeight,
    data: [...data],
    worldToTile(worldX, worldY) {
      const x = Math.floor(worldX / tileWidth);
      const y = Math.floor(worldY / tileHeight);
      return {
        x,
        y,
        index: this.data[y * width + x] ?? -1
      };
    },
    getTileAt(x, y) {
      return this.data[y * width + x] ?? -1;
    }
  };
}

function vec2(value = {}) {
  return {
    x: Number(value.x) || 0,
    y: Number(value.y) || 0
  };
}

function clampNumber(value) {
  if (Math.abs(value) < 1e-12) return 0;
  return Number(value.toFixed(12));
}

export default PhaserRuntimeParityLayer;
