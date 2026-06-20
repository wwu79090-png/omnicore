import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OmniCore, {
  AssetManifestGraph,
  DeterministicReplay,
  EditorProtocol,
  EventBus,
  InputManager,
  MultiplayerSession,
  OmniCoreErrorBoundary,
  PluginPermissionSandbox,
  Scene,
  SeededRandom,
  StorageManager,
  UIFocusManager,
  buildApiSurface,
  diffApiSurface
} from '../src/index.js';

describe('P0 foundation closure', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('classifies API tiers and reports breaking public export removals', () => {
    const surface = buildApiSurface({
      Game: function Game() {},
      WebGPURenderer: {},
      DebugRenderer: {}
    }, {
      public: ['Game'],
      experimental: ['WebGPURenderer'],
      internal: ['DebugRenderer']
    });

    const diff = diffApiSurface(surface, {
      tiers: {
        public: [],
        experimental: ['WebGPURenderer'],
        internal: ['DebugRenderer']
      }
    });

    expect(surface.tiers).toMatchObject({
      public: ['Game'],
      experimental: ['WebGPURenderer'],
      internal: ['DebugRenderer']
    });
    expect(diff.breaking).toBe(true);
    expect(diff.removedPublic).toEqual(['Game']);
    expect(OmniCore.ApiSurface).toBeTruthy();
  });

  it('routes recoverable runtime errors through a unified boundary', () => {
    const events = new EventBus();
    const emitted = [];
    events.on('runtime:error', (payload) => emitted.push(payload));
    const boundary = new OmniCoreErrorBoundary({
      module: 'Renderer',
      events,
      recover: () => 'canvas'
    });

    const result = boundary.run(() => {
      throw new Error('GPU device lost');
    }, {
      phase: 'renderer:init',
      fallback: 'webgl'
    });

    expect(result).toBe('canvas');
    expect(boundary.snapshot().errors[0]).toMatchObject({
      module: 'Renderer',
      phase: 'renderer:init',
      recoverable: true
    });
    expect(emitted[0].error.message).toContain('[OmniCore] [Renderer]');
  });

  it('tracks scene lifecycle states and releases owned resources once', () => {
    const scene = new Scene('battle');
    const texture = { id: 'hero-texture', destroy: vi.fn() };
    const lateCallback = scene.guardCallback(() => 'alive', { fallback: 'destroyed' });

    scene.trackResource(texture, { type: 'texture' });
    scene.enter({ spawn: 'north' });

    expect(scene.lifecycle.snapshot()).toMatchObject({
      name: 'battle',
      state: 'enter',
      destroyed: false
    });
    expect(scene.getResourceReport().resources[0]).toMatchObject({
      id: 'hero-texture',
      type: 'texture',
      refCount: 1
    });
    expect(lateCallback()).toBe('alive');

    scene.destroy();

    expect(texture.destroy).toHaveBeenCalledTimes(1);
    expect(texture.destroy).toHaveBeenCalledWith(true);
    expect(scene.lifecycle.snapshot()).toMatchObject({
      state: 'destroyed',
      destroyed: true,
      aborted: true
    });
    expect(lateCallback()).toBe('destroyed');
  });

  it('maps keyboard, pointer, touch, and gamepad inputs into modal-safe actions', () => {
    const input = new InputManager();
    const events = [];
    input.events.on('action:jump', (payload) => events.push(payload));

    input.mapAction('jump', [
      'Space',
      { type: 'pointer', event: 'down' },
      { type: 'touch', event: 'down' },
      { type: 'gamepad', index: 0, button: 0, threshold: 0.5 }
    ]);
    input.keyboard.press('Space');

    expect(input.isActionDown('jump')).toBe(true);
    input.triggerAction('jump', { down: true, source: 'manual' });
    expect(input.justActionDown('jump')).toBe(true);

    input.setGamepadState(0, { buttons: [{ value: 1 }] });
    expect(events.some((payload) => payload.source === 'gamepad')).toBe(true);

    const disposeScope = input.pushFocusScope({ id: 'dialog', actions: ['confirm'] });
    expect(input.isActionAllowed('jump')).toBe(false);
    disposeScope();
    expect(input.isActionAllowed('jump')).toBe(true);
  });
});

