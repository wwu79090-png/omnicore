import { createOmniError } from '../core/OmniError.js';

/**
 * Shared MVP skeleton animation facade for Spine and DragonBones assets.
 */
export class SkeletalAnimation {
  constructor({
    format,
    url,
    atlas = null,
    skins = ['default'],
    runtime = null
  } = {}) {
    this.type = 'skeletal-animation';
    this.format = format;
    this.url = url;
    this.atlas = atlas;
    this.skins = new Set(skins);
    this.skin = skins[0] || 'default';
    this.runtime = runtime;
    this.currentAnimation = null;
    this.loop = false;
    this.timeScale = 1;
    this.elapsed = 0;
  }

  play(name, { loop = false, timeScale = this.timeScale } = {}) {
    if (!name) throw createOmniError('SkeletalAnimation', '骨骼动画名称不能为空。');
    this.currentAnimation = name;
    this.loop = loop;
    this.timeScale = timeScale;
    this.runtime?.play?.(name, { loop, timeScale });
    return this;
  }

  setSkin(name) {
    if (!this.skins.has(name)) this.skins.add(name);
    this.skin = name;
    this.runtime?.setSkin?.(name);
    return this;
  }

  update(deltaSeconds = 0) {
    this.elapsed += deltaSeconds * this.timeScale;
    this.runtime?.update?.(deltaSeconds, this);
    return this.elapsed;
  }

  toJSON() {
    return {
      type: this.type,
      format: this.format,
      url: this.url,
      atlas: this.atlas,
      skin: this.skin,
      animation: this.currentAnimation,
      loop: this.loop
    };
  }
}

export class SpineAdapter {
  create(config = {}) {
    return new SkeletalAnimation({ ...config, format: 'spine' });
  }
}

export class SpinePixiRuntimeAdapter {
  constructor({ pixi = null, spine = null, container = null } = {}) {
    this.pixi = pixi;
    this.spine = spine;
    this.container = container;
  }

  async create({
    alias = 'spine',
    skeleton,
    atlas,
    scale = 1,
    x = 0,
    y = 0,
    container = this.container,
    defaultMix = null
  } = {}) {
    if (!skeleton) throw createOmniError('SpinePixi', 'Spine skeleton 文件不能为空。');
    if (!atlas) throw createOmniError('SpinePixi', 'Spine atlas 文件不能为空。');
    const PIXI = this.pixi || await import('pixi.js');
    const spineRuntime = this.spine || await import('@esotericsoftware/spine-pixi');
    const SpineClass = spineRuntime.Spine || spineRuntime.default?.Spine || spineRuntime.default;
    if (typeof SpineClass !== 'function') {
      throw createOmniError('SpinePixi', '无法解析 @esotericsoftware/spine-pixi 的 Spine 构造器。');
    }

    const dataAlias = `${alias}Data`;
    const atlasAlias = `${alias}Atlas`;
    PIXI.Assets?.add?.({ alias: dataAlias, src: skeleton });
    PIXI.Assets?.add?.({ alias: atlasAlias, src: atlas });
    await PIXI.Assets?.load?.([dataAlias, atlasAlias]);

    const displayObject = new SpineClass({
      skeleton: dataAlias,
      atlas: atlasAlias,
      scale
    });
    displayObject.x = x;
    displayObject.y = y;
    if (defaultMix != null && displayObject.state?.data) {
      displayObject.state.data.defaultMix = defaultMix;
    }
    container?.addChild?.(displayObject);

    return {
      type: 'spine',
      format: 'spine-pixi',
      alias,
      skeleton,
      atlas,
      displayObject,
      play(name, loop = false) {
        const shouldLoop = typeof loop === 'object' ? Boolean(loop.loop) : Boolean(loop);
        displayObject.state?.setAnimation?.(0, name, shouldLoop);
        return this;
      },
      setSkin(name) {
        displayObject.skeleton?.setSkinByName?.(name);
        return this;
      },
      update(deltaSeconds = 0) {
        displayObject.update?.(deltaSeconds);
        return this;
      }
    };
  }
}

export class DragonBonesAdapter {
  create(config = {}) {
    return new SkeletalAnimation({ ...config, format: 'dragonbones' });
  }
}

export default SkeletalAnimation;
