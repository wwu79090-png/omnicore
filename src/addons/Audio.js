import { createOmniError } from '../core/OmniError.js';

/**
 * Optional Web Audio addon for microkernel mode.
 */
export class AudioAddon {
  constructor({ AudioContextRef = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
    this.name = 'audio';
    this.AudioContextRef = AudioContextRef;
    this.ctx = null;
    this.sounds = new Map();
  }

  init() {
    if (!this.AudioContextRef) throw createOmniError('Audio', 'Web Audio API 不可用，无法初始化音频插件。');
    this.ctx = this.ctx || new this.AudioContextRef();
    return this;
  }

  async load(key, url, fetcher = globalThis.fetch?.bind(globalThis)) {
    if (!this.ctx) this.init();
    const response = await fetcher(url);
    if (!response.ok) throw createOmniError('Audio', `音频资源加载失败：${url}`);
    const buffer = await response.arrayBuffer();
    const decoded = await this.ctx.decodeAudioData(buffer);
    this.sounds.set(key, decoded);
    return decoded;
  }

  play(key, loop = false) {
    const buffer = this.sounds.get(key);
    if (!buffer || !this.ctx) return null;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(this.ctx.destination);
    source.start();
    return source;
  }

  destroy() {
    this.ctx?.close?.();
    this.ctx = null;
    this.sounds.clear();
  }
}

export default AudioAddon;