describe('P1 product runtime closure', () => {
  afterEach(() => {
    StorageManager.memory.clear();
    globalThis.localStorage?.clear?.();
    StorageManager.configureSaveSlots({ prefix: 'omnicore:save:slot:' });
  });

  it('saves versioned slots atomically with schema validation, backups, rollback, and cloud hooks', async () => {
    const cloud = {
      save: vi.fn(async () => true),
      load: vi.fn()
    };
    StorageManager.configureSaveSlots({ prefix: 'test:save:' });

    await StorageManager.saveSlot('slot1', { hp: 5, name: 'Hero' }, {
      schema: saveSchema(),
      cloudAdapter: cloud
    });
    await StorageManager.saveSlot('slot1', { hp: 10, name: 'Hero' }, {
      schema: saveSchema(),
      cloudAdapter: cloud
    });

    await expect(StorageManager.loadSlot('slot1', { schema: saveSchema() })).resolves.toMatchObject({
      hp: 10,
      name: 'Hero',
      __version: StorageManager.engineVersion
    });
    expect(StorageManager.listSlots({ prefix: 'test:save:' })).toContain('slot1');
    expect(cloud.save).toHaveBeenCalledTimes(2);

    const rollback = StorageManager.rollbackSlot('slot1');
    expect(rollback).toMatchObject({ hp: 5 });
    await expect(StorageManager.loadSlot('slot1', { schema: saveSchema() })).resolves.toMatchObject({ hp: 5 });
  });

  it('configures standard audio buses, persists mixer state, and creates streaming BGM descriptors', () => {
    const storage = createMemoryStorage();
    const audio = new OmniCore.AudioManager({ context: createAudioContextSpy() });

    audio.configureStandardBuses({ music: 0.4, sfx: 0.7 });
    audio.duck('music', { amount: 0.25, trigger: 'voice' });
    const saved = audio.saveMixerState(storage);

    const restored = new OmniCore.AudioManager({ context: createAudioContextSpy() });
    restored.loadMixerState(storage);
    const stream = restored.createStream('theme', {
      url: '/audio/theme.ogg',
      bus: 'music',
      loop: true
    });
    const voice = restored.playStream('theme');

    expect(saved.buses.music.volume).toBe(0.4);
    expect(restored.getBus('music')).toMatchObject({ volume: 0.4 });
    expect(stream).toMatchObject({ type: 'audio-stream', bus: 'music' });
    expect(voice).toMatchObject({ playing: true, loop: true });
  });

  it('manages UI focus, modal shortcut capture, accessibility roles, and safe-area anchors', () => {
    const focus = new UIFocusManager({
      viewport: { width: 320, height: 180 },
      safeArea: { top: 10, right: 8, bottom: 12, left: 6 }
    });

    focus.register({ id: 'name', focus: vi.fn(), blur: vi.fn() }, {
      role: 'textbox',
      label: 'Player name',
      shortcuts: ['Enter']
    });
    focus.focus('name');
    focus.pushModal('name');

    expect(focus.areShortcutsEnabled()).toBe(false);
    expect(focus.resolveAnchor('bottomRight', { width: 40, height: 20 })).toEqual({ x: 272, y: 148 });
    expect(focus.snapshot().elements[0]).toMatchObject({
      id: 'name',
      aria: { role: 'textbox', label: 'Player name' }
    });
  });

  it('enforces plugin permissions and records deterministic replay files', () => {
    const store = createMemoryStorage();
    store.set('score', 7);
    const sandbox = new PluginPermissionSandbox({
      name: 'combat-tools',
      permissions: ['store:read', 'events:emit'],
      context: {
        store,
        events: new EventBus()
      }
    });
    const api = sandbox.createApi();

    expect(api.store.get('score')).toBe(7);
    expect(() => api.net.request('/admin')).toThrow(/missing permission: net:request/);

    const rngA = new SeededRandom(42);
    const rngB = new SeededRandom(42);
    expect([rngA.next(), rngA.next()]).toEqual([rngB.next(), rngB.next()]);

    const replay = new DeterministicReplay({ seed: 99, fixedDelta: 0.016 });
    replay.recordInput('move-right', { frame: 0, source: 'keyboard' });
    const reducer = (state, frame) => ({
      x: Number(state.x || 0) + (frame.inputs.some((input) => input.action === 'move-right') ? 1 : 0),
      frame: frame.index
    });
    replay.step({ x: 0 }, reducer);
    const playback = replay.playback({ x: 0 }, reducer);

    expect(playback.state).toEqual({ x: 1, frame: 0 });
    expect(playback.hash).toBe(replay.hash());
  });
});

