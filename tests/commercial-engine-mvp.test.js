import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OmniCore, {
  CrashReporter,
  DragonBonesAdapter,
  InputSequence,
  Light2D,
  NetRoom,
  ParticleEditorPanel,
  SpineAdapter,
  StorageManager,
  UIButton,
  UIScrollView,
  UITextInput,
  WebGPURenderer
} from '../src/index.js';
import Loop from '../src/loop/Loop.js';
import { generateApiDocs } from '../src/docs/ApiDocGenerator.js';

describe('commercial engine MVP - rendering group', () => {
  it('initializes a WebGPU renderer and sends draw instructions through a worker bridge', async () => {
    const context = { configure: vi.fn() };
    const device = { queue: { submit: vi.fn() } };
    const adapter = { requestDevice: vi.fn(async () => device) };
    const worker = { postMessage: vi.fn(), terminate: vi.fn() };
    const canvas = {
      width: 320,
      height: 180,
      getContext: vi.fn(() => context),
      transferControlToOffscreen: vi.fn(() => ({ width: 320, height: 180 }))
    };
    const renderer = new WebGPURenderer({
      canvas,
      width: 320,
      height: 180,
      gpu: { requestAdapter: vi.fn(async () => adapter) },
      workerFactory: () => worker
    });

    await renderer.init();
    renderer.renderScene({
      children: [{ type: 'sprite', x: 4, y: 8, width: 16, height: 24, color: '#38bdf8' }]
    });

    expect(renderer.backend).toBe('webgpu');
    expect(context.configure).toHaveBeenCalledWith(expect.objectContaining({ device }));
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'init' }), expect.any(Array));
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'frame',
      instructions: [expect.objectContaining({ op: 'rect', x: 4, y: 8 })]
    }));
  });

  it('resolves framerate caps and supports non-vsync scheduling', () => {
    const loop = new Loop({ framerateCap: 120, vsync: false });
    const autoLoop = new Loop({ framerateCap: 'auto', displayHz: 144 });

    expect(loop.fps).toBe(120);
    expect(loop.frameMs).toBeCloseTo(1000 / 120);
    expect(loop.vsync).toBe(false);
    expect(autoLoop.fps).toBe(144);
  });
});

describe('commercial engine MVP - gameplay and tools group', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('plays Spine and DragonBones skeleton state through a common adapter API', () => {
    const spine = new SpineAdapter().create({ url: '/hero.skel', skins: ['default', 'neon'] });
    const dragon = new DragonBonesAdapter().create({ url: '/enemy.db', skins: ['base'] });

    spine.play('run', { loop: true });
    spine.setSkin('neon');
    dragon.play('attack');

    expect(spine.currentAnimation).toBe('run');
    expect(spine.loop).toBe(true);
    expect(spine.skin).toBe('neon');
    expect(dragon.format).toBe('dragonbones');
    expect(dragon.currentAnimation).toBe('attack');
  });

  it('computes 2D lighting draw commands and shadow polygons for tilemap occluders', () => {
    const light = Light2D.point({ x: 100, y: 60, radius: 160, intensity: 0.8 });
    const directional = Light2D.directional({ angle: Math.PI / 4, intensity: 0.4 });
    const occluder = { x: 120, y: 80, width: 16, height: 16 };

    expect(light.toDrawCommand()).toMatchObject({ type: 'point', x: 100, radius: 160 });
    expect(light.shadowForRect(occluder)).toHaveLength(4);
    expect(directional.toDrawCommand()).toMatchObject({ type: 'directional', intensity: 0.4 });
  });

  it('edits particle parameters in debug mode and exports particle JSON', () => {
    const panel = new ParticleEditorPanel({
      debug: true,
      initial: { rate: 20, lifetime: 0.8, color: '#00ffff' }
    });

    panel.attach(document.body);
    panel.updateParam('rate', 48);

    expect(document.querySelector('[data-omnicore-particle-editor]')).not.toBeNull();
    expect(panel.exportJSON()).toEqual({ rate: 48, lifetime: 0.8, color: '#00ffff' });
  });

  it('recognizes key sequences and emits EventBus events', () => {
    const events = new OmniCore.EventBus();
    const seen = [];
    events.on('input:sequence', (payload) => seen.push(payload.name));
    const sequence = new InputSequence({ events, timeout: 500 });

    sequence.define('dash', ['KeyA', 'KeyD', 'Space']);
    sequence.feed('KeyA', 0);
    sequence.feed('KeyD', 120);
    sequence.feed('Space', 240);

    expect(seen).toEqual(['dash']);
  });

  it('renders pure Canvas UI controls and handles text input and scroll offset', () => {
    const calls = [];
    const ctx = createCanvasSpy(calls);
    const button = new UIButton('Start', { x: 0, y: 0, width: 80, height: 32 });
    const input = new UITextInput({ x: 0, y: 40, width: 140, height: 32, value: 'A' });
    const scroll = new UIScrollView({ x: 0, y: 80, width: 160, height: 64 });

    input.focus();
    input.handleText('I');
    scroll.add(button);
    scroll.scrollTo(24);
    button.render(ctx);
    input.render(ctx);
    scroll.render(ctx);

    expect(input.value).toBe('AI');
    expect(scroll.scrollY).toBe(24);
    expect(calls.some((call) => call[0] === 'fillText' && call[1] === 'Start')).toBe(true);
    expect(calls.some((call) => call[0] === 'clip')).toBe(true);
  });

  it('ships a behavior tree editor page that exports EventSheet JSON', () => {
    const html = readFileSync('website/editor-behaviortree.html', 'utf8');

    expect(html).toContain('data-behavior-tree-editor');
    expect(html).toContain('exportEventSheet');
    expect(html).toContain('draggable');
  });
});

