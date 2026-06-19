import { describe, expect, it, vi } from 'vitest';
import {
  ElectronNativeBridge,
  RendererManager,
  WebGPURenderer
} from '../src/index.js';
import { assertRendererBackend } from '../src/renderer/RendererBackend.js';

describe('renderer backend MVP', () => {
  it('validates the shared renderer backend contract', () => {
    const renderer = {
      init: vi.fn(),
      renderScene: vi.fn(),
      resize: vi.fn(),
      fade: vi.fn(),
      destroy: vi.fn()
    };

    expect(assertRendererBackend(renderer)).toBe(renderer);
    expect(() => assertRendererBackend({ init() {} })).toThrow(/renderScene/);
  });

  it('falls back when WebGPU is not available', async () => {
    const canvasRenderer = {
      backend: 'canvas',
      init: vi.fn(),
      renderScene: vi.fn(),
      resize: vi.fn(),
      fade: vi.fn(),
      destroy: vi.fn()
    };
    const manager = new RendererManager({
      fallbackOrder: ['webgpu', 'canvas'],
      createRenderer: (backend) => (backend === 'webgpu'
        ? new WebGPURenderer({ canvas: document.createElement('canvas'), navigatorRef: {} })
        : canvasRenderer)
    });

    const renderer = await manager.create('auto');

    expect(manager.attempts).toEqual(['webgpu', 'canvas']);
    expect(renderer.backend).toBe('canvas');
  });

  it('reports Electron Direct3D and Vulkan native bridge capabilities without forcing WebGL', () => {
    const bridge = new ElectronNativeBridge({
      processRef: { versions: { electron: '33.0.0' }, platform: 'win32' }
    });

    expect(bridge.detect()).toMatchObject({
      electron: true,
      preferredBackend: 'native',
      drivers: expect.arrayContaining(['direct3d', 'vulkan'])
    });
  });
});