describe('P2 ecosystem foundation closure', () => {
  it('builds canonical asset manifests with hashes, variants, dependency edges, and dead resources', () => {
    const manifest = AssetManifestGraph.fromAssets([
      { key: 'hero.png', url: 'hero.png', size: 120 },
      { key: 'unused.png', url: 'unused.png', size: 40 }
    ], {
      references: {
        'scenes/level-1.json': ['hero.png']
      },
      platformVariants: {
        wechat: { basePath: '/assets/wechat', scale: 0.5, textureQuality: 0.7 }
      }
    });

    expect(manifest.assets[0]).toMatchObject({
      key: 'hero.png',
      type: 'image',
      variants: {
        wechat: expect.objectContaining({ scale: 0.5, quality: 0.7 })
      }
    });
    expect(manifest.dependencies['scenes/level-1.json']).toEqual(['hero.png']);
    expect(manifest.deadResources).toEqual(['unused.png']);
    expect(manifest.contentHash).toBeTruthy();
  });

  it('negotiates editor protocol versions and protects hot-edit transactions', () => {
    const protocol = new EditorProtocol();
    const handshake = protocol.negotiate({ supportedVersions: [protocol.version] });
    const tx = protocol.beginTransaction('edit-1', { selected: 'hero' });

    protocol.recordCommand('edit-1', {
      protocol: protocol.version,
      type: 'editor:update-entity',
      payload: { id: 'hero', patch: { x: 32 } }
    });

    expect(handshake).toMatchObject({
      ok: true,
      capabilities: { transactions: true, rollback: true, pausedHotEdit: true }
    });
    expect(protocol.commit('edit-1')).toMatchObject({ state: 'committed', commands: [expect.any(Object)] });
    expect(tx.commands[0]).toMatchObject({ type: 'editor:update-entity' });
    expect(() => protocol.validate({ type: 'editor:delete-project' })).toThrow(/Unsupported editor command/);
  });

  it('provides a multiplayer baseline for rooms, reconnects, prediction, state diffing, and rollback', () => {
    const room = { join: vi.fn() };
    const session = new MultiplayerSession({ room, reconnect: { retries: 2, delayMs: 100 } });

    session.join('arena', { token: 'local' });
    const diff = session.applyServerState({ x: 10, y: 4 }, { tick: 7 });
    const prediction = session.predict({ type: 'move', dx: 2, dy: -1 });
    const rolledBack = session.rollback(prediction.id);

    expect(room.join).toHaveBeenCalledWith('arena', { token: 'local' });
    expect(diff).toMatchObject({ x: { before: undefined, after: 10 } });
    expect(prediction.after).toMatchObject({ x: 12, y: 3 });
    expect(rolledBack).toEqual({ x: 10, y: 4 });
    expect(session.reconnectPlan('socket-close')).toEqual({
      reason: 'socket-close',
      retries: 2,
      delayMs: 100,
      room: 'arena'
    });
  });

  it('ships handbook and standard production template entry points', () => {
    const handbook = readFileSync('docs/engine-handbook.md', 'utf8');
    const templates = [
      'rpg',
      'platformer',
      'visual-novel',
      'card-battle',
      'html-ui-migration',
      'wechat-minigame'
    ];

    expect(handbook).toContain('API Governance');
    expect(handbook).toContain('Privacy And Telemetry');
    for (const template of templates) {
      expect(existsSync(`examples/templates/${template}/README.md`)).toBe(true);
    }
  });
});

function saveSchema() {
  return {
    required: ['hp', 'name'],
    properties: {
      hp: { type: 'number' },
      name: { type: 'string' }
    }
  };
}

function createMemoryStorage() {
  const map = new Map();
  return {
    get: (key, fallback = null) => (map.has(key) ? map.get(key) : fallback),
    set: (key, value) => {
      map.set(key, value);
      return value;
    },
    remove: (key) => map.delete(key)
  };
}

function createAudioContextSpy() {
  return {
    currentTime: 1,
    destination: {},
    createDynamicsCompressor: vi.fn(() => createAudioNode({
      threshold: { value: 0 },
      knee: { value: 0 },
      ratio: { value: 0 },
      attack: { value: 0 },
      release: { value: 0 }
    })),
    createGain: vi.fn(() => createAudioNode({
      gain: {
        value: 1,
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn()
      }
    }))
  };
}

function createAudioNode(extra = {}) {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    ...extra
  };
}
