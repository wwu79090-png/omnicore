/**
 * Debug inspector registry.
 *
 * When `debug: true`, `OmniCore.lookup(name)` becomes available globally for
 * inspecting the current game, renderer, store, loader, and scene.
 *
 * @example
 * const inspector = new Inspector(game);
 * inspector.attach();
 * globalThis.OmniCore.lookup('renderer');
 */
export class Inspector {
  constructor(game) {
    this.game = game;
    this.registry = new Map();
  }

  attach() {
    this.register('game', this.game);
    this.register('renderer', this.game.renderer);
    this.register('store', this.game.store);
    this.register('loader', this.game.loader);
    globalThis.OmniCore = {
      ...(globalThis.OmniCore || {}),
      lookup: (name) => this.lookup(name)
    };
  }

  register(name, value) {
    this.registry.set(name, value);
  }

  lookup(name) {
    if (name === 'scene') return this.game.scene?.current || null;
    if (name === 'renderer') return this.game.renderer;
    return this.registry.get(name);
  }

  detach() {
    if (globalThis.OmniCore?.lookup) delete globalThis.OmniCore.lookup;
    this.registry.clear();
  }
}

export default Inspector;
