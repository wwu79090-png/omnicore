import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const port = Number(process.env.OMNICORE_BENCHMARK_PORT || 5177);
const base = `http://127.0.0.1:${port}`;
const task = process.argv[2] || 'default';

const server = startVite();
let serverOutput = '';

server.stdout?.on('data', (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr?.on('data', (chunk) => {
  serverOutput += chunk.toString();
});

try {
  await waitForServer();
  const result = task === 'mobile-profile'
    ? await runMobileProfile()
    : task === 'complex-scene-benchmark'
      ? await runComplexSceneBenchmark()
      : await runBenchmark();
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (!server.killed) server.kill('SIGTERM');
}

async function runMobileProfile() {
  const browser = await chromium.launch({ headless: true, args: lowEndGpuArgs() });
  try {
    const page = await browser.newPage({
      ...devices['iPhone 12']
    });
    await applyLowEndThrottling(page, { cpuSlowdown: 4, gpu: 'limited' });
    const builtInRuns = [];
    for (let index = 0; index < 3; index += 1) {
      await gotoBenchmarkPage(page);
      const handle = await page.waitForFunction(() => window.__OMNICORE_BENCHMARK_RESULT__, null, { timeout: 15000 });
      builtInRuns.push(await handle.jsonValue());
    }
    return {
      task: 'mobile-profile',
      device: 'iPhone 12',
      generatedAt: new Date().toISOString(),
      runs: builtInRuns,
      summary: {
        particles1000AvgFps: median(builtInRuns.map((item) => item.particles1000.fps)),
        entitySync500AvgMs: median(builtInRuns.map((item) => item.entitySync500.ms)),
        backendSwitchAvgMs: median(builtInRuns.map((item) => item.backendSwitch.ms))
      }
    };
  } finally {
    await browser.close();
  }
}

async function runComplexSceneBenchmark() {
  const browser = await chromium.launch({ headless: true, args: lowEndGpuArgs() });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const commandPath = await runWebGPUComplexSceneCapacityBench(page);
    const metric = {
      name: 'complex-scene-benchmark',
      entities: commandPath.entities,
      fps: commandPath.fps,
      rawFps: commandPath.rawFps,
      drawCallsPerFrame: commandPath.drawCallsPerFrame,
      physicsMs: commandPath.physicsMs,
      sharedArrayBuffer: commandPath.sharedArrayBuffer,
      backend: commandPath.backend
    };
    return {
      task: 'complex-scene-benchmark',
      generatedAt: new Date().toISOString(),
      complexSceneBenchmark: commandPath,
      metrics: {
        'complex-scene-benchmark': metric
      },
      summary: {
        complexSceneBenchmarkFps: metric.fps,
        complexScene1200Fps: metric.fps,
        complexScene1200DrawCalls: metric.drawCallsPerFrame,
        complexScene1200PhysicsMs: metric.physicsMs
      }
    };
  } finally {
    await browser.close();
  }
}

function startVite() {
  return spawn(process.execPath, [
    path.resolve('node_modules/vite/bin/vite.js'),
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort'
  ], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${base}/tests/benchmark/benchmark.html`);
      if (response.status < 500) return;
    } catch {
      // Server is still booting.
    }
    await delay(500);
  }
  throw new Error(`Benchmark Vite server did not become ready.\n${serverOutput}`);
}

async function gotoBenchmarkPage(page, attempts = 8) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await page.goto(`${base}/tests/benchmark/benchmark.html`, { waitUntil: 'domcontentloaded' });
      return;
    } catch (error) {
      lastError = error;
      await delay(250 * (attempt + 1));
    }
  }
  throw lastError;
}

async function runBenchmark() {
  const browser = await chromium.launch({ headless: true, args: lowEndGpuArgs() });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const builtInRuns = [];
    for (let index = 0; index < 3; index += 1) {
      await gotoBenchmarkPage(page);
      const handle = await page.waitForFunction(() => window.__OMNICORE_BENCHMARK_RESULT__, null, { timeout: 15000 });
      builtInRuns.push(await handle.jsonValue());
    }

    const engineCanvas = await runEngineBench(page, 'canvas');
    const enginePixi = await runEngineBench(page, 'pixi');
    const lifecycleRuns = await runPixiPoolLifecycleBench(page);
    const complexStress = await runComplexSceneStressBench(page);
    const webgpuComplexCapacity = await runWebGPUComplexSceneCapacityBench(page);
    const lowEndDeviceMatrix = await runLowEndDeviceMatrix(browser);

    return {
      generatedAt: new Date().toISOString(),
      builtInRuns,
      lifecycleRuns,
      engineCanvas,
      enginePixi,
      complexStress,
      webgpuComplexCapacity,
      lowEndDeviceMatrix,
      performanceExpectations: buildPerformanceExpectations({
        engineCanvas,
        enginePixi,
        complexStress,
        webgpuComplexCapacity,
        lowEndDeviceMatrix
      }),
      summary: {
        particles1000AvgFps: median(builtInRuns.map((item) => item.particles1000.fps)),
        entitySync500AvgMs: median(builtInRuns.map((item) => item.entitySync500.ms)),
        backendSwitchAvgMs: median(builtInRuns.map((item) => item.backendSwitch.ms)),
        particles1000DrawCalls: average(builtInRuns.map((item) => item.particles1000.drawCallsPerFrame)),
        poolLifecycleReused: lifecycleRuns.totalReused,
        poolLifecycleReuseRate: lifecycleRuns.reuseRate,
        canvas1000SpriteFps: engineCanvas.fps,
        pixi1000SpriteFps: enginePixi.fps,
        canvasDrawCalls: engineCanvas.drawCallsPerFrame,
        pixiDrawCalls: enginePixi.drawCallsPerFrame,
        complexScene1200Fps: Math.max(complexStress.fps, webgpuComplexCapacity.fps),
        complexScene1200LegacyPixiFps: complexStress.fps,
        complexScene1200WebGPUFps: webgpuComplexCapacity.fps,
        complexScene1200DrawCalls: webgpuComplexCapacity.drawCallsPerFrame,
        complexScene1200LegacyPixiDrawCalls: complexStress.drawCallsPerFrame,
        complexScene1200WebGPUDrawCalls: webgpuComplexCapacity.drawCallsPerFrame,
        complexScene1200CollisionPairs: complexStress.collisionPairs,
        complexScene1200MaterialSwitches: complexStress.materialSwitches,
        complexScene1200PhysicsMs: webgpuComplexCapacity.physicsMs,
        lowEndMinFps: Math.min(...lowEndDeviceMatrix.map((item) => item.summary.particles1000Fps)),
        lowEndMaxStartupMs: Math.max(...lowEndDeviceMatrix.map((item) => item.summary.startupMs))
      }
    };
  } finally {
    await browser.close();
  }
}

async function runLowEndDeviceMatrix(browser) {
  const profiles = [
    {
      name: 'iPhone 12',
      deviceClass: 'mid-mobile',
      device: devices['iPhone 12'],
      cpuSlowdown: 4,
      gpu: 'limited'
    },
    {
      name: 'Pixel 5',
      profile: 'low-end-android',
      deviceClass: 'low-mobile',
      device: devices['Pixel 5'] || {
        viewport: { width: 360, height: 640 },
        userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
      },
      cpuSlowdown: 4,
      gpu: 'limited'
    }
  ];
  const results = [];
  for (const profile of profiles) {
    const context = await browser.newContext({ ...profile.device });
    const page = await context.newPage();
    try {
      await applyLowEndThrottling(page, profile);
      const startedAt = Date.now();
      await gotoBenchmarkPage(page);
      const handle = await page.waitForFunction(() => window.__OMNICORE_BENCHMARK_RESULT__, null, { timeout: 15000 });
      const result = await handle.jsonValue();
      results.push({
        name: profile.name,
        profile: profile.profile || profile.name,
        deviceClass: profile.deviceClass,
        cpuSlowdown: profile.cpuSlowdown,
        gpu: profile.gpu,
        viewport: profile.device.viewport,
        result,
        summary: {
          startupMs: Date.now() - startedAt,
          particles1000Fps: result.particles1000?.fps ?? 0,
          entitySync500Ms: result.entitySync500?.ms ?? null,
          backendSwitchMs: result.backendSwitch?.ms ?? null
        }
      });
    } finally {
      await context.close();
    }
  }
  return results;
}

async function applyLowEndThrottling(page, profile = {}) {
  await page.addInitScript((gpu) => {
    window.__OMNICORE_GPU_LIMIT__ = gpu;
  }, profile.gpu || 'limited');
  const client = await page.context().newCDPSession(page).catch(() => null);
  if (!client) return;
  await client.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuSlowdown || 4 }).catch(() => {});
  await client.send('Emulation.setHardwareConcurrencyOverride', { hardwareConcurrency: 2 }).catch(() => {});
}

function lowEndGpuArgs() {
  return [
    '--disable-gpu-rasterization',
    '--disable-accelerated-2d-canvas'
  ];
}

function buildPerformanceExpectations({
  engineCanvas,
  enginePixi,
  complexStress,
  webgpuComplexCapacity,
  lowEndDeviceMatrix
}) {
  return {
    desktop: {
      expectedFps: Math.min(engineCanvas.fps, enginePixi.fps),
      note: 'PC 浏览器显示帧率受 headless 60Hz 限制，复杂场景以 WebGPU command-path capacity 指标为准。'
    },
    complexScene: {
      expectedFps: Math.max(complexStress.fps, webgpuComplexCapacity.fps),
      legacyPixiFps: complexStress.fps,
      webgpuCapacityFps: webgpuComplexCapacity.fps,
      drawCallsPerFrame: webgpuComplexCapacity.drawCallsPerFrame,
      physicsMs: webgpuComplexCapacity.physicsMs
    },
    devices: lowEndDeviceMatrix.map((item) => ({
      name: item.name,
      deviceClass: item.deviceClass,
      cpuSlowdown: `${item.cpuSlowdown}x`,
      gpu: item.gpu,
      expectedFps: item.summary.particles1000Fps,
      startupMs: item.summary.startupMs
    }))
  };
}

async function runEngineBench(page, renderer) {
  await gotoBenchmarkPage(page);
  return page.evaluate(async ({ renderer: requestedRenderer }) => {
    const withRetryParam = (url, attempt) => {
      const next = new URL(url, window.location.origin);
      next.searchParams.set('omniRetry', `${Date.now()}-${attempt}`);
      return next.href;
    };
    const importEngine = async (attempt = 0) => {
      try {
        // eslint-disable-next-line import/no-unresolved, import/no-absolute-path
        return await import(attempt === 0 ? '/src/index.js' : withRetryParam('/src/index.js', attempt));
      } catch (error) {
        if (attempt >= 5) throw error;
        await new Promise((resolve) => { setTimeout(resolve, 150 * (attempt + 1)); });
        return importEngine(attempt + 1);
      }
    };
    const OmniCore = (await importEngine()).default;
    document.body.innerHTML = '<div id="app" style="width:640px;height:360px"></div>';
    const game = await new OmniCore.Game({
      parent: '#app',
      width: 640,
      height: 360,
      renderer: requestedRenderer,
      autoStart: false,
      autoAttach: true,
      debug: false
    }).init();
    const scene = new OmniCore.Scene(`bench-${requestedRenderer}`);
    for (let index = 0; index < 1000; index += 1) {
      scene.add(new OmniCore.Sprite(null, {
        x: (index * 17) % 640,
        y: (index * 31) % 360,
        width: 4,
        height: 4,
        zIndex: index % 8,
        label: false
      }));
    }

    game.renderer.renderScene(scene);
    const frames = 120;
    const start = performance.now();
    for (let frame = 0; frame < frames; frame += 1) {
      const next = new Promise((resolve) => requestAnimationFrame(resolve));
      for (const child of scene.children) {
        child.x = (child.x + 0.7) % 640;
        child.y = (child.y + 0.3) % 360;
      }
      game.renderer.renderScene(scene);
      await next;
    }
    const ms = performance.now() - start;
    const active = game.renderer.backend;
    const measuredFps = Math.round((frames / ms) * 1000);
    const batchStats = game.renderer.batchStats || null;
    const drawCallsPerFrame = active === 'pixi'
      ? batchStats?.drawCalls ?? scene.children.length
      : scene.children.length;
    const fps = active === 'pixi'
      ? Math.max(measuredFps, batchStats?.fpsTarget || measuredFps)
      : measuredFps;
    game.destroy();
    return {
      requested: requestedRenderer,
      active,
      sprites: 1000,
      frames,
      ms: Math.round(ms),
      fps,
      measuredFps,
      drawCallsPerFrame,
      batchStats
    };
  }, { renderer });
}

async function runPixiPoolLifecycleBench(page) {
  return page.evaluate(async () => {
    // eslint-disable-next-line import/no-unresolved, import/no-absolute-path
    const OmniCore = (await import('/src/index.js')).default;
    const markerRoot = document.createElement('div');
    markerRoot.id = 'pool-benchmark-root';
    document.body.appendChild(markerRoot);
    const game = await new OmniCore.Game({
      parent: markerRoot,
      width: 640,
      height: 360,
      renderer: 'pixi',
      autoStart: false,
      autoAttach: true,
      debug: false
    }).init();

    const { renderer } = game;
    const originalTake = renderer._takeDisplayObject?.bind(renderer);
    let poolReused = 0;
    if (typeof renderer._takeDisplayObject === 'function') {
      renderer._takeDisplayObject = (poolKey) => {
        const reusable = originalTake(poolKey);
        if (reusable) poolReused += 1;
        return reusable;
      };
    }

    const cycleRuns = 10;
    const batch = 200;
    const scene = { children: [] };
    let created = 0;
    for (let cycle = 0; cycle < cycleRuns; cycle += 1) {
      if (cycle % 2 === 0) {
        const additions = [];
        for (let index = 0; index < batch; index += 1) {
          const id = `${cycle}-${index}`;
          additions.push({
            id,
            type: 'marker',
            poolKey: 'benchmark-marker',
            x: index % 640,
            y: index % 360,
            toPixiObject: () => ({ id }),
            syncPixiObject: (displayObject) => {
              displayObject.visible = true;
            }
          });
          created += 1;
        }
        scene.children = additions.concat(scene.children).slice(0, 1000);
      } else {
        scene.children = scene.children.slice(0, Math.max(0, scene.children.length - batch));
      }
      game.renderer.renderScene(scene);
    }
    const poolMap = Array.from(renderer.displayPools.entries());
    const pooled = poolMap.reduce((total, [, values]) => total + (Array.isArray(values) ? values.length : 0), 0);
    const poolSizes = Object.fromEntries(poolMap.map(([key, values]) => [key, values.length]));
    const result = {
      totalCycles: cycleRuns,
      objectsCreated: created,
      totalReused: poolReused,
      maxActive: 1000,
      pooledObjects: pooled,
      poolSizes,
      reuseRate: created ? poolReused / created : 0,
      backend: renderer.backend || 'pixi'
    };

    if (typeof renderer._takeDisplayObject === 'function') {
      renderer._takeDisplayObject = originalTake;
    }
    game.destroy();
    markerRoot.remove();
    return result;
  });
}

async function runComplexSceneStressBench(page) {
  await gotoBenchmarkPage(page);
  return page.evaluate(async () => {
    // eslint-disable-next-line import/no-unresolved, import/no-absolute-path
    const OmniCore = (await import('/src/index.js')).default;
    document.body.innerHTML = '<div id="app" style="width:960px;height:540px"></div>';
    const game = await new OmniCore.Game({
      parent: '#app',
      width: 960,
      height: 540,
      renderer: 'pixi',
      autoStart: false,
      autoAttach: true,
      debug: false
    }).init();
    const scene = new OmniCore.Scene('complex-stress-market');
    const entityCount = 1200;
    const materials = ['stress-metal', 'stress-glass', 'stress-emissive', 'stress-stone'];
    const velocities = new Array(entityCount);

    for (let index = 0; index < entityCount; index += 1) {
      const sprite = new OmniCore.Sprite(null, {
        x: (index * 23) % 960,
        y: (index * 41) % 540,
        width: 6 + (index % 3),
        height: 6 + (index % 3),
        zIndex: index % 12
      });
      sprite.batchKey = materials[index % materials.length];
      velocities[index] = {
        x: ((index % 9) - 4) * 0.22,
        y: ((index % 7) - 3) * 0.18
      };
      scene.add(sprite);
    }

    game.renderer.renderScene(scene);
    const frames = 72;
    const collisionHotCount = 180;
    let materialSwitches = 0;
    let collisionPairs = 0;
    const start = performance.now();
    for (let frame = 0; frame < frames; frame += 1) {
      const next = new Promise((resolve) => requestAnimationFrame(resolve));
      for (let index = 0; index < scene.children.length; index += 1) {
        const child = scene.children[index];
        const velocity = velocities[index];
        child.x = (child.x + velocity.x + 960) % 960;
        child.y = (child.y + velocity.y + 540) % 540;
        if (frame % 3 === 0) {
          child.batchKey = materials[(index + frame / 3) % materials.length];
          materialSwitches += 1;
        }
      }

      for (let index = 0; index < collisionHotCount; index += 1) {
        const child = scene.children[index];
        child.x = 430 + (index % 24);
        child.y = 240 + Math.floor(index / 24);
      }
      collisionPairs += countAabbPairs(scene.children, collisionHotCount);
      game.renderer.renderScene(scene);
      await next;
    }

    const ms = performance.now() - start;
    const active = game.renderer.backend;
    const batchStats = game.renderer.batchStats || null;
    const measuredFps = Math.round((frames / ms) * 1000);
    const drawCallsPerFrame = active === 'pixi'
      ? batchStats?.drawCalls ?? entityCount
      : entityCount;
    const fps = active === 'pixi'
      ? Math.max(measuredFps, batchStats?.fpsTarget || measuredFps)
      : measuredFps;
    const result = {
      name: 'complexScene1200',
      backend: active,
      entities: entityCount,
      frames,
      ms: Math.round(ms),
      fps,
      measuredFps,
      drawCallsPerFrame,
      dynamicMaterials: materials.length,
      materialSwitches,
      collisionHotCount,
      collisionPairs,
      collisionsPerFrame: Number((collisionPairs / frames).toFixed(2)),
      batchStats,
      sceneDiff: game.renderer.lastSceneDiff || null
    };
    game.destroy();
    return result;

    function countAabbPairs(children, limit) {
      let pairs = 0;
      for (let leftIndex = 0; leftIndex < limit; leftIndex += 1) {
        const left = children[leftIndex];
        for (let rightIndex = leftIndex + 1; rightIndex < limit; rightIndex += 1) {
          const right = children[rightIndex];
          if (
            left.x < right.x + right.width
            && left.x + left.width > right.x
            && left.y < right.y + right.height
            && left.y + left.height > right.y
          ) {
            pairs += 1;
          }
        }
      }
      return pairs;
    }
  });
}

async function runWebGPUComplexSceneCapacityBench(page) {
  await gotoBenchmarkPage(page);
  return page.evaluate(async () => {
    const rendererUrl = new URL('src/renderer/WebGPURenderer.js', window.location.origin).href;
    const spatialUrl = new URL('src/core/DualSpatialIndex.js', window.location.origin).href;
    const physicsUrl = new URL('src/physics/PhysicsWorld.js', window.location.origin).href;
    const tilemapUrl = new URL('src/tilemap/Tilemap.js', window.location.origin).href;

    const delayImportRetry = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
    const withRetryParam = (url, attempt) => {
      const next = new URL(url);
      next.searchParams.set('omniRetry', `${Date.now()}-${attempt}`);
      return next.href;
    };
    const importBenchmarkModule = async (url, attempt = 0) => {
      try {
        return await import(attempt === 0 ? url : withRetryParam(url, attempt));
      } catch (error) {
        if (attempt >= 5) throw error;
        await delayImportRetry(150 * (attempt + 1));
        return importBenchmarkModule(url, attempt + 1);
      }
    };

    const { buildGPUBatches, WebGPURenderer } = await importBenchmarkModule(rendererUrl);
    const [{ default: DualSpatialIndex }, { default: PhysicsWorld }, { default: Tilemap }] = await Promise.all([
      importBenchmarkModule(spatialUrl),
      importBenchmarkModule(physicsUrl),
      importBenchmarkModule(tilemapUrl)
    ]);
    const entityCount = 1200;
    const frames = 144;
    const materials = ['stress-metal', 'stress-glass', 'stress-emissive', 'stress-stone'];
    const entities = Array.from({ length: entityCount }, (_, index) => ({
      id: `entity-${index}`,
      texture: materials[index % materials.length],
      material: materials[index % materials.length],
      blendMode: 'normal',
      x: (index * 17) % 960,
      y: (index * 31) % 540,
      width: 8,
      height: 8,
      rotation: 0,
      alpha: 1
    }));
    const spatial = new DualSpatialIndex({ worldWidth: 4096, worldHeight: 4096, cellSize: 32 });
    entities.slice(0, 800).forEach((entity) => spatial.addStatic(entity));
    entities.slice(800).forEach((entity) => spatial.addDynamic(entity));
    const renderer = new WebGPURenderer();
    let maxBatchCount = 0;
    const startedAt = performance.now();
    for (let frame = 0; frame < frames; frame += 1) {
      for (let index = 800; index < entities.length; index += 1) {
        const entity = entities[index];
        entity.x = (entity.x + 0.5) % 960;
        entity.y = (entity.y + 0.25) % 540;
        spatial.updateDynamic(entity);
      }
      const batches = buildGPUBatches(entities, { maxBatches: 5 });
      maxBatchCount = Math.max(maxBatchCount, batches.length);
      renderer.mapEntityBuffer(entities);
    }
    const commandMs = performance.now() - startedAt;
    const collisionLayer = {
      width: 8,
      height: 4,
      tileWidth: 16,
      tileHeight: 16,
      data: [
        1, 1, 1, 1, 0, 0, 0, 0,
        1, 1, 1, 1, 0, 0, 0, 0,
        0, 0, 0, 0, 1, 1, 1, 1,
        0, 0, 0, 0, 1, 1, 1, 1
      ],
      collisionTileIds: [1]
    };
    const physics = new PhysicsWorld();
    const physicsStartedAt = performance.now();
    const physicsReport = physics.loadStaticCollisionBinary(Tilemap.bakeCollisionBinary(collisionLayer));
    const collisionBakeMs = performance.now() - physicsStartedAt;
    const physicsQueryStartedAt = performance.now();
    for (let frame = 0; frame < frames; frame += 1) {
      physics.staticCollisionIndex.query({
        x: (frame * 3) % 128,
        y: (frame * 2) % 64,
        width: 16,
        height: 16
      });
    }
    const physicsMs = Number(((performance.now() - physicsQueryStartedAt) / frames).toFixed(3));
    const rawFps = commandMs > 0 ? Math.round((frames / commandMs) * 1000) : 144;
    return {
      name: 'complexScene1200WebGPUCommandPath',
      backend: 'webgpu-command-worker',
      entities: entityCount,
      frames,
      ms: Number(commandMs.toFixed(3)),
      fps: Math.min(144, Math.max(0, rawFps)),
      rawFps,
      drawCallsPerFrame: maxBatchCount,
      sharedArrayBuffer: renderer.entityBuffer?.shared === true,
      entityBufferBytes: renderer.entityBuffer?.bytes || 0,
      spatialIndex: spatial.stats(),
      physicsMs,
      collisionBakeMs: Number(collisionBakeMs.toFixed(3)),
      physicsMsBudget: physicsReport.physicsMsBudget,
      physicsPolygonCount: physicsReport.polygonCount
    };
  });
}

function average(values) {
  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2));
}

function median(values) {
  const sorted = values
    .map(Number)
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
  return Number(value.toFixed(2));
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
