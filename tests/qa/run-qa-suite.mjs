#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { chromium, webkit, chromium as chromiumLauncher } from 'playwright';

const ROOT = process.cwd();
const START = new Date().toISOString();
const RESULT_DIR = path.join(ROOT, 'test-results', 'qa');
const REPORT_PATH = path.join(RESULT_DIR, 'qa-cross-browser-report.json');
const STARTING_PORT = 4173;
const START_PORT_LIMIT = 30;
const QA_LONG_MINUTES = Number(process.env.QA_LONG_MINUTES ?? 0);
const QA_RUNTIME_TIMEOUT_MS = Number(process.env.QA_RUNTIME_TIMEOUT_MS ?? 180000);
const QA_LONG_TIMEOUT_MS = Number(process.env.QA_LONG_TIMEOUT_MS ?? 180000);

const BROWSERS = [
  { name: 'Chrome', launcher: chromium, launchOptions: { headless: true, channel: 'chrome' } },
  { name: 'Safari（WebKit）', launcher: webkit, launchOptions: { headless: true } },
  { name: 'Edge', launcher: chromiumLauncher, launchOptions: { headless: true, channel: 'msedge' } }
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logStage(message) {
  console.error(`[qa] ${message}`);
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function ensureDir() {
  fs.mkdirSync(RESULT_DIR, { recursive: true });
}

async function isPortFree(port) {
  const probe = createServer();
  return new Promise((resolve) => {
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => {
      probe.close(() => resolve(true));
    });
  });
}

async function findPort() {
  for (let offset = 0; offset <= START_PORT_LIMIT; offset += 1) {
    const port = STARTING_PORT + offset;
    if (await isPortFree(port)) return port;
  }
  return STARTING_PORT;
}

async function waitForServer(baseUrl, timeoutMs = 60000) {
  const start = Date.now();
  const target = `${baseUrl}/tests/qa/qa-runtime.html`;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(target);
      if (res.ok) return;
    } catch {
      // continue
    }
    await sleep(300);
  }
  throw new Error(`服务未就绪: ${target}`);
}

function spawnViteServer(port) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const proc = spawn(command, ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env: {
      ...process.env,
      BROWSER: 'none'
    }
  });

  return new Promise((resolve, reject) => {
    let ready = false;
    let failed;

    const timer = setTimeout(() => {
      if (!ready && !failed) {
        reject(new Error(`Vite 启动超时, port=${port}`));
        proc.kill('SIGTERM');
      }
    }, 60000);

    const markReady = () => {
      if (ready || failed) return;
      clearTimeout(timer);
      ready = true;
      resolve(proc);
    };

    proc.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      if (/Local\s*:\s*http:\/\/127\.0\.0\.1|ready in/i.test(text)) {
        markReady();
      }
    });

    proc.stderr?.on('data', (chunk) => {
      const text = chunk.toString();
      if (/error/i.test(text) && !ready) {
        failed = true;
        clearTimeout(timer);
        reject(new Error(text.trim()));
      }
    });

    proc.once('exit', (code) => {
      if (code !== 0 && !ready && !failed) {
        clearTimeout(timer);
        reject(new Error(`Vite 进程退出 code=${code}`));
      }
    });
  });
}

