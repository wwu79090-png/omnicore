import { createOmniError } from '../core/OmniError.js';

/**
 * OffscreenCanvas-backed 2D renderer.
 *
 * The main thread only serializes high-level draw commands. A dedicated Worker
 * owns the canvas context after `transferControlToOffscreen()`.
 */
export class OffscreenCanvasRenderer {
  constructor({
    canvas,
    width = 800,
    height = 600,
    background = '#111827',
    workerFactory = defaultWorkerFactory,
    store = null,
    metrics = null
  } = {}) {
    this.backend = 'offscreen';
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.background = background;
    this.workerFactory = workerFactory;
    this.store = store;
    this.metrics = metrics;
    this.worker = null;
    this.offscreen = null;
    this.destroyed = false;
    this.lastCommands = [];
  }

  async init() {
    this.worker = this.workerFactory?.();
    if (!this.worker?.postMessage) throw createOmniError('Renderer', 'OffscreenCanvas renderer requires a Worker-compatible target.');
    this.offscreen = this.canvas?.transferControlToOffscreen?.();
    if (!this.offscreen) throw createOmniError('Renderer', 'Canvas transferControlToOffscreen() is not available.');
    this.offscreen.width = this.width;
    this.offscreen.height = this.height;
    this.worker.postMessage({
      type: 'init',
      canvas: this.offscreen,
      width: this.width,
      height: this.height,
      background: this.background
    }, [this.offscreen]);
    this.store?.injectBackend?.(this.backend);
    return this;
  }

  renderScene(scene) {
    if (!scene || this.destroyed) return;
    const started = now();
    const commands = serializeScene(scene, this.background);
    this.lastCommands = commands;
    this.worker?.postMessage?.({ type: 'render', commands });
    this.store?.set?.('renderer:drawCalls', commands.length);
    this.metrics?.record?.('renderer.offscreen.serialize', now() - started, { commands: commands.length });
  }

  render(scene) {
    this.renderScene(scene);
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.worker?.postMessage?.({ type: 'resize', width, height });
  }

  destroy() {
    this.destroyed = true;
    this.worker?.postMessage?.({ type: 'destroy' });
    this.worker?.terminate?.();
    this.worker = null;
    this.offscreen = null;
    this.canvas = null;
    this.lastCommands = [];
  }
}

export function serializeScene(scene, background = '#111827') {
  const commands = [{ type: 'clear', color: background }];
  const children = [...(scene.children || [])]
    .filter((child) => child?.visible !== false)
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  for (const child of children) {
    commands.push(...serializeChild(child));
  }

  return commands;
}

function serializeChild(child) {
  if (child.type === 'tilemap' || child.layers) return serializeTilemap(child);
  if (child.type === 'ui') return [serializeRect(child, '#1f2937')];
  if (child.type === 'mask' || child.mask) return [serializeMask(child)];
  if (child.type === 'sprite') return [serializeSprite(child)];
  if (child.renderCommand) return [child.renderCommand];
  return [serializeRect(child, child.color || '#38bdf8')];
}

function serializeTilemap(tilemap) {
  const commands = [];
  const tileWidth = tilemap.tileWidth || tilemap.tilewidth || 16;
  const tileHeight = tilemap.tileHeight || tilemap.tileheight || 16;

  for (const layer of tilemap.layers || []) {
    if (layer.visible === false || layer.type !== 'tilelayer') continue;
    const width = layer.width || tilemap.width || 0;
    for (let index = 0; index < (layer.data || []).length; index += 1) {
      const tile = layer.data[index];
      if (!tile) continue;
      commands.push({
        type: 'tile',
        tile,
        x: (index % width) * tileWidth,
        y: Math.floor(index / width) * tileHeight,
        width: tileWidth,
        height: tileHeight,
        alpha: layer.opacity ?? 1
      });
    }
  }

  return commands;
}

function serializeSprite(sprite) {
  return {
    type: 'sprite',
    texture: typeof sprite.texture === 'string' ? sprite.texture : null,
    x: sprite.x || 0,
    y: sprite.y || 0,
    width: sprite.width || 32,
    height: sprite.height || 32,
    alpha: sprite.alpha ?? 1,
    rotation: sprite.rotation || 0,
    scaleX: sprite.scaleX ?? 1,
    scaleY: sprite.scaleY ?? 1,
    fill: sprite.color || '#38bdf8'
  };
}

function serializeRect(rect, fill) {
  return {
    type: 'rect',
    x: rect.x || 0,
    y: rect.y || 0,
    width: rect.width || 0,
    height: rect.height || 0,
    alpha: rect.alpha ?? 1,
    fill
  };
}

function serializeMask(mask) {
  return {
    type: 'mask',
    mode: mask.mode || 'rect',
    x: mask.x || 0,
    y: mask.y || 0,
    width: mask.width || 0,
    height: mask.height || 0
  };
}

function defaultWorkerFactory() {
  if (typeof Worker === 'undefined') return null;
  const baseUrl = globalThis.__OMNICORE_WORKER_BASE_URL__
    || globalThis.document?.currentScript?.src
    || globalThis.location?.href
    || 'http://localhost/';
  return new Worker(new URL('./offscreen-render-worker.js', baseUrl), { type: 'module' });
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export default OffscreenCanvasRenderer;
