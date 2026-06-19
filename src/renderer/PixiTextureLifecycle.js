const CLEANUP_MESSAGE_PREFIX = '[OmniCore] 已清理未使用纹理';

function textureFromSprite(spriteOrTexture) {
  return spriteOrTexture?.texture || spriteOrTexture || null;
}

/**
 * Reference-counted Pixi texture lifecycle guard.
 */
export class PixiTextureLifecycle {
  constructor({ log = console.info } = {}) {
    this.log = log;
    this.refs = new Map();
    this.spriteTextures = new WeakMap();
  }

  attachTexture(texture, sprite = null) {
    if (!texture) return 0;
    if (sprite) {
      const previous = this.spriteTextures.get(sprite);
      if (previous === texture) return this.getRefCount(texture);
      if (previous) this.detachTexture(previous, sprite);
      this.spriteTextures.set(sprite, texture);
    }
    const record = this.refs.get(texture) || { count: 0, destroyed: false };
    record.count += 1;
    this.refs.set(texture, record);
    return record.count;
  }

  detachTexture(texture, sprite = null) {
    if (!texture) return 0;
    const record = this.refs.get(texture);
    if (!record) {
      if (sprite) this.spriteTextures.delete(sprite);
      return 0;
    }
    if (sprite && this.spriteTextures.get(sprite) === texture) this.spriteTextures.delete(sprite);
    record.count = Math.max(0, record.count - 1);
    return record.count;
  }

  trackSprite(sprite) {
    const texture = textureFromSprite(sprite);
    return this.attachTexture(texture, sprite);
  }

  untrackSprite(sprite) {
    const texture = this.spriteTextures.get(sprite) || textureFromSprite(sprite);
    return this.detachTexture(texture, sprite);
  }

  cleanupScene(scene = {}) {
    const sprites = scene.sprites
      || scene.children
      || scene.entities
      || [];
    for (const sprite of sprites) this.untrackSprite(sprite);
    return this.cleanupUnusedTextures();
  }

  cleanupUnusedTextures() {
    let cleaned = 0;
    for (const [texture, record] of [...this.refs.entries()]) {
      if (record.count > 0 || record.destroyed) continue;
      texture?.destroy?.(true);
      record.destroyed = true;
      this.refs.delete(texture);
      cleaned += 1;
    }
    this.log?.(`${CLEANUP_MESSAGE_PREFIX} ${cleaned} 张`);
    return cleaned;
  }

  getRefCount(texture) {
    return this.refs.get(texture)?.count || 0;
  }

  clear() {
    this.refs.clear();
    this.spriteTextures = new WeakMap();
  }
}

export const DEFAULT_PIXI_TEXTURE_LIFECYCLE = new PixiTextureLifecycle();

export function attachTexture(texture, sprite = null, lifecycle = DEFAULT_PIXI_TEXTURE_LIFECYCLE) {
  return lifecycle.attachTexture(texture, sprite);
}

export function detachTexture(texture, sprite = null, lifecycle = DEFAULT_PIXI_TEXTURE_LIFECYCLE) {
  return lifecycle.detachTexture(texture, sprite);
}

export function cleanupUnusedTextures(lifecycle = DEFAULT_PIXI_TEXTURE_LIFECYCLE) {
  return lifecycle.cleanupUnusedTextures();
}

export function getTextureRefCount(texture, lifecycle = DEFAULT_PIXI_TEXTURE_LIFECYCLE) {
  return lifecycle.getRefCount(texture);
}

export default DEFAULT_PIXI_TEXTURE_LIFECYCLE;
