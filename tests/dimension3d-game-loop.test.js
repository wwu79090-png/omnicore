import { afterEach, describe, expect, it, vi } from 'vitest';

const dimensionState = vi.hoisted(() => ({
  instances: [],
  reset() {
    this.instances = [];
  }
}));

vi.mock('../src/dimension3d/Dimension3D.js', () => ({
  default: class MockDimension3D {
    constructor(config) {
      this.config = config;
      this.init = vi.fn(async () => this);
      this.render = vi.fn();
      this.destroy = vi.fn();
      dimensionState.instances.push(this);
    }
  }
}));

const { default: OmniCore } = await import('../src/index.js');

describe('Dimension3D Game loop binding', () => {
  afterEach(() => {
    dimensionState.reset();
    document.body.innerHTML = '';
  });

  it('renders the decorative 3D background from the main Game loop', async () => {
    const game = new OmniCore.Game({
      renderer: 'canvas',
      autoStart: false,
      autoAttach: false,
      dimension3D: {
        decorativeModel: { url: '/models/cyberpunk-city.glb' }
      }
    });

    await game.init();
    game.loop.subscribers.forEach((handler) => handler(1 / 60, 16, 1));

    expect(dimensionState.instances).toHaveLength(1);
    expect(dimensionState.instances[0].init).toHaveBeenCalledTimes(1);
    expect(dimensionState.instances[0].render).toHaveBeenCalledWith(1 / 60);

    game.destroy();

    expect(dimensionState.instances[0].destroy).toHaveBeenCalledTimes(1);
  });
});
