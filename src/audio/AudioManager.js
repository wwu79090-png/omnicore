/**
 * Web Audio wrapper with decoded sound pools.
 *
 * @example
 * const audio = new AudioManager();
 * await audio.load('click', '/audio/click.ogg');
 * audio.play('click', { volume: 0.5 });
 */
export class AudioManager {
  constructor({ context, limiter = true, limiterSettings = {} } = {}) {
    this.context = context || null;
    this.limiterEnabled = limiter !== false;
    this.limiterSettings = {
      threshold: -12,
      knee: 18,
      ratio: 12,
      attack: 0.003,
      release: 0.18,
      ...limiterSettings
    };
    this.outputNode = null;
    this.compressor = null;
    this.buffers = new Map();
    this.active = new Set();
    this.buses = new Map();
    this.ducking = new Map();
    this.pools = new Map();
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

  _ensureOutputNode() {
    const context = this._ensureContext();
    if (!context) return null;
    if (this.outputNode) return this.outputNode;
    if (!this.limiterEnabled || typeof context.createDynamicsCompressor !== 'function') {
      this.outputNode = context.destination;
      return this.outputNode;
    }
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = this.limiterSettings.threshold;
    compressor.knee.value = this.limiterSettings.knee;
    compressor.ratio.value = this.limiterSettings.ratio;
    compressor.attack.value = this.limiterSettings.attack;
    compressor.release.value = this.limiterSettings.release;
    compressor.connect(context.destination);
    this.compressor = compressor;
    this.outputNode = compressor;
    return this.outputNode;
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
    const target = parent ? this.buses.get(parent)?.gain || this._ensureOutputNode() : this._ensureOutputNode();
    gain?.connect?.(target);
    this.buses.set(name, bus);
    return bus;
  }

  getBus(name = 'master') {
    return this.buses.get(name) || null;
  }

  setMasterVolume(volume = 1) {
    return this.setBusVolume('master', volume);
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
    source.omniGain = gain;
    source.omniVolume = Number(volume);
    source.connect(gain);
    gain.connect(this._resolveOutput(bus));
    source.start();
    this.active.add(source);
    source.onended = () => this.active.delete(source);
    return source;
  }

  createPool(key, {
    size = 4,
    bus = null,
    volume = 1,
    loop = false
  } = {}) {
    const pool = {
      key,
      size: Math.max(1, Number(size) || 1),
      bus,
      volume: Number(volume),
      loop: Boolean(loop),
      cursor: 0,
      voices: []
    };
    pool.voices = Array.from({ length: pool.size }, () => null);
    this.pools.set(key, pool);
    return pool;
  }

  playFromPool(key, options = {}) {
    const pool = this.pools.get(key) || this.createPool(key);
    const index = pool.cursor;
    const previous = pool.voices[index];
    previous?.stop?.();
    const targetVolume = Number(options.volume ?? pool.volume);
    const source = this.play(key, {
      ...options,
      volume: options.fadeIn ? 0.0001 : targetVolume,
      loop: options.loop ?? pool.loop,
      bus: options.bus ?? pool.bus
    });
    if (!source) {
      return null;
    }
    source.omniPool = { key, index };
    pool.voices[index] = source;
    pool.cursor = (pool.cursor + 1) % pool.size;
    if (options.fadeIn) {
      this.fadeSource(source, {
        from: 0.0001,
        to: targetVolume,
        duration: options.fadeIn
      });
    }
    return source;
  }

  fadeIn(key, {
    duration = 0.25,
    volume = 1,
    ...options
  } = {}) {
    const source = this.play(key, {
      ...options,
      volume: 0.0001
    });
    if (!source) return null;
    this.fadeSource(source, { from: 0.0001, to: volume, duration });
    return source;
  }

  fadeOut(source, {
    duration = 0.25,
    stop = true
  } = {}) {
    if (!source) return null;
    this.fadeSource(source, {
      from: source.omniGain?.gain?.value ?? source.omniVolume ?? 1,
      to: 0.0001,
      duration
    });
    if (stop) source.stop?.((this.context?.currentTime || 0) + Number(duration || 0));
    return source;
  }

  fadeSource(source, {
    from = source?.omniGain?.gain?.value ?? 1,
    to = 1,
    duration = 0.25
  } = {}) {
    const gain = source?.omniGain?.gain;
    if (!gain) return source || null;
    const start = this.context?.currentTime || 0;
    const end = start + Math.max(0, Number(duration) || 0);
    gain.cancelScheduledValues?.(start);
    gain.setValueAtTime?.(Math.max(0.0001, Number(from)), start);
    gain.linearRampToValueAtTime?.(Math.max(0.0001, Number(to)), end);
    gain.value = Math.max(0.0001, Number(to));
    source.omniVolume = Number(to);
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
    gain.connect(this._ensureOutputNode());
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

  createSpatial25DProfile({
    listener = {},
    source = {},
    occluders = [],
    maxDistance = 512,
    minLowpassHz = 900,
    maxLowpassHz = 12000
  } = {}) {
    const dx = Number(source.x || 0) - Number(listener.x || 0);
    const dy = Number(source.y || 0) - Number(listener.y || 0);
    const dz = Number(source.z || 0) - Number(listener.z || 0);
    const distance = Math.hypot(dx, dy, dz);
    const attenuation = 1 / (1 + (distance / Math.max(1, Number(maxDistance || 512))) ** 2);
    const absorption = (Array.isArray(occluders) ? occluders : [])
      .reduce((sum, item) => sum + Math.max(0, Math.min(1, Number(item.absorption || 0))), 0);
    const occlusion = Math.max(0, Math.min(1, absorption));
    const pan = Math.max(-1, Math.min(1, dx / Math.max(1, Math.abs(dx) + Math.abs(dy) + Math.abs(dz) * 0.5)));
    const lowpassHz = Math.round(maxLowpassHz - (maxLowpassHz - minLowpassHz) * occlusion);
    const reverbBias = Math.max(0, Math.min(1, Math.abs(dz) / Math.max(1, maxDistance / 2)));
    return {
      distance,
      gain: Number((attenuation * (1 - occlusion * 0.35)).toFixed(6)),
      pan: Number(pan.toFixed(6)),
      lowpassHz,
      reverbBias: Number(reverbBias.toFixed(6)),
      occluded: occlusion > 0,
      verticalDelta: dz
    };
  }

  _resolveOutput(busName) {
    if (!busName) return this._ensureOutputNode();
    const bus = this.buses.get(busName) || this.createBus(busName);
    return bus?.gain || this._ensureOutputNode();
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
