import {
  Container,
  Sprite as PixiSprite,
  Texture
} from 'pixi.js';
import Tween from '../tween/Tween.js';

const PART_ORDER = Object.freeze(['backArm', 'body', 'head', 'frontArm']);

const STATE_POSES = Object.freeze({
  idle: {
    body: { y: -2 },
    head: { y: -1, rotation: 0.018 },
    backArm: { rotation: -0.035 },
    frontArm: { rotation: 0.035 }
  },
  walk: {
    body: { y: -6 },
    head: { y: -4, rotation: 0.03 },
    backArm: { y: 3, rotation: 0.28 },
    frontArm: { y: -3, rotation: -0.28 }
  }
});

export class CharacterRig {
  constructor(config = {}) {
    this.config = config;
    this.anchor = normalizeAnchor(config.anchor);
    this.assetMap = config.assetMap || {};
    this.cache = config.cache || null;
    this.container = new Container();
    this.view = this.container;
    this.parts = {};
    this.basePose = {};
    this.tweens = [];
    this._state = 'idle';

    for (const part of PART_ORDER) this._createPart(part);
    this.state = config.state || 'idle';
  }

  get state() {
    return this._state;
  }

  set state(nextState) {
    const state = STATE_POSES[nextState] ? nextState : 'idle';
    if (this._state === state && this.tweens.length) return;
    this._state = state;
    this._restartTweens(state);
  }

  setPosition(x = 0, y = 0) {
    this.container.x = Number(x) || 0;
    this.container.y = Number(y) || 0;
    return this;
  }

  update(delta = 0) {
    const deltaMs = normalizeDeltaMs(delta);
    for (const tween of this.tweens) tween.update(deltaMs);
    return this;
  }

  destroy(options = {}) {
    for (const tween of this.tweens) tween.stop?.();
    this.tweens.length = 0;
    this.container.destroy?.({
      children: true,
      texture: options.texture === true,
      textureSource: options.textureSource === true
    });
  }

  _createPart(part) {
    const texture = this._resolveTexture(this.assetMap[part]);
    const sprite = new PixiSprite(texture);
    const partConfig = this.config.parts?.[part] || {};
    sprite.label = part;
    sprite.anchor?.set?.(partConfig.anchor?.x ?? this.anchor.x, partConfig.anchor?.y ?? this.anchor.y);
    sprite.x = Number(partConfig.x || 0);
    sprite.y = Number(partConfig.y || 0);
    sprite.rotation = Number(partConfig.rotation || 0);
    this.parts[part] = sprite;
    this.basePose[part] = {
      x: sprite.x,
      y: sprite.y,
      rotation: sprite.rotation
    };
    this.container.addChild(sprite);
    return sprite;
  }

  _resolveTexture(key) {
    if (!key) return this.cache?.get?.(key) || Texture.EMPTY;
    const texture = this.cache?.get?.(key);
    if (texture) return texture;
    try {
      return Texture.from(key);
    } catch {
      return Texture.EMPTY;
    }
  }

  _restartTweens(state) {
    for (const tween of this.tweens) tween.stop?.();
    this.tweens = [];
    for (const part of PART_ORDER) {
      const sprite = this.parts[part];
      const base = this.basePose[part];
      if (!sprite || !base) continue;
      sprite.x = base.x;
      sprite.y = base.y;
      sprite.rotation = base.rotation;
      const pose = STATE_POSES[state][part];
      if (!pose) continue;
      this.tweens.push(new Tween(sprite, {
        x: { from: base.x, to: pose.x ?? base.x },
        y: { from: base.y, to: pose.y ?? base.y },
        rotation: { from: base.rotation, to: pose.rotation ?? base.rotation },
        duration: state === 'walk' ? 260 : 900,
        ease: state === 'walk' ? 'inOutSine' : 'inOutCubic',
        yoyo: true,
        repeat: Infinity
      }));
    }
  }
}

function normalizeAnchor(anchor = {}) {
  return {
    x: Number(anchor.x ?? 0.5),
    y: Number(anchor.y ?? 0.5)
  };
}

function normalizeDeltaMs(delta) {
  const value = Math.max(0, Number(delta) || 0);
  return value <= 5 ? value * 1000 : value;
}

export default CharacterRig;
