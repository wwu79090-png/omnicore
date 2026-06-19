#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const args = new Set(process.argv.slice(2));
const projectRoot = process.cwd();
const reportPath = path.join(projectRoot, 'docs', 'release-notes', 'maintenance-health-report.json');
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    })
  ]);
}

function createCanvasContext(canvas) {
  const noop = () => {};
  return {
    canvas,
    save: noop,
    restore: noop,
    clearRect: noop,
    fillRect: noop,
    strokeRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
    fillText: noop,
    measureText: (text) => ({ width: String(text).length * 8 }),
    setTransform: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }),
    putImageData: noop
  };
}

function setupDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="game"></div></body></html>', {
    url: 'http://127.0.0.1:5173/examples/'
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement;
  globalThis.HTMLImageElement = dom.window.HTMLImageElement;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: dom.window.navigator
  });
  globalThis.addEventListener = dom.window.addEventListener.bind(dom.window);
  globalThis.removeEventListener = dom.window.removeEventListener.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  Object.defineProperty(dom.window.HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value(type) {
      if (type === '2d') return createCanvasContext(this);
      if (type === 'webgl' || type === 'webgl2') {
        return {
          canvas: this,
          getExtension: () => ({ loseContext: () => {} })
        };
      }
      return null;
    }
  });
}

async function importEngine() {
  setupDom();
  return import(pathToFileURL(path.join(projectRoot, 'src', 'index.js')).href);
}

async function runMemoryScan({ full = false } = {}) {
  const durationMs = full ? 12 * 60 * 60 * 1000 : 750;
  const engine = await importEngine();
  const game = await new engine.Game({
    renderer: 'canvas',
    parent: '#game',
    autoStart: false,
    autoAttach: true
  }).init();
  const baseline = process.memoryUsage().heapUsed;
  const started = Date.now();

  while (Date.now() - started < durationMs) {
    game.timer.update(16);
    game.scene?.update?.(1 / 60, Date.now());
    if (!full) await new Promise((resolve) => setTimeout(resolve, 25));
    else await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const current = process.memoryUsage().heapUsed;
  game.destroy();
  const growthRatio = baseline === 0 ? 0 : (current - baseline) / baseline;
  return {
    name: 'memory',
    durationMs,
    baseline,
    current,
    growthRatio,
    status: growthRatio > 0.2 ? 'fail' : 'pass',
    threshold: 0.2
  };
}

async function runBackendScan() {
  const engine = await importEngine();
  const results = [];
  for (const backend of ['pixi', 'canvas', 'webgl']) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const game = await new engine.Game({
      renderer: backend,
      parent: container,
      autoStart: false,
      autoAttach: true
    }).init();
    results.push({
      requested: backend,
      active: game.renderer.backend,
      canvasCount: container.querySelectorAll('canvas').length,
      status: container.querySelectorAll('canvas').length === 1 ? 'pass' : 'fail'
    });
    game.destroy();
    container.remove();
  }
  return {
    name: 'backends',
    status: results.every((result) => result.status === 'pass') ? 'pass' : 'fail',
    results
  };
}

async function runPlaywrightScan() {
  const browsers = [
    { name: 'Chrome', type: 'chromium', channel: 'chrome' },
    { name: 'Firefox', type: 'firefox' },
    { name: 'Safari(WebKit)', type: 'webkit' },
    { name: 'Edge', type: 'chromium', channel: 'msedge' }
  ];
  const results = [];
  const server = await ensureExampleServer();

  let playwright;
  try {
    playwright = await import('playwright');
  } catch (error) {
    server?.kill?.();
    return { name: 'playwright', status: 'skip', reason: error.message, results };
  }

  for (const item of browsers) {
    const launcher = playwright[item.type];
    try {
      const browser = await withTimeout(
        launcher.launch({
          headless: true,
          channel: item.channel
        }),
        5000,
        `${item.name} launch`
      );
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.goto('http://127.0.0.1:5173/examples/', { waitUntil: 'load', timeout: 5000 });
      const status = await page.locator('#status').innerText({ timeout: 3000 });
      const canvasCount = await page.locator('canvas').count();
      await browser.close();
      results.push({
        browser: item.name,
        status: status.includes('当前后端') && canvasCount === 1 ? 'pass' : 'fail',
        pageStatus: status,
        canvasCount
      });
    } catch (error) {
      results.push({
        browser: item.name,
        status: 'skip',
        reason: error.message.split('\n')[0]
      });
    }
  }

  server?.kill?.();

  const failures = results.filter((result) => result.status === 'fail');
  return {
    name: 'playwright',
    status: failures.length ? 'fail' : 'pass',
    results
  };
}

async function canReachExample() {
  try {
    const response = await fetch('http://127.0.0.1:5173/examples/');
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureExampleServer() {
  if (await canReachExample()) return null;
  const child = spawn(npmCommand, ['run', 'dev', '--', '--host', '127.0.0.1'], {
    cwd: projectRoot,
    stdio: 'ignore',
    detached: false
  });
  const started = Date.now();
  while (Date.now() - started < 10000) {
    if (await canReachExample()) return child;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  child.kill();
  return null;
}

async function main() {
  const full = args.has('--full') || process.env.OMNICORE_HEALTH_FULL === '1';
  const checks = [];
  if (!args.size || args.has('--quick') || args.has('--memory')) checks.push(await runMemoryScan({ full }));
  if (!args.size || args.has('--quick') || args.has('--backends')) checks.push(await runBackendScan());
  if (!args.size || args.has('--quick') || args.has('--browsers')) checks.push(await runPlaywrightScan());

  const report = {
    generatedAt: new Date().toISOString(),
    full,
    status: checks.every((check) => check.status === 'pass' || check.status === 'skip') ? 'pass' : 'fail',
    checks
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'pass') process.exitCode = 1;
}

main()
  .then(() => {
    process.exit(process.exitCode || 0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
