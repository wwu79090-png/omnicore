/**
 * Web Audio addon with external sound hooks and a small synth helper.
 */
export class AudioAddon {
  constructor({ audioContext = null } = {}) {
    this.context = audioContext;
    this.buffers = new Map();
  }

  mount() {
    const AudioContextRef = globalThis.AudioContext || globalThis.webkitAudioContext;
    this.context = this.context || (AudioContextRef ? new AudioContextRef() : null);
    return this;
  }

  async load(name, url, fetcher = globalThis.fetch?.bind(globalThis)) {
    if (!this.context || !fetcher) return null;
    const buffer = await fetcher(url).then((response) => response.arrayBuffer());
    const decoded = await this.context.decodeAudioData(buffer);
    this.buffers.set(name, decoded);
    return decoded;
  }

  play(name) {
    const buffer = this.buffers.get(name);
    if (!this.context || !buffer) return null;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    source.start();
    return source;
  }

  playSynth({ frequency = 440, duration = 0.15, type = 'sine', gain = 0.08 } = {}) {
    if (!this.context) return null;
    const oscillator = this.context.createOscillator();
    const volume = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    volume.gain.value = gain;
    oscillator.connect(volume).connect(this.context.destination);
    oscillator.start();
    oscillator.stop(this.context.currentTime + duration);
    return oscillator;
  }

  unmount() {
    this.context?.close?.();
    this.context = null;
    this.buffers.clear();
  }
}

export default AudioAddon;
