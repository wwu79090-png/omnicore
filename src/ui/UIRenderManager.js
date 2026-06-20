import Rect from '../math/Rect.js';
import { sortByZIndex } from './UIElement.js';

/**
 * Dirty-rectangle renderer for Canvas UI surfaces.
 */
export class UIRenderManager {
  constructor({ padding = 0 } = {}) {
    this.padding = padding;
    this.tracked = new Set();
    this.dirtyRects = [];
  }

  track(element) {
    if (!element) return this;
    this.tracked.add(element);
    element.uiRenderManager = this;
    return this;
  }

  untrack(element) {
    this.tracked.delete(element);
    if (element?.uiRenderManager === this) element.uiRenderManager = null;
    return this;
  }

  markDirty(element, reason = 'state') {
    if (!element) return null;
    const rect = expandRect(element.bounds || new Rect(element.x, element.y, element.width, element.height), this.padding);
    this.dirtyRects.push({ rect, element, reason });
    element.dirty = true;
    return rect;
  }

  collectDirtyRects({ clear = true } = {}) {
    const rects = mergeRects(this.dirtyRects.map((entry) => entry.rect));
    if (clear) {
      this.dirtyRects.length = 0;
      for (const element of this.tracked) element.dirty = false;
    }
    return rects;
  }

  render(ctx, elements = Array.from(this.tracked), { force = false } = {}) {
    if (!ctx) return { rects: [], rendered: 0 };
    const rects = force
      ? [boundsForElements(elements)]
      : this.collectDirtyRects();
    const visibleRects = rects.filter((rect) => rect.width > 0 && rect.height > 0);
    let rendered = 0;

    for (const rect of visibleRects) {
      ctx.clearRect?.(rect.x, rect.y, rect.width, rect.height);
      ctx.save?.();
      ctx.beginPath?.();
      ctx.rect?.(rect.x, rect.y, rect.width, rect.height);
      ctx.clip?.();
      for (const element of sortByZIndex(elements)) {
        if (!element?.visible || !intersects(rect, element.bounds)) continue;
        if (element.renderCache && !element.renderCache.dirty) {
          ctx.drawImage?.(element.renderCache.canvas, element.x, element.y);
        } else {
          element.render?.(ctx);
        }
        rendered += 1;
      }
      ctx.restore?.();
    }

    return { rects: visibleRects, rendered };
  }

  cacheStatic(element, { createCanvas = defaultCanvasFactory } = {}) {
    const width = Math.max(1, Math.ceil(Number(element.width) || 1));
    const height = Math.max(1, Math.ceil(Number(element.height) || 1));
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext?.('2d');
    element.render?.(ctx);
    const cache = {
      canvas,
      width,
      height,
      dirty: false,
      element
    };
    element.renderCache = cache;
    return cache;
  }
}

function defaultCanvasFactory(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return {
    width,
    height,
    getContext: () => null
  };
}

function expandRect(rect, padding) {
  return new Rect(
    rect.x - padding,
    rect.y - padding,
    rect.width + padding * 2,
    rect.height + padding * 2
  );
}

function boundsForElements(elements) {
  const visible = elements.filter((element) => element?.visible);
  if (!visible.length) return new Rect(0, 0, 0, 0);
  const left = Math.min(...visible.map((element) => element.x));
  const top = Math.min(...visible.map((element) => element.y));
  const right = Math.max(...visible.map((element) => element.x + element.width));
  const bottom = Math.max(...visible.map((element) => element.y + element.height));
  return new Rect(left, top, right - left, bottom - top);
}

function intersects(left, right) {
  return Boolean(left && right)
    && left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

function mergeRects(rects) {
  return rects.filter(Boolean);
}

export default UIRenderManager;
