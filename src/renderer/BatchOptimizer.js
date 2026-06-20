/**
 * Pixi sprite batch analyzer.
 *
 * Pixi's BatchRenderer can merge sprites when they share the same texture
 * source and render state. This helper keeps OmniCore's scene sync aligned
 * with those constraints and exposes deterministic draw-call telemetry for
 * tests, debug panels, and benchmark thresholds.
 */
export class BatchOptimizer {
  constructor({ fpsTarget = 60, roundPixels = false } = {}) {
    this.fpsTarget = fpsTarget;
    this.roundPixels = Boolean(roundPixels);
  }

  analyze(children = [], displayRecords = new Map()) {
    const batchKeys = new Set();
    let spriteCount = 0;
    let nonBatchableCount = 0;

    for (const child of children) {
      const displayObject = this._displayObjectFor(child, displayRecords);
      if (!displayObject || displayObject.visible === false || displayObject.renderable === false) continue;
      this.prepare(displayObject, child);
      if (!this.isBatchableSprite(displayObject, child)) {
        nonBatchableCount += 1;
        continue;
      }
      spriteCount += 1;
      batchKeys.add(this.batchKey(displayObject, child));
    }

    const batchCount = batchKeys.size;
    const drawCalls = batchCount + nonBatchableCount;
    return {
      drawCalls,
      batchCount,
      spriteCount,
      nonBatchableCount,
      fpsTarget: drawCalls <= 1 ? this.fpsTarget : Math.max(1, this.fpsTarget - drawCalls + 1),
      batchKeys: [...batchKeys]
    };
  }

  prepare(displayObject, child = {}) {
    if ('eventMode' in displayObject && !child.interactive && !child.eventMode) displayObject.eventMode = 'none';
    if ('roundPixels' in displayObject) displayObject.roundPixels = child.roundPixels ?? this.roundPixels;
    displayObject.__omnicoreBatchKey = this.isBatchableSprite(displayObject, child)
      ? this.batchKey(displayObject, child)
      : null;
    return displayObject;
  }

  isBatchableSprite(displayObject, child = {}) {
    const hasTexture = Boolean(displayObject.texture || child.texture || child.atlasKey || child.atlas);
    const looksLikeSprite = child.type === 'sprite' || hasTexture || displayObject.isSprite;
    if (!looksLikeSprite || !hasTexture) return false;
    if (displayObject.mask || child.mask) return false;
    if (displayObject.filters?.length || child.filters?.length) return false;
    if (displayObject.shader || child.shader) return false;
    return true;
  }

  batchKey(displayObject, child = {}) {
    return [
      this.textureSourceKey(displayObject.texture, child),
      displayObject.blendMode ?? child.blendMode ?? 'normal',
      displayObject.pluginName ?? child.pluginName ?? 'batch'
    ].join('|');
  }

  textureSourceKey(texture, child = {}) {
    if (child.batchKey) return child.batchKey;
    if (child.atlasKey) return `atlas:${child.atlasKey}`;
    if (child.atlas) return `atlas:${child.atlas}`;
    const source = texture?.source || texture?.baseTexture || texture?.textureSource;
    if (source?.uid != null) return `source:${source.uid}`;
    if (source?.label) return `source:${source.label}`;
    if (source?.resource?.url) return `source:${source.resource.url}`;
    if (texture?.label) return `texture:${texture.label}`;
    if (texture?.uid != null) return `texture:${texture.uid}`;
    return `texture:${String(child.texture || 'empty')}`;
  }

  _displayObjectFor(child, displayRecords) {
    if (child?.__omnicoreDisplayKey && displayRecords.has(child.__omnicoreDisplayKey)) {
      return displayRecords.get(child.__omnicoreDisplayKey)?.displayObject || child.displayObject;
    }
    return child?.displayObject || null;
  }
}

export default BatchOptimizer;
