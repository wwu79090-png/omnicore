import { createOmniError } from '../core/OmniError.js';

const PLACEHOLDER_DURATION_SECONDS = 0.045;
const PLACEHOLDER_FREQUENCY = 220;
const PLACEHOLDER_GAIN = 0.004;

/**
 * Optional Web Audio addon for microkernel mode.
 */
export class AudioAddon {
  constructor({
    AudioContextRef = globalThis.AudioContext || globalThis.webkitAudioContext,
    debug = false,
    logger = globalThis.console
  } = {}) {
    this.name = 'audio';
    this.AudioContextRef = AudioContextRef;
    this.debug = Boolean(debug);
    this.logger = logger;
    this.ctx = null;
    this.sounds = new Map();
  }

  init() {
    if (!this.AudioContextRef) throw createOmniError('Audio', 'Web Audio API 不可用，无法初始化音频插件。');
    this.ctx = this.ctx || new this.AudioContextRef();
    return this;
  }

  async load(key, url, fetcher = globalThis.fetch?.bind(globalThis)) {
    return this.loadAudio(key, url, fetcher);
  }

  async loadAudio(key, url, fetcher = globalThis.fetch?.bind(globalThis)) {
    if (!this.ctx) this.init();
    try {
      if (!fetcher) throw createOmniError('Audio', '音频资源加载失败：缺少 fetch 实现。');
      const response = await fetcher(url);
      if (response?.ok === false) throw createOmniError('Audio', `音频资源加载失败：${url}`);
      const buffer = await response.arrayBuffer();
      const decoded = await this.ctx.decodeAudioData(buffer);
      this.sounds.set(key, decoded);
      return decoded;
    } catch {
      const placeholder = this._createMissingAudioPlaceholder();
      this.sounds.set(key, placeholder);
      if (this.debug) {
        this.logger?.warn?.(`[OmniCore] 音效 [${key}] 加载失败，已替换为静音占位。`);
      }
      return placeholder;
    }
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

  _createMissingAudioPlaceholder() {
    const sampleRate = Number(this.ctx?.sampleRate) || 44100;
    const length = Math.max(1, Math.round(sampleRate * PLACEHOLDER_DURATION_SECONDS));
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const channel = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < length; index += 1) {
      const t = index / sampleRate;
      const envelope = Math.sin((Math.PI * index) / Math.max(1, length - 1));
      const raw = Math.sin(2 * Math.PI * PLACEHOLDER_FREQUENCY * t) * PLACEHOLDER_GAIN * envelope;
      const lowPassed = previous + (raw - previous) * 0.12;
      previous = lowPassed;
      channel[index] = Math.abs(lowPassed) < 0.00002 ? 0 : lowPassed;
    }
    try {
      Object.defineProperty(buffer, 'omnicorePlaceholder', { value: 'missing-audio', configurable: true });
    } catch {
      // Native AudioBuffer objects may be non-extensible in some runtimes.
    }
    return buffer;
  }
}

export default AudioAddon;
