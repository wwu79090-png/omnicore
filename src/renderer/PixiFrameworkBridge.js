import { PixiTextureLifecycle } from './PixiTextureLifecycle.js';

export class PixiFrameworkBridge {
  constructor({
    scene = null,
    lifecycle = new PixiTextureLifecycle({ log: null }),
    log = console.info
  } = {}) {
    this.scene = scene;
    this.lifecycle = lifecycle;
    this.log = log;
    this.mounted = [];
    this.filterPresets = [];
  }

  mountDisplayObject(displayObject = {}, options = {}) {
    const entity = {
      id: options.id || displayObject.name || `pixi-${this.mounted.length + 1}`,
      name: displayObject.name || options.name || 'PixiObject',
      type: 'pixi-display-object',
      texture: displayObject.texture || options.texture || null,
      x: Number(displayObject.x ?? options.x ?? 0),
      y: Number(displayObject.y ?? options.y ?? 0),
      width: Number(displayObject.width ?? options.width ?? 0),
      height: Number(displayObject.height ?? options.height ?? 0),
      alpha: Number(displayObject.alpha ?? options.alpha ?? 1),
      rotation: Number(displayObject.rotation ?? options.rotation ?? 0),
      displayObject,
      filters: Array.isArray(displayObject.filters) ? [...displayObject.filters] : []
    };
    this.lifecycle.trackSprite(entity);
    if (this.scene?.add) this.scene.add(entity);
    else if (Array.isArray(this.scene?.children)) this.scene.children.push(entity);
    this.mounted.push(entity);
    return entity;
  }

  applyFilterPreset(target, preset, options = {}) {
    const record = {
      targetId: target?.id || target?.name || null,
      preset,
      options: { ...options }
    };
    this.filterPresets.push(record);
    if (target) {
      target.filterPresets = [...(target.filterPresets || []), record];
    }
    return record;
  }

  createFrameworkReport() {
    return {
      pixiObjectsMounted: this.mounted.length,
      filterPresetCount: this.filterPresets.length,
      textureRefs: this.mounted.map((entity) => ({
        id: entity.id,
        refCount: this.lifecycle.getRefCount(entity.texture)
      })),
      recommendations: [
        'Move Pixi containers into an OmniCore scene boundary before replacing app-level code.',
        'Use OmniCore lifecycle ownership for texture cleanup and render-loop control.',
        'Map Pixi filters to OmniCore filter presets so gameplay code stays renderer-neutral.'
      ]
    };
  }

  cleanup() {
    let destroyedDisplayObjects = 0;
    for (const entity of [...this.mounted]) {
      this.lifecycle.untrackSprite(entity);
      if (entity.displayObject?.destroy) {
        entity.displayObject.destroy({ children: true, texture: false, textureSource: false });
        destroyedDisplayObjects += 1;
      }
    }
    const cleanedTextures = this.lifecycle.cleanupUnusedTextures();
    this.mounted.length = 0;
    this.filterPresets.length = 0;
    this.log?.('[OmniCore] Pixi framework bridge cleaned up');
    return { destroyedDisplayObjects, cleanedTextures };
  }
}

export function createPixiFrameworkAdoptionPlan({
  usesFilters = false,
  usesTicker = false,
  usesTextureCache = false,
  usesContainers = false
} = {}) {
  const steps = [
    {
      id: 'wrap-display-objects',
      covered: Boolean(usesContainers),
      action: 'Mount Pixi display objects through PixiFrameworkBridge before migrating gameplay code.'
    },
    {
      id: 'replace-pixi-ticker',
      covered: Boolean(usesTicker),
      action: 'Drive updates from OmniCore Loop and disable Pixi shared ticker ownership.'
    },
    {
      id: 'track-texture-lifecycle',
      covered: Boolean(usesTextureCache),
      action: 'Move Pixi texture cache ownership into PixiTextureLifecycle.'
    },
    {
      id: 'map-filter-presets',
      covered: Boolean(usesFilters),
      action: 'Replace ad-hoc Pixi filter arrays with OmniCore filter presets.'
    }
  ];
  const covered = steps.filter((step) => step.covered).length;
  return {
    score: Math.round(70 + (covered / steps.length) * 30),
    steps,
    readyForOmniCoreLayer: covered >= 3
  };
}

export default PixiFrameworkBridge;
