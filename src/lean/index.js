import Bootstrap, { detectPlatform } from './core/Bootstrap.js';
import EventBus from './core/EventBus.js';
import Store from './core/Store.js';
import Audio from './addons/Audio.js';
import DevTools from './addons/DevTools.js';
import Input from './addons/Input.js';
import Physics from './addons/Physics.js';
import Renderer from './addons/Renderer.js';
import Resources from './addons/Resources.js';
import Scene from './addons/Scene.js';
import Storage from './addons/Storage.js';

export const Core = {
  Bootstrap,
  EventBus,
  Store
};

export const Addons = {
  Audio,
  DevTools,
  Input,
  Physics,
  Renderer,
  Resources,
  Scene,
  Storage
};

/**
 * Creates the addon-driven lean OmniCore runtime.
 *
 * @example
 * const runtime = await createLeanRuntime({ renderer: { backend: 'canvas' } });
 * runtime.addons.renderer.drawRect({ x: 10, y: 10, width: 32, height: 32 });
 */
export async function createLeanRuntime(config = {}) {
  const bootstrap = new Bootstrap({
    debug: Boolean(config.debug),
    version: config.version || '1.0.0',
    addons: {
      renderer: (options) => new Renderer(options),
      audio: (options) => new Audio(options),
      physics: (options) => new Physics(options),
      scene: (options) => new Scene(options),
      resources: (options) => new Resources(options),
      input: (options) => new Input(options),
      devtools: (options) => new DevTools({ enabled: config.debug, ...options }),
      storage: (options) => new Storage(options)
    }
  });
  await bootstrap.start({
    ...config,
    renderer: {
      backend: config.renderer?.backend || config.renderer || 'auto',
      ...(typeof config.renderer === 'object' ? config.renderer : {})
    },
    devtools: {
      enabled: Boolean(config.debug),
      ...(config.devtools || {})
    }
  });
  return {
    core: bootstrap,
    addons: bootstrap.addons,
    platform: bootstrap.store.get('omnicore:platform'),
    destroy: () => bootstrap.destroy()
  };
}

export { Bootstrap, EventBus, Store, detectPlatform };
export { Audio, DevTools, Input, Physics, Renderer, Resources, Scene, Storage };

export default {
  Core,
  Addons,
  createLeanRuntime,
  detectPlatform
};
