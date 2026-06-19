import { Scene, Sprite } from '../../scene/Scene.js';

export class PhaserCompatScene {
  constructor({
    key = 'scene',
    preload = null,
    create = null,
    update = null,
    scene = new Scene(key)
  } = {}) {
    this.key = key;
    this.scene = scene;
    this.assets = [];
    this.physicsBodies = [];
    this.colliders = [];
    this.inputBindings = [];
    this.tweens = [];
    this.preloadCallback = preload;
    this.createCallback = create;
    this.updateCallback = update;
    this.load = createLoader(this.assets);
    this.add = createDisplayFactory(this.scene);
    this.physics = createPhysicsFacade(this.scene, this.physicsBodies, this.colliders);
    this.input = createInputFacade(this.inputBindings);
    this.tweens = createTweenFacade(this.tweens);
  }

  async boot() {
    this.preloadCallback?.call(this);
    await this.scene.preload?.();
    this.createCallback?.call(this);
    this.scene.created = true;
    await this.scene.create?.();
    return this;
  }

  update(delta = 0, time = 0) {
    this.updateCallback?.call(this, time, delta);
    this.scene.update?.(delta, time);
  }

  toMigrationEvidence() {
    return {
      key: this.key,
      assets: this.assets.map((asset) => ({ ...asset })),
      sprites: this.scene.children.length,
      physicsBodies: this.physicsBodies.length,
      colliders: this.colliders.length,
      inputBindings: this.inputBindings.length,
      tweens: this.tweens.records.length
    };
  }
}

export function createPhaserCompatScene(options = {}) {
  return new PhaserCompatScene(options);
}

function createLoader(assets) {
  return {
    image(key, url) {
      assets.push({ type: 'image', key, url });
      return this;
    },
    spritesheet(key, url, options = {}) {
      assets.push({ type: 'spritesheet', key, url, options: { ...options } });
      return this;
    },
    atlas(key, textureUrl, atlasUrl) {
      assets.push({ type: 'atlas', key, textureUrl, atlasUrl });
      return this;
    },
    audio(key, url) {
      assets.push({ type: 'audio', key, url });
      return this;
    }
  };
}

function createDisplayFactory(scene) {
  return {
    sprite(x = 0, y = 0, texture = 'sprite', options = {}) {
      const sprite = new Sprite(texture, { ...options, x, y });
      sprite.key = texture;
      return scene.add(sprite);
    },
    image(x = 0, y = 0, texture = 'image', options = {}) {
      const sprite = new Sprite(texture, { ...options, x, y, label: options.label ?? false });
      sprite.key = texture;
      return scene.add(sprite);
    },
    existing(child) {
      return scene.add(child);
    }
  };
}

function createPhysicsFacade(scene, physicsBodies, colliders) {
  const add = {
    sprite(x = 0, y = 0, texture = 'sprite', options = {}) {
      const sprite = new Sprite(texture, { ...options, x, y });
      sprite.key = texture;
      sprite.body = {
        type: 'arcade',
        velocity: { x: 0, y: 0 },
        immovable: Boolean(options.immovable),
        allowGravity: options.allowGravity ?? true
      };
      sprite.setVelocityX = (value) => {
        sprite.body.velocity.x = Number(value) || 0;
        return sprite;
      };
      sprite.setVelocityY = (value) => {
        sprite.body.velocity.y = Number(value) || 0;
        return sprite;
      };
      scene.add(sprite);
      physicsBodies.push({ key: texture, sprite, arcade: true, body: sprite.body });
      return sprite;
    },
    collider(left, right, callback = null, process = null, context = null) {
      const collider = { left, right, callback, process, context, type: 'arcade-collider' };
      colliders.push(collider);
      return collider;
    },
    overlap(left, right, callback = null, process = null, context = null) {
      const overlap = { left, right, callback, process, context, type: 'arcade-overlap' };
      colliders.push(overlap);
      return overlap;
    }
  };
  return { add, world: { colliders, bodies: physicsBodies } };
}

function createInputFacade(inputBindings) {
  const keyboard = {
    on(event, handler) {
      const binding = { device: 'keyboard', event, handler };
      inputBindings.push(binding);
      return binding;
    },
    addKey(key) {
      const binding = { device: 'keyboard', key, isDown: false };
      inputBindings.push(binding);
      return binding;
    }
  };
  return { keyboard };
}

function createTweenFacade(records) {
  records.records = records;
  records.add = (config = {}) => {
    const tween = { ...config, type: 'tween' };
    records.push(tween);
    return tween;
  };
  records.timeline = (config = {}) => {
    const timeline = { ...config, type: 'timeline' };
    records.push(timeline);
    return timeline;
  };
  return records;
}

export default {
  PhaserCompatScene,
  createPhaserCompatScene
};
