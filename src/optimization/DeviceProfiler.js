function defaultClock() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function defaultCpuTask() {
  let total = 0;
  for (let index = 0; index < 5000; index += 1) total += Math.sqrt(index);
  return total > 0 ? 60 : 0;
}

function defaultGpuTask() {
  if (typeof document === 'undefined') return 60;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return 30;
  for (let index = 0; index < 64; index += 1) {
    ctx.fillStyle = index % 2 ? '#38bdf8' : '#0f172a';
    ctx.fillRect(index, 0, 1, 64);
  }
  return 60;
}

function defaultMemoryTask() {
  const memory = typeof performance !== 'undefined' ? performance.memory : null;
  if (!memory?.jsHeapSizeLimit || !memory.usedJSHeapSize) return 60;
  const usage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
  return Math.max(1, Math.round((1 - usage) * 100));
}

/**
 * Startup device profiler for adaptive rendering quality.
 */
export class DeviceProfiler {
  constructor({
    durationMs = 5000,
    clock = defaultClock,
    gpuTask = defaultGpuTask,
    cpuTask = defaultCpuTask,
    memoryTask = defaultMemoryTask,
    lowThreshold = 30,
    midThreshold = 55
  } = {}) {
    this.durationMs = durationMs;
    this.clock = clock;
    this.gpuTask = gpuTask;
    this.cpuTask = cpuTask;
    this.memoryTask = memoryTask;
    this.lowThreshold = lowThreshold;
    this.midThreshold = midThreshold;
  }

  async profile() {
    const started = this.clock();
    const samples = [];
    const runOnce = async () => {
      const gpuScore = Number(await this.gpuTask());
      const cpuScore = Number(await this.cpuTask());
      const memoryScore = Number(await this.memoryTask());
      samples.push({ gpuScore, cpuScore, memoryScore });
    };

    await runOnce();
    while (this.durationMs > 0 && this.clock() - started < this.durationMs) {
      await new Promise((resolve) => setTimeout(resolve, 16));
      await runOnce();
    }

    const averaged = averageSamples(samples);
    const minScore = Math.min(averaged.gpuScore, averaged.cpuScore, averaged.memoryScore);
    const tier = minScore < this.lowThreshold ? 'low' : minScore < this.midThreshold ? 'mid' : 'high';
    return {
      ...averaged,
      tier,
      durationMs: Math.round(this.clock() - started),
      samples: samples.length,
      createdAt: new Date().toISOString()
    };
  }
}

function averageSamples(samples) {
  const total = samples.reduce((sum, item) => ({
    gpuScore: sum.gpuScore + item.gpuScore,
    cpuScore: sum.cpuScore + item.cpuScore,
    memoryScore: sum.memoryScore + item.memoryScore
  }), { gpuScore: 0, cpuScore: 0, memoryScore: 0 });
  const count = Math.max(1, samples.length);
  return {
    gpuScore: Number((total.gpuScore / count).toFixed(2)),
    cpuScore: Number((total.cpuScore / count).toFixed(2)),
    memoryScore: Number((total.memoryScore / count).toFixed(2))
  };
}

export default DeviceProfiler;