describe('commercial engine MVP - persistence, networking, and engineering group', () => {
  afterEach(() => {
    StorageManager.remove('save:encrypted');
  });

  it('saves and loads encrypted storage without exposing plaintext JSON', () => {
    StorageManager.saveEncrypted('save:encrypted', { level: 3, token: 'secret' }, 'key');
    const raw = globalThis.localStorage?.getItem('save:encrypted') || StorageManager.memory.get('save:encrypted');

    expect(raw).not.toContain('secret');
    expect(StorageManager.loadEncrypted('save:encrypted', 'key')).toEqual({ level: 3, token: 'secret' });
  });

  it('joins a WebSocket room and emits room-scoped messages', () => {
    const sent = [];
    const socket = {
      readyState: 1,
      send: vi.fn((payload) => sent.push(JSON.parse(payload))),
      close: vi.fn()
    };
    const room = new NetRoom({ url: 'ws://localhost:8787', socketFactory: () => socket });

    room.join('arena-1', { playerId: 'p1' });
    room.emit('move', { x: 4, y: 8 });

    expect(sent).toEqual([
      { type: 'join', room: 'arena-1', payload: { playerId: 'p1' } },
      { type: 'event', room: 'arena-1', event: 'move', payload: { x: 4, y: 8 } }
    ]);
  });

  it('captures crashes with Store snapshot, metrics, operation log, and posts to backend', async () => {
    const posted = [];
    const store = new OmniCore.Store({ level: 2 });
    const reporter = new CrashReporter({
      endpoint: '/crash',
      store,
      metrics: { snapshot: () => ({ fps: 59 }) },
      fetcher: async (url, options) => {
        posted.push({ url, body: JSON.parse(options.body) });
        return { ok: true, json: async () => ({ ok: true }) };
      }
    });

    reporter.recordOperation({ type: 'input', key: 'Space' });
    await reporter.capture(new Error('boom'));

    expect(posted[0].url).toBe('/crash');
    expect(posted[0].body.error.message).toBe('boom');
    expect(posted[0].body.store).toEqual({ level: 2 });
    expect(posted[0].body.metrics).toEqual({ fps: 59 });
    expect(posted[0].body.operations).toEqual([{ type: 'input', key: 'Space' }]);
  });

  it('generates structured API documentation from source exports', () => {
    const outDir = path.join(mkdtempSync(path.join(tmpdir(), 'omnicore-api-docs-')), 'api');
    try {
      const result = generateApiDocs({
        srcDir: path.resolve('src'),
        outDir
      });
      const html = readFileSync(path.join(outDir, 'index.html'), 'utf8');
      const manifest = JSON.parse(readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));
      const cname = readFileSync(path.join(outDir, 'CNAME'), 'utf8');

      expect(result.modules.length).toBeGreaterThan(0);
      expect(html).toContain('OmniCore API');
      expect(html).not.toMatch(/[ \t]+$/m);
      expect(manifest.modules.some((module) => module.exports.includes('Game'))).toBe(true);
      expect(cname.trim()).toBe('docs.omnicore.dev');
    } finally {
      rmSync(path.dirname(outDir), { recursive: true, force: true });
    }
  });
});

function createCanvasSpy(calls) {
  return {
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    strokeRect: (...args) => calls.push(['strokeRect', ...args]),
    fillText: (...args) => calls.push(['fillText', ...args]),
    beginPath: () => calls.push(['beginPath']),
    rect: (...args) => calls.push(['rect', ...args]),
    clip: () => calls.push(['clip']),
    translate: (...args) => calls.push(['translate', ...args]),
    clearRect: (...args) => calls.push(['clearRect', ...args]),
    measureText: (text) => ({ width: String(text).length * 8 })
  };
}
