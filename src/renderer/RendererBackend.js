import { createOmniError } from '../core/OmniError.js';

export function assertRendererBackend(renderer) {
  for (const method of ['init', 'renderScene', 'resize', 'fade', 'destroy']) {
    if (typeof renderer?.[method] !== 'function') {
      throw createOmniError('RendererBackend', `Renderer backend missing method: ${method}`);
    }
  }
  return renderer;
}

export default assertRendererBackend;
