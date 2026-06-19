/**
 * Web Audio wrapper with decoded sound pools.
 *
 * @example
 * const audio = new AudioManager();
 * await audio.load('click', '/audio/click.ogg');
 * audio.play('click', { volume: 0.5 });
 */
export class AudioManager {
  constructor({ context } = {}) {
    this.context = context || null;
    this.buffers = new Map();
    this.active = new Set();
    this.buses = new Map();
    this.ducking = new Map();
    this.presets = {
      uiClick: { type: 'square', frequency: 880, duration: 0.045, attack: 0.002, release: 0.04 },
      compileSuccess: { type: 'sine', frequency: 660, duration: 0.16, attack: 0.01, release: 0.12 },
      footstep: { type: 'triangle', frequency: 140, duration: 0.08, attack: 0.004, release: 0.06 }
    };
  }

  _ensureContext() {
    if (!this.context && typeof AudioContext !== 'undefined') this.context = new AudioContext();
    return this.context;
  }

  createBus(name, { volume = 1, parent = 'master' } = {}) {
    const context = this._ensureContext();
    if (!name) return null;
    if (name !== 'master' && parent === 'master' && !this.buses.has('master')) {
      this.createBus('master', { volume: 1, parent: null });
    }
    const gain = context?.createGain ? context.createGain() : null;
    const bus = {
      name,
      parent,
      gain,
      volume: Number(volume),
      effectiveVolume: Number(volume)
    };
    if (gain?.gain) gain.gain.value = bus.effectiveVolume;
    const target = parent ? this.buses.get(parent)?.gain || context?.destination : context?.destination;
    gain?.connect?.(target);
    this.buses.set(name, bus);
    return bus;
  }

  getBus(name = 'master') {
    return this.buses.get(name) || null;
  }

  setBusVolume(name, volume = 1) {
    const bus = this.buses.get(name) || this.createBus(name);
    bus.volume = Number(volume);
    this._applyBusVolume(name);
    return bus;
  }

  duck(name, { amount = 0.5, trigger = null } = {}) {
    const bus = this.buses.get(name) || this.createBus(name);
    const duck = {
      bus: name,
      trigger,
      amount: Math.max(0, Number(amount)),
      baseVolume: bus.volume
    };
    this.ducking.set(name, duck);
    this._applyBusVolume(name);
    return duck;
  }

  releaseDucking(name) {
    this.ducking.delete(name);
    const bus = this.buses.get(name);
    if (bus) this._applyBusVolume(name);
    return bus || null;
  }

  async load(key, url, fetcher = globalThis.fetch?.bind(globalThis)) {
    const context = this._ensureContext();
    if (!context || !fetcher) return null;
    const response = await fetcher(url);
    const data = await response.arrayBuffer();
    const buffer = await context.decodeAudioData(data);
    this.buffers.set(key, buffer);
    return buffer;
  }

  play(key, { volume = 1, loop = false, bus = null } = {}) {
    const context = this._ensureContext();
    const buffer = this.buffers.get(key);
    if (!context || !buffer) return null;
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = volume;
    source.buffer = buffer;
    source.loop = loop;
    source.omniBus = bus || 'destination';
    source.connect(gain);
    gain.connect(this._resolveOutput(bus));
    source.start();
    this.active.add(source);
    source.onended = () => this.active.delete(source);
    return source;
  }

  synthesize(name, { volume = 1, frequency, duration, type } = {}) {
    const context = this._ensureContext();
    const preset = this.presets[name] || this.presets.uiClick;
    if (!context?.createOscillator || !context?.createGain) return null;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime || 0;
    const length = duration ?? preset.duration;
    const releaseAt = start + length;

    oscillator.type = type || preset.type;
    oscillator.frequency.setValueAtTime(frequency ?? preset.frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.setValueAtTime(volume, start + (preset.attack || 0));
    gain.gain.exponentialRampToValueAtTime(0.0001, releaseAt);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(releaseAt + (preset.release || 0));
    this.active.add(oscillator);
    oscillator.onended = () => this.active.delete(oscillator);
    return oscillator;
  }

  stopAll() {
    for (const source of [...this.active]) source.stop?.();
    this.active.clear();
  }

  _resolveOutput(busName) {
    if (!busName) return this.context.destination;
    const bus = this.buses.get(busName) || this.createBus(busName);
    return bus?.gain || this.context.destination;
  }

  _applyBusVolume(name) {
    const bus = this.buses.get(name);
    if (!bus) return null;
    const duck = this.ducking.get(name);
    bus.effectiveVolume = bus.volume * (duck ? duck.amount : 1);
    if (bus.gain?.gain) {
      bus.gain.gain.setValueAtTime?.(bus.effectiveVolume, this.context?.currentTime || 0);
      bus.gain.gain.value = bus.effectiveVolume;
    }
    return bus;
  }
}

export default AudioManager;
