import { ColorMatrixFilter, NoiseFilter } from 'pixi.js';
import { AdvancedBloomFilter, AdjustmentFilter, GlitchFilter } from 'pixi-filters';

/**
 * PixiJS v8 filter helpers.
 *
 * @example
 * const bloom = createBloomFilter({ threshold: 0.4, bloomScale: 1.2 });
 * renderer.applyFilter(sprite, bloom);
 */
export function appendFilter(target, filter) {
  if (!target) return filter;
  const current = target.filters ? (Array.isArray(target.filters) ? target.filters : [target.filters]) : [];
  target.filters = [...current, filter];
  return filter;
}

export function createBloomFilter(options = {}) {
  return new AdvancedBloomFilter({
    threshold: 0.35,
    bloomScale: 1.15,
    brightness: 1,
    blur: 4,
    quality: 5,
    ...options
  });
}

export function createAdjustmentFilter(options = {}) {
  return new AdjustmentFilter({
    gamma: 1,
    saturation: 1,
    contrast: 1,
    brightness: 1,
    red: 1,
    green: 1,
    blue: 1,
    alpha: 1,
    ...options
  });
}

export function createGlitchFilter(options = {}) {
  return new GlitchFilter({ slices: 6, offset: 8, direction: 0, ...options });
}

export function createColorMatrixFilter(matrix) {
  const filter = new ColorMatrixFilter();
  if (Array.isArray(matrix)) filter.matrix = matrix;
  return filter;
}

export function createNoiseFilter(options = {}) {
  return new NoiseFilter(options);
}
