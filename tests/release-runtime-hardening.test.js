import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OmniCore, { AudioManager, Camera, Game } from '../src/index.js';

describe('release build hardening', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('copies assets into dist and rewrites absolute or parent-relative asset URLs', async () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-release-build-'));
    mkdirSync(path.join(temp, 'assets', 'images'), { recursive: true });
    mkdirSync(path.join(temp, 'assets', 'audio'), { recursive: true });
    mkdirSync(path.join(temp, 'dist'), { recursive: true });
    writeFileSync(path.join(temp, 'assets', 'images', 'hero.png'), 'hero');
    writeFileSync(path.join(temp, 'assets', 'audio', 'bgm.ogg'), 'bgm');
    writeFileSync(path.join(temp, 'dist', 'index.html'), [
      '<img src="/assets/images/hero.png">',
      '<audio src="../assets/audio/bgm.ogg"></audio>',
      '<script src="./assets/game.js"></script>'
    ].join('\n'));

    const { buildRelease } = await import(pathToFileURL(path.resolve('scripts/build-release.js')).href);
    const report = await buildRelease({
      root: temp,
      assetsDir: 'assets',
      distDir: 'dist',
      skipVite: true
    });
    const html = readFileSync(path.join(temp, 'dist', 'index.html'), 'utf8');

    expect(existsSync(path.join(temp, 'dist', 'assets', 'images', 'hero.png'))).toBe(true);
    expect(existsSync(path.join(temp, 'dist', 'assets', 'audio', 'bgm.ogg'))).toBe(true);
    expect(html).toContain('src="assets/images/hero.png"');
    expect(html).toContain('src="assets/audio/bgm.ogg"');
    expect(html).toContain('src="assets/game.js"');
    expect(report.rewrittenFiles).toEqual([path.join(temp, 'dist', 'index.html')]);
  });

  it('declares npm run build:release and an omni-debug-server command', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(pkg.scripts['build:release']).toBe('node scripts/build-release.js');
    expect(pkg.scripts['omni-debug-server']).toBe('node scripts/log-server.js');
    expect(pkg.bin['omni-debug-server']).toBe('./scripts/log-server.js');
  });

  it('declares an npm publish dry-run gate and validates package contents before release publishing', async () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    const {
      createPublishDryRunReport,
      parseNpmPackJsonOutput,
      resolveNpmPackCommand
    } = await import(pathToFileURL(path.resolve('scripts/npm-publish-dry-run.js')).href);
    const files = [
      'package.json',
      'README.md',
      'LICENSE',
      'src/index.js',
      'dist/omnicore.esm.js',
      'dist/omnicore.d.ts'
    ].map((filePath) => ({ path: filePath, size: 128 }));

    const report = createPublishDryRunReport([{
      name: 'omnicore',
      version: '1.0.0',
      size: 2048,
      unpackedSize: 4096,
      entryCount: files.length,
      files
    }]);
    const missingReport = createPublishDryRunReport([{
      name: 'omnicore',
      version: '1.0.0',
      size: 2048,
      unpackedSize: 4096,
      entryCount: files.length - 1,
      files: files.filter((file) => file.path !== 'dist/omnicore.esm.js')
    }]);

    expect(pkg.scripts['publish:dry-run']).toBe('node scripts/npm-publish-dry-run.js');
    expect(workflow).toContain('npm run publish:dry-run');
    expect(workflow.indexOf('npm run publish:dry-run')).toBeLessThan(workflow.indexOf('npm publish --access public'));
    expect(report.ok).toBe(true);
    expect(report.requiredFiles.every((file) => file.present)).toBe(true);
    expect(missingReport.ok).toBe(false);
    expect(missingReport.violations).toContainEqual(expect.objectContaining({
      code: 'missing-required-file',
      path: 'dist/omnicore.esm.js'
    }));
    expect(parseNpmPackJsonOutput([
      '[OmniCore] API docs generated',
      '[{"id":"omnicore@1.0.0","name":"omnicore","version":"1.0.0","files":[]}]',
      '> omnicore@1.0.0 prepare'
    ].join('\n'))[0].name).toBe('omnicore');
    expect(resolveNpmPackCommand(['pack', '--dry-run', '--json'], 'win32')).toEqual({
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm.cmd pack --dry-run --json']
    });
  });
});

describe('runtime resize, audio recovery, and camera events', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('resizes canvas and updates camera viewport when the window size changes', async () => {
    const container = document.createElement('section');
    Object.defineProperties(container, {
      clientWidth: { configurable: true, value: 640 },
      clientHeight: { configurable: true, value: 360 }
    });
    document.body.appendChild(container);
    const game = new Game({
      parent: container,
      renderer: 'canvas',
      width: 320,
      height: 180,
      autoResize: true,
      autoStart: false
    });

    await game.init();
    Object.defineProperties(container, {
      clientWidth: { configurable: true, value: 960 },
      clientHeight: { configurable: true, value: 540 }
    });
    window.dispatchEvent(new Event('resize'));

    expect(game.core.canvas.width).toBe(960);
    expect(game.core.canvas.height).toBe(540);
    expect(game.renderer.width).toBe(960);
    expect(game.renderer.height).toBe(540);
    expect(game.camera.viewport).toEqual({ width: 960, height: 540 });

    game.destroy();
  });

  it('resumes suspended AudioContext from trusted user gestures and exposes OmniCore.Sound', async () => {
    const listeners = new Map();
    const ownerWindow = {
      addEventListener: vi.fn((event, handler) => listeners.set(event, handler)),
      removeEventListener: vi.fn()
    };
    const context = {
      state: 'suspended',
      resume: vi.fn(async () => {
        context.state = 'running';
      })
    };
    const audio = new AudioManager({ context });

    const binding = audio.installAutoResume({ window: ownerWindow });
    await listeners.get('pointerdown')();

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.state).toBe('running');
    expect(OmniCore.Sound).toBe(AudioManager);

    binding.destroy();
    expect(ownerWindow.removeEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function), expect.any(Object));
  });

  it('emits camera zoom and move events with previous and current transforms', () => {
    const camera = new Camera({ x: 0, y: 0, zoom: 1 });
    const zoom = vi.fn();
    const move = vi.fn();

    camera.on('zoom', zoom);
    camera.on('move', move);
    camera.zoom(2);
    camera.follow({ x: 24, y: 12 }, { lerp: 1 });
    camera.update(16);

    expect(zoom).toHaveBeenCalledWith(expect.objectContaining({
      zoom: 2,
      previousZoom: 1,
      camera
    }));
    expect(move).toHaveBeenCalledWith(expect.objectContaining({
      x: 24,
      y: 12,
      previous: { x: 0, y: 0 },
      camera
    }));
  });
});

describe('device debug server', () => {
  it('exports parser and server factory for the omni-debug-server CLI', async () => {
    const { createDebugLogServer, parseLogServerArgs } = await import(pathToFileURL(path.resolve('scripts/log-server.js')).href);
    const server = createDebugLogServer({ log: vi.fn() });

    expect(parseLogServerArgs(['--port=9898']).port).toBe(9898);
    expect(typeof server.listen).toBe('function');
    expect(typeof server.close).toBe('function');
  });
});
