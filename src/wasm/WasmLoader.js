import { createOmniError, toOmniError } from '../core/OmniError.js';
import { OMNICORE_COMPUTE_WASM_BYTES } from './kernels/omnicore_compute.wasm.js';

/**
 * Small WebAssembly.instantiate facade with fetch and byte-array support.
 */
export class WasmLoader {
  constructor({
    instantiate = globalThis.WebAssembly?.instantiate?.bind(globalThis.WebAssembly),
    fetcher = globalThis.fetch?.bind(globalThis),
    defaultBytes = OMNICORE_COMPUTE_WASM_BYTES
  } = {}) {
    this.instantiateImpl = instantiate;
    this.fetcher = fetcher;
    this.defaultBytes = defaultBytes;
    this.loaded = false;
    this.instance = null;
    this.module = null;
    this.exports = null;
  }

  async instantiate(bytesOrUrl = this.defaultBytes, imports = {}) {
    if (!this.instantiateImpl) throw createOmniError('WASM', '当前环境不支持 WebAssembly.instantiate。');
    try {
      const bytes = await this._resolveBytes(bytesOrUrl);
      const result = await this.instantiateImpl(bytes, imports);
      this.instance = result.instance || result;
      this.module = result.module || null;
      this.exports = this.instance?.exports || {};
      this.loaded = true;
      return {
        instance: this.instance,
        module: this.module,
        exports: this.exports
      };
    } catch (error) {
      this.loaded = false;
      throw toOmniError(error, { module: 'WASM', message: 'WASM 模块实例化失败。' });
    }
  }

  async load(bytesOrUrl = this.defaultBytes, imports = {}) {
    return this.instantiate(bytesOrUrl, imports);
  }

  async _resolveBytes(bytesOrUrl) {
    if (typeof bytesOrUrl === 'string') {
      if (!this.fetcher) throw createOmniError('WASM', `无法加载 WASM 资源：${bytesOrUrl}`);
      const response = await this.fetcher(bytesOrUrl);
      if (!response.ok) throw createOmniError('WASM', `WASM 资源路径不存在：${bytesOrUrl}`);
      return response.arrayBuffer();
    }
    if (bytesOrUrl instanceof ArrayBuffer) return bytesOrUrl;
    if (ArrayBuffer.isView(bytesOrUrl)) {
      return bytesOrUrl.buffer.slice(bytesOrUrl.byteOffset, bytesOrUrl.byteOffset + bytesOrUrl.byteLength);
    }
    throw createOmniError('WASM', 'WASM 输入必须是 URL、ArrayBuffer 或 TypedArray。');
  }
}

export default WasmLoader;
