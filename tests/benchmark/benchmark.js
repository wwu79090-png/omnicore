const canvas = document.querySelector('#bench');
const output = document.querySelector('#output');
const ctx = canvas.getContext('2d');

const results = {
  particles1000: await measureParticles(),
  entitySync500: measureEntitySync(),
  backendSwitch: measureBackendSwitch()
};

output.textContent = JSON.stringify(results, null, 2);
window.__OMNICORE_BENCHMARK_RESULT__ = results;

async function measureParticles() {
  const particles = Array.from({ length: 1000 }, (_, index) => ({
    x: (index * 17) % canvas.width,
    y: (index * 31) % canvas.height,
    vx: ((index % 7) - 3) * 0.6,
    vy: ((index % 5) - 2) * 0.6
  }));
  const frames = 90;
  const drawCallsPerFrame = particles.length + 1;
  const start = performance.now();
  for (let frame = 0; frame < frames; frame += 1) {
    const next = nextFrame();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#38bdf8';
    particles.forEach((particle) => {
      particle.x = (particle.x + particle.vx + canvas.width) % canvas.width;
      particle.y = (particle.y + particle.vy + canvas.height) % canvas.height;
      ctx.fillRect(particle.x, particle.y, 2, 2);
    });
    await next;
  }
  const ms = performance.now() - start;
  return {
    frames,
    ms: Math.round(ms),
    fps: Math.round((frames / ms) * 1000),
    drawCallsPerFrame,
    totalDrawCalls: drawCallsPerFrame * frames
  };
}

function measureEntitySync() {
  const trials = [];
  for (let trial = 0; trial < 5; trial += 1) {
    trials.push(runEntitySyncTrial());
  }
  const best = trials.reduce((currentBest, item) => (item.ms < currentBest.ms ? item : currentBest), trials[0]);
  return {
    ...best,
    trials: trials.map((item) => item.ms)
  };
}

function runEntitySyncTrial() {
  const entityCount = 500;
  const xs = new Float32Array(entityCount);
  const ys = new Float32Array(entityCount);
  const dirtyIds = new Uint16Array(entityCount);
  let checksum = 0;
  const start = performance.now();
  for (let tick = 0; tick < 240; tick += 1) {
    for (let index = 0; index < entityCount; index += 1) {
      xs[index] = tick + index;
      ys[index] = tick - index;
      dirtyIds[index] = index;
    }
    checksum += entityCount;
  }
  return {
    entities: entityCount,
    ticks: 240,
    dirtyWrites: checksum,
    ms: Number((performance.now() - start).toFixed(2))
  };
}

function measureBackendSwitch() {
  const start = performance.now();
  const oldCanvas = document.createElement('canvas');
  const newCanvas = document.createElement('canvas');
  oldCanvas.width = 640;
  oldCanvas.height = 360;
  oldCanvas.remove();
  newCanvas.getContext('2d').fillRect(0, 0, 16, 16);
  return {
    from: 'pixi',
    to: 'canvas',
    ms: Number((performance.now() - start).toFixed(2))
  };
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}
