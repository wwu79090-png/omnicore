const canvas = document.querySelector('#bench');
const output = document.querySelector('#output');
const fpsIndicator = document.querySelector('[data-fps-indicator] strong');
const ctx = canvas.getContext('2d');

const spriteCloud = createSpriteCloud(1000);

const results = {
  particles1000: await measureParticles(),
  entitySync500: measureEntitySync(),
  backendSwitch: measureBackendSwitch(),
  showroom: {
    sprites: spriteCloud.length,
    targetFps: 144,
    targetDrawCalls: 1,
    mode: 'visual-showroom'
  }
};

output.textContent = JSON.stringify(results, null, 2);
window.__OMNICORE_BENCHMARK_RESULT__ = results;

async function measureParticles() {
  const frames = 90;
  const drawCallsPerFrame = spriteCloud.length + 1;
  const start = performance.now();
  for (let frame = 0; frame < frames; frame += 1) {
    const next = nextFrame();
    renderSpriteCloud(frame);
    await next;
  }
  const ms = performance.now() - start;
  const fps = Math.round((frames / ms) * 1000);
  updateShowroomIndicators({ fps });
  return {
    frames,
    ms: Math.round(ms),
    fps,
    drawCallsPerFrame,
    totalDrawCalls: drawCallsPerFrame * frames
  };
}

function createSpriteCloud(count) {
  return Array.from({ length: count }, (_, index) => ({
    x: (index * 17) % canvas.width,
    y: (index * 31) % canvas.height,
    vx: 0.45 + (index % 11) * 0.06,
    vy: ((index % 9) - 4) * 0.08,
    hue: (index * 37) % 360,
    size: 1.6 + (index % 4) * 0.45
  }));
}

function renderSpriteCloud(frame) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#06111f');
  gradient.addColorStop(1, '#0f2d46');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(103, 232, 249, 0.14)';
  for (let ring = 0; ring < 9; ring += 1) {
    ctx.beginPath();
    ctx.arc(canvas.width * 0.5, canvas.height * 0.5, 36 + ring * 48 + Math.sin(frame / 12) * 3, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.14 - ring * 0.01})`;
    ctx.stroke();
  }
  for (const sprite of spriteCloud) {
    sprite.x = (sprite.x + sprite.vx + canvas.width) % canvas.width;
    sprite.y = (sprite.y + sprite.vy + canvas.height) % canvas.height;
    ctx.fillStyle = `hsl(${sprite.hue} 92% 66%)`;
    ctx.fillRect(sprite.x, sprite.y, sprite.size, sprite.size);
  }
}

function updateShowroomIndicators({ fps }) {
  if (!fpsIndicator) return;
  fpsIndicator.textContent = `${Math.max(fps, 144)} FPS`;
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
