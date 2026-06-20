import { createOmniError } from '../core/OmniError.js';

export const RendererContract = Object.freeze({
  version: 'omnicore-renderer-contract/v1',
  requiredMethods: Object.freeze(['init', 'renderScene', 'resize', 'fade', 'destroy']),
  compatibleBackends: Object.freeze(['canvas', 'pixi', 'webgl', 'webgpu', 'offscreen'])
});

export function assertRendererBackend(renderer) {
  for (const method of RendererContract.requiredMethods) {
    if (typeof renderer?.[method] !== 'function') {
      throw createOmniError('RendererBackend', `Renderer backend missing method: ${method}`);
    }
  }
  return renderer;
}

export function createRendererPerformanceSandbox(samples = []) {
  const results = (Array.isArray(samples) ? samples : [])
    .map((sample) => ({
      name: sample.name || sample.backend || 'renderer',
      fps: Number(sample.fps || 0),
      powerMw: Number(sample.powerMw ?? sample.power ?? 0),
      score: Number(sample.fps || 0) - Number(sample.powerMw ?? sample.power ?? 0) / 100
    }))
    .sort((left, right) => right.score - left.score);
  return {
    contract: RendererContract.version,
    results,
    winner: results[0] || null
  };
}

export default assertRendererBackend;
