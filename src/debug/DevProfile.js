const DEFAULT_LOAD = Object.freeze({
  tiles: 200,
  entities: 50,
  sounds: 1
});

export class DevProfile {
  constructor({
    debug = false,
    durationMs = 10000,
    lowFpsThreshold = 30,
    load = DEFAULT_LOAD,
    frameSampler = null,
    audio = null,
    clock = () => Date.now()
  } = {}) {
    this.debug = Boolean(debug);
    this.durationMs = durationMs;
    this.lowFpsThreshold = lowFpsThreshold;
    this.load = { ...load };
    this.frameSampler = frameSampler;
    this.audio = audio;
    this.clock = clock;
    this.lastReport = null;
  }

  async scan(options = {}) {
    if (!this.debug) return null;
    const durationMs = options.durationMs ?? this.durationMs;
    const load = { ...this.load, ...(options.load || {}) };
    this._simulateLoad(load);
    const frameTimes = await this._sampleFrames(durationMs, options);
    const avgFrameMs = average(frameTimes);
    const avgFps = avgFrameMs > 0 ? Math.round(1000 / avgFrameMs) : 60;
    const report = {
      durationMs,
      load,
      avgFrameMs: Number(avgFrameMs.toFixed(2)),
      avgFps,
      suggestions: this._suggest(avgFps, load)
    };
    this.lastReport = report;
    return report;
  }

  _simulateLoad(load) {
    const tiles = Array.from({ length: load.tiles }, (_, index) => ({
      id: index,
      x: index % 20,
      y: Math.floor(index / 20)
    }));
    const entities = Array.from({ length: load.entities }, (_, index) => ({
      id: `profile-entity-${index}`,
      x: index * 2,
      y: index * 3
    }));
    for (let index = 0; index < load.sounds; index += 1) {
      this.audio?.synthesize?.('ui.click', { duration: 0.01, gain: 0.01 });
    }
    return { tiles, entities };
  }

  async _sampleFrames(durationMs, options) {
    if (this.frameSampler) return this.frameSampler({ durationMs, load: options.load || this.load });
    const frameTimes = [];
    const start = this.clock();
    let previous = start;
    while (this.clock() - start < durationMs) {
      await Promise.resolve();
      const now = this.clock();
      frameTimes.push(Math.max(1, now - previous || 16));
      previous = now;
      if (durationMs <= 0) break;
    }
    return frameTimes.length ? frameTimes : [16];
  }

  _suggest(avgFps, load) {
    const suggestions = [];
    if (load.tiles >= 200 || avgFps < this.lowFpsThreshold) {
      suggestions.push({
        key: 'tile.chunkSize',
        value: '16x16',
        reason: '200 Tile 压力场景下建议缩小分块以减少单帧遍历。'
      });
    }
    if (avgFps < this.lowFpsThreshold) {
      suggestions.push({
        key: 'renderer.bloom',
        value: false,
        reason: '低 FPS 压力扫描下建议关闭泛光等后处理。'
      });
      suggestions.push({
        key: 'particles.maxVisible',
        value: Math.max(16, Math.floor(load.entities * 0.6)),
        reason: '实体压力较高时限制可见粒子数量。'
      });
    }
    return suggestions;
  }
}

function average(values) {
  if (!values.length) return 16;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

export default DevProfile;
