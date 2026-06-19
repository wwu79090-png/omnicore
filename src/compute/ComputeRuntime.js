import calculateDamage from './DamageFormula.js';
import findPath from './Pathfinding.js';
import WasmLoader from '../wasm/WasmLoader.js';

/**
 * Compute facade for high-frequency gameplay logic.
 */
export class ComputeRuntime {
  constructor({
    wasmLoader = new WasmLoader(),
    enableWasm = true
  } = {}) {
    this.wasmLoader = wasmLoader;
    this.enableWasm = enableWasm;
    this.ready = false;
    this.exports = null;
  }

  async init() {
    if (!this.enableWasm || !this.wasmLoader) {
      this.ready = true;
      return this;
    }
    try {
      const result = await this.wasmLoader.instantiate();
      this.exports = result.exports || result.instance?.exports || {};
    } catch {
      this.exports = null;
    }
    this.ready = true;
    return this;
  }

  damage(input = {}) {
    const multiplier100 = input.multiplier100 ?? Math.round((input.multiplier ?? 1) * 100);
    if (typeof this.exports?.damage === 'function') {
      return Math.max(0, this.exports.damage(
        Math.round(input.base || 0),
        Math.round(input.attack || 0),
        Math.round(input.defense || 0),
        multiplier100
      ));
    }
    return calculateDamage({ ...input, multiplier100 });
  }

  findPath(input = {}) {
    const manhattan = typeof this.exports?.manhattan === 'function' ? this.exports.manhattan : null;
    return findPath(input, { manhattan });
  }
}

export default ComputeRuntime;