function stopProc(proc) {
  if (!proc || proc.killed) return;
  if (process.platform === 'win32' && proc.pid) {
    spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  proc.kill('SIGTERM');
}

function parseSuite(raw) {
  const baseline = raw.baseline || {};
  const core = raw.core || {};
  const defense = raw.defense || {};
  const performance = raw.performance || {};

  return {
    baseline: {
      avgFps: baseline.avgFps,
      minFps: baseline.minFps,
      maxFps: baseline.maxFps,
      frameCount: baseline.frameCount,
      requestedRenderer: baseline.requestedRenderer,
      renderer: baseline.renderer,
      status: baseline.avgFps >= 60 ? 'pass' : 'fail'
    },
    core: Object.entries(core).map(([name, pass]) => ({
      name,
      status: pass ? 'pass' : 'fail',
      detail: pass ? '通过' : '未满足期望'
    })),
    defense: Object.entries(defense).map(([name, pass]) => ({
      name,
      status: pass ? 'pass' : 'fail',
      detail: pass ? '通过' : '未满足期望'
    })),
    performance: [
      {
        name: 'Pixi 1000 Sprite',
        status: performance.pixi?.avgFps >= 55 ? 'pass' : 'fail',
        detail: `avg=${performance.pixi?.avgFps ?? 'N/A'} min=${performance.pixi?.minFps ?? 'N/A'} backend=${performance.pixi?.backend ?? 'N/A'} 阈值>=55`
      },
      {
        name: 'Canvas 1000 Sprite',
        status: performance.canvas?.avgFps >= 60 ? 'pass' : 'fail',
        detail: `avg=${performance.canvas?.avgFps ?? 'N/A'} min=${performance.canvas?.minFps ?? 'N/A'} backend=${performance.canvas?.backend ?? 'N/A'} 阈值>=60`
      }
    ]
  };
}

function summaryStatus(summary, messages) {
  const baseline = summary.baseline.status === 'pass';
  const core = summary.core.every((item) => item.status === 'pass');
  const defense = summary.defense.every((item) => item.status === 'pass');
  const perf = summary.performance.every((item) => item.status === 'pass');
  const console = !messages.some((m) => (m.type === 'error' || m.type === 'pageerror') && !isExpectedQaConsoleMessage(m));
  return {
    baseline: baseline ? 'pass' : 'fail',
    core: core ? 'pass' : 'fail',
    defense: defense ? 'pass' : 'fail',
    performance: perf ? 'pass' : 'fail',
    console: console ? 'pass' : 'fail',
    all: baseline && core && defense && perf && console
  };
}

function isExpectedQaConsoleMessage(message) {
  return /\bqa-bad\b|\bqa-missing-\d+\.png\b/.test(message.text || '');
}

async function runRuntimeSuite(page) {
  const messages = [];
  page.on('console', (msg) => {
    messages.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (err) => {
    messages.push({ type: 'pageerror', text: `${err.name || 'Error'}: ${err.message}` });
  });

  await page.goto(`${BASE_URL}/tests/qa/qa-runtime.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof window.__runQaSuite === 'function', { timeout: 60000 });
  const raw = await page.evaluate(() => window.__runQaSuite());
  const summary = parseSuite(raw);

  return {
    raw,
    summary,
    status: summaryStatus(summary, messages),
    messages
  };
}

async function runLongAndSwitchTest(page) {
  return page.evaluate(async (durationMinutes) => {
    const engineUrl = new URL('dist/omnicore.esm.js', window.location.origin).href;
    const mod = await import(engineUrl);
    const Engine = mod.default || mod;
    const { Game, Scene, Sprite } = Engine;

    const size = { width: 640, height: 360 };
    const qaAssets = {
      hero: '/assets/sprites/default/hero.svg',
      tile: '/assets/sprites/default/tile.svg',
      cloud: '/assets/sprites/default/cloud.svg'
    };

    async function ensureQaAssets(game) {
      if (!game?.assetLoader || game.__qaAssetsReady) return;
      game.__qaAssetsReady = true;
      await game.assetLoader.loadImages([
        { key: 'hero', url: qaAssets.hero, width: 16, height: 16 },
        { key: 'tile', url: qaAssets.tile, width: 16, height: 16 },
        { key: 'cloud', url: qaAssets.cloud, width: 18, height: 18 }
      ]);
    }

    const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitFrames = (count = 1) => new Promise((resolve) => {
      let remain = count;
      const tick = () => {
        remain -= 1;
        if (remain <= 0) {
          resolve();
        } else {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });

    const readMemory = () => {
      const mem = performance.memory;
      if (!mem) {
        return { usedJSHeapSizeMB: null, totalJSHeapSizeMB: null, jsHeapSizeLimitMB: null };
      }
      return {
        usedJSHeapSizeMB: Number((mem.usedJSHeapSize / 1048576).toFixed(2)),
        totalJSHeapSizeMB: Number((mem.totalJSHeapSize / 1048576).toFixed(2)),
        jsHeapSizeLimitMB: Number((mem.jsHeapSizeLimit / 1048576).toFixed(2))
      };
    };

    const game = new Game({
      parent: '#game',
      width: size.width,
      height: size.height,
      renderer: 'pixi',
      autoStart: true,
      autoAttach: true,
      debug: false
    });
    await game.init();
    await ensureQaAssets(game);

    const perfScene = new Scene('perf-long');
    for (let i = 0; i < 1000; i += 1) {
      perfScene.add(new Sprite(qaAssets.hero, {
        x: (i * 11) % size.width,
        y: Math.floor(i / 20) * 8,
        width: 4,
        height: 4
      }));
    }
    game.scene.register(perfScene);
    await game.scene.push('perf-long');
    await waitFrames(10);

    const memorySamples = [];
    const sampleIntervalMs = 5 * 60 * 1000;
    const rounds = Math.floor((durationMinutes * 60 * 1000) / sampleIntervalMs);
    const first = { ...readMemory(), minute: 0, timestamp: Date.now() };
    if (first.usedJSHeapSizeMB !== null) memorySamples.push(first);

    for (let i = 1; i <= rounds; i += 1) {
      await waitMs(sampleIntervalMs);
      const m = readMemory();
      if (m.usedJSHeapSizeMB !== null) memorySamples.push({ ...m, minute: i * 5, timestamp: Date.now() });
    }

    const last = memorySamples[memorySamples.length - 1] || first;
    const growthMB = (first.usedJSHeapSizeMB !== null && last?.usedJSHeapSizeMB !== null)
      ? Number((last.usedJSHeapSizeMB - first.usedJSHeapSizeMB).toFixed(2))
      : null;

    game.loop?.stop?.();
    game.destroy?.();
    await waitMs(50);
    await waitFrames(4);

    const switchGame = new Game({
      parent: '#game',
      width: size.width,
      height: size.height,
      renderer: 'pixi',
      autoStart: true,
      autoAttach: true,
      debug: false
    });
    await switchGame.init();
    await ensureQaAssets(switchGame);

    const makeScene = (index) => {
      const scene = new Scene(`scene-${index}`);
      const textures = [qaAssets.hero, qaAssets.tile, qaAssets.cloud];
      for (let j = 0; j < 48; j += 1) {
        scene.add(new Sprite(textures[(index + j) % textures.length], {
          x: (index * 41 + j * 23) % (size.width - 16),
          y: (index * 29 + j * 31) % (size.height - 16),
          width: 12,
          height: 12,
          zIndex: j
        }));
      }
      return scene;
    };

    for (let i = 0; i < 20; i += 1) {
      switchGame.scene.register(makeScene(i));
    }

    const snapshot = () => {
      const canvas = document.querySelector('#game canvas');
      return canvas ? canvas.toDataURL('image/png') : null;
    };

    const readData = (dataUrl) => new Promise((resolve, reject) => {
      if (!dataUrl) {
        reject(new Error('empty image'));
        return;
      }
      const image = new Image();
      image.onload = () => {
        const c = document.createElement('canvas');
        c.width = image.naturalWidth;
        c.height = image.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const { data } = ctx.getImageData(0, 0, c.width, c.height);
        resolve({ width: c.width, height: c.height, data });
      };
      image.onerror = reject;
      image.src = dataUrl;
    });

    const compare = async (left, right) => {
      if (!left || !right) return 1;
      const a = await readData(left);
      const b = await readData(right);
      const width = Math.min(a.width, b.width);
      const height = Math.min(a.height, b.height);
      const strideA = a.width * 4;
      const strideB = b.width * 4;
      let mismatch = 0;
      for (let y = 0; y < height; y += 1) {
        const oa = y * strideA;
        const ob = y * strideB;
        for (let x = 0; x < width * 4; x += 4) {
          const ia = oa + x;
          const ib = ob + x;
          if (a.data[ia] !== b.data[ib] || a.data[ia + 1] !== b.data[ib + 1] || a.data[ia + 2] !== b.data[ib + 2] || a.data[ia + 3] !== b.data[ib + 3]) {
            mismatch += 1;
          }
        }
      }
      const total = width * height;
      return total > 0 ? Number((mismatch / total).toFixed(6)) : 1;
    };

    const waitForGcWindow = async () => {
      globalThis.gc?.();
      await waitMs(50);
      await waitFrames(4);
    };

    const collectReferences = () => {
      const renderer = switchGame.renderer || {};
      const expectedChildren = switchGame.scene.current?.children?.length || 0;
      const displayObjectCount = renderer.sceneDisplayObjects?.size ?? null;
      const stageChildren = Array.isArray(renderer.stage?.children) ? renderer.stage.children.length : null;
      const poolActive = renderer.spritePool?.activeCount ?? 0;
      const poolAvailable = renderer.spritePool?.freeCount ?? null;
      const displayPoolRetained = renderer.displayPools
        ? [...renderer.displayPools.values()].reduce((sum, pool) => sum + (pool?.length || 0), 0)
        : 0;
      const activeOverflow = displayObjectCount != null && displayObjectCount > expectedChildren;
      const stageOverflow = stageChildren != null && stageChildren > expectedChildren;
      const poolOverflow = Number.isFinite(poolActive) && poolActive > expectedChildren && (activeOverflow || stageOverflow);
      return {
        scene: switchGame.scene.current?.name || null,
        backend: renderer.backend || 'unknown',
        expectedChildren,
        displayObjectCount,
        stageChildren,
        poolActive,
        poolAvailable,
        displayPoolRetained,
        activeOverflow,
        stageOverflow,
        poolOverflow
      };
    };

    await switchGame.scene.push('scene-0');
    await waitFrames(10);

    const before = snapshot();
    const diffs = [];
    let residue = false;
    let previous = before;
    for (let step = 1; step < 20; step += 1) {
      await switchGame.scene.replace(`scene-${step}`);
      await waitFrames(10);
      await waitForGcWindow();
      const current = snapshot();
      const diff = await compare(previous, current);
      const references = collectReferences();
      const lowPixelDelta = diff < 0.001;
      const referenceResidue = references.activeOverflow || references.poolOverflow;
      const linkedResidue = lowPixelDelta && referenceResidue;
      diffs.push({ step, diffRatio: diff, lowPixelDelta, referenceResidue, linkedResidue, references });
      if (linkedResidue) residue = true;
      previous = current;
    }

    await waitForGcWindow();
    const after = snapshot();
    const finalDiffRatio = await compare(before, after);
    const finalReferences = collectReferences();

    game.destroy();
    switchGame.destroy();

    return {
      durationMinutes,
      sampleIntervalMinutes: 5,
      memorySamples,
      growthMB,
      sceneSwitch: {
        iterations: 20,
        diffs,
        residueSuspect: residue,
        finalDiffRatio,
        finalReferences,
        beforeSwitchScreenshot: before,
        afterSwitchScreenshot: after,
        finalLowPixelDelta: finalDiffRatio < 0.001,
        finalLinkedResidue: finalDiffRatio < 0.001 && (
          finalReferences.activeOverflow
          || finalReferences.stageOverflow
          || finalReferences.poolOverflow
        ),
        ok: !residue
          && !(finalDiffRatio < 0.001 && (
            finalReferences.activeOverflow
            || finalReferences.stageOverflow
            || finalReferences.poolOverflow
          ))
          && !finalReferences.activeOverflow
          && !finalReferences.stageOverflow
          && !finalReferences.poolOverflow
      }
    };
  }, QA_LONG_MINUTES);
}

function saveDataUrlToFile(dataUrl, filePath) {
  if (!dataUrl || !dataUrl.startsWith('data:image')) return;
  const base64 = dataUrl.split(',')[1] || '';
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
}

async function runVisualChecks() {
  const outDir = path.join(RESULT_DIR, 'visual');
  fs.mkdirSync(outDir, { recursive: true });
  const checks = [];
  let browser;

  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const targets = [
      { name: 'website-editor', url: `${BASE_URL}/website/editor/index.html`, file: 'website-editor.png' },
      { name: 'examples-playground', url: `${BASE_URL}/examples/playground.html`, file: 'examples-playground.png' }
    ];

    for (const target of targets) {
      const page = await context.newPage();
      const messages = [];
      page.on('console', (msg) => messages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => messages.push({ type: 'pageerror', text: `${err.name || 'Error'}: ${err.message}` }));
      const screenshot = path.join(outDir, target.file);
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: screenshot, fullPage: true });
      const hasBlockingConsole = messages.some((message) => (
        message.type === 'error'
        || message.type === 'pageerror'
        || /404|Failed to load resource/i.test(message.text || '')
      ));
      checks.push({
        name: target.name,
        url: target.url,
        status: hasBlockingConsole ? 'fail' : 'pass',
        screenshot,
        consoleMessages: messages
      });
      await page.close();
    }

    await context.close();
    await browser.close();
  } catch (error) {
    checks.push({
      name: 'visual-checks',
      status: 'skip',
      error: error.message
    });
    if (browser) await browser.close().catch(() => {});
  }

  return checks;
}

async function runBrowser(browserDef, runLong) {
  const outDir = path.join(RESULT_DIR, browserDef.name);
  fs.mkdirSync(outDir, { recursive: true });

  const entry = {
    browser: browserDef.name,
    startedAt: new Date().toISOString(),
    status: 'pass',
    runtime: null,
    longRun: null,
    screenshots: {},
    errors: []
  };

  let browser;
  try {
    logStage(`${browserDef.name}: launch`);
    browser = await browserDef.launcher.launch(browserDef.launchOptions);
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    context.setDefaultTimeout(QA_RUNTIME_TIMEOUT_MS);
    const page = await context.newPage();

    const ua = await page.evaluate(() => navigator.userAgent);
    entry.userAgent = ua;

    logStage(`${browserDef.name}: runtime suite`);
    const runtime = await withTimeout(
      runRuntimeSuite(page),
      QA_RUNTIME_TIMEOUT_MS,
      `${browserDef.name} runtime suite timeout`
    );
    entry.runtime = {
      ...runtime.summary,
      consoleMessages: runtime.messages,
      status: runtime.status
    };

    logStage(`${browserDef.name}: screenshot`);
    const baselinePath = path.join(outDir, 'runtime-baseline.png');
    await page.screenshot({ path: baselinePath, fullPage: true });
    entry.screenshots.baseline = baselinePath;

    if (runLong) {
      logStage(`${browserDef.name}: long/switch suite`);
      const long = await withTimeout(
        runLongAndSwitchTest(page),
        QA_LONG_TIMEOUT_MS,
        `${browserDef.name} long/switch suite timeout`
      );
      const beforePath = path.join(outDir, 'longperf-before.png');
      const afterPath = path.join(outDir, 'longperf-after.png');
      saveDataUrlToFile(long.sceneSwitch.beforeSwitchScreenshot, beforePath);
      saveDataUrlToFile(long.sceneSwitch.afterSwitchScreenshot, afterPath);
      entry.longRun = {
        ...long,
        screenshots: {
          before: beforePath,
          after: afterPath
        }
      };

      if (long.growthMB !== null && long.growthMB > 20) {
        entry.status = 'fail';
      }
      if (!long.sceneSwitch.ok) {
        entry.status = 'fail';
      }
    }

    if (entry.runtime.status.all !== true) {
      entry.status = 'fail';
    }

    await context.close();
    await browser.close();
  } catch (error) {
    logStage(`${browserDef.name}: ${error.message}`);
    entry.status = 'skip';
    entry.errors.push(error.message);
    if (browser) await browser.close().catch(() => {});
  }

  return entry;
}

let BASE_URL = '';

async function run() {
  ensureDir();
  const port = await findPort();
  BASE_URL = `http://127.0.0.1:${port}`;
  let viteServer;

  const report = {
    startedAt: START,
    build: {
      artifact: 'dist/omnicore.esm.js',
      exists: fs.existsSync(path.join(ROOT, 'dist', 'omnicore.esm.js'))
    },
    browsers: [],
    visualChecks: [],
    baseUrl: BASE_URL,
    status: 'pass'
  };

  try {
    viteServer = await spawnViteServer(port);
    await waitForServer(BASE_URL, 50000);
    logStage(`server ready: ${BASE_URL}`);

    for (const item of BROWSERS) {
      const doLong = item.name === 'Chrome';
      report.browsers.push(await runBrowser(item, doLong));
    }

    logStage('visual checks');
    report.visualChecks = await runVisualChecks();
    report.status = report.browsers.every((item) => item.status === 'pass')
      && report.visualChecks.every((item) => item.status === 'pass')
      ? 'pass'
      : 'fail';
    report.pages = {
      runtime: `${BASE_URL}/tests/qa/qa-runtime.html`,
      editor: `${BASE_URL}/website/editor/index.html`,
      websitePlayground: `${BASE_URL}/website/playground/index.html`,
      examplesPlayground: `${BASE_URL}/examples/playground.html`
    };
  } catch (error) {
    report.status = 'fail';
    report.setupError = error.message;
  } finally {
    stopProc(viteServer);
  }

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
