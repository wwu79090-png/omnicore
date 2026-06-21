import { execFileSync } from 'node:child_process';
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
import { afterEach, describe, expect, it } from 'vitest';
import OmniCore, { EditorOverlay } from '../src/index.js';
import AiPathfinding from '../src/addons/AiPathfinding.js';
import UIManager from '../src/addons/UIManager.js';
import ParticlePack from '../src/addons/ParticlePack.js';
import Localization from '../src/addons/Localization.js';
import AudioMixer from '../src/addons/AudioMixer.js';
import ThreeDDecorator from '../src/addons/3DDecorator.js';
import CameraShake from '../src/addons/CameraShake.js';
import DebugConsoleAddon from '../src/addons/DebugConsole.js';
import Achievement from '../src/addons/Achievement.js';
import SaveCloud from '../src/addons/SaveCloud.js';
import Payment from '../src/addons/Payment.js';
import Ad from '../src/addons/Ad.js';
import WechatMiniGameMonetization from '../src/addons/WechatMiniGameMonetization.js';

const addonNames = [
  'AiPathfinding',
  'UIManager',
  'ParticlePack',
  'Localization',
  'AudioMixer',
  '3DDecorator',
  'CameraShake',
  'DebugConsole',
  'Achievement',
  'SaveCloud',
  'Payment',
  'Ad',
  'WechatMiniGameMonetization'
];

const addonModules = {
  AiPathfinding,
  UIManager,
  ParticlePack,
  Localization,
  AudioMixer,
  '3DDecorator': ThreeDDecorator,
  CameraShake,
  DebugConsole: DebugConsoleAddon,
  Achievement,
  SaveCloud,
  Payment,
  Ad,
  WechatMiniGameMonetization
};

describe('production decoupled editor toolchain', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps runtime overlay as a shim while standalone editor renders core panels from Live Sync state', async () => {
    const store = new Map();
    const overlay = new EditorOverlay({
      store: {
        set: (key, value) => store.set(key, value)
      },
      scene: {
        current: {
          name: 'production-editor',
          children: [{ id: 'hero', name: 'Hero', type: 'sprite', x: 16, y: 24 }]
        }
      }
    }).attach();

    expect(store.get('editor:overlay:moved')).toMatchObject({ package: 'omnicore-editor' });
    expect(overlay.exportSceneJson().entities[0]).toMatchObject({ id: 'hero', name: 'Hero' });

    const { createEditorApp } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/editor-app.js')).href);
    const { createEditorState, applyLiveSyncMessage } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/live-sync-protocol.js')).href);
    const root = document.createElement('main');
    document.body.appendChild(root);
    const state = createEditorState({
      scene: {
        entities: [{ id: 'hero', name: 'Hero', x: 16, y: 24, texture: 'hero.png' }]
      },
      tilemap: { width: 8, height: 6, tileWidth: 16, tileHeight: 16 }
    });
    const app = createEditorApp(root, { state });

    expect(root.querySelector('[data-panel="hierarchy"]')?.textContent).toContain('Hero');
    expect(root.querySelector('[data-panel="inspector"]')).toBeTruthy();
    expect(root.querySelector('[data-panel="scene-view"]')).toBeTruthy();
    expect(root.querySelector('[data-panel="tilemap"]')?.textContent).toContain('8x6');
    expect(root.querySelector('[data-panel="animation-timeline"]')).toBeTruthy();

    app.update(applyLiveSyncMessage(state, {
      type: 'runtime:scene',
      payload: { entities: [{ id: 'slime', name: 'Slime', x: 104, y: 72 }] }
    }));
    expect(root.querySelector('[data-panel="hierarchy"]')?.textContent).toContain('Slime');

    overlay.detach();
  });
});

describe('production animation runtime', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('exports easing keyframes, previews playback, wraps Spine Pixi, and drives state transitions', async () => {
    const { AnimationEditor, AnimationStateMachine, SpinePixiRuntimeAdapter } = await import('../src/index.js');
    const editor = new AnimationEditor({
      frames: ['idle-0', 'idle-1'],
      animation: 'walk',
      frameRate: 12
    }).attach(document.body);

    editor.addKeyframe('idle-0', { time: 0, easing: 'linear', rotation: 0, scale: 1, alpha: 1 });
    editor.addKeyframe('idle-1', { time: 1, easing: 'easeInOutQuad', rotation: 1, scale: 2, alpha: 0.5 });
    const preview = editor.playPreview({ from: 0, to: 1, step: 0.5 });
    const animationJson = editor.exportAnimationJson();

    expect(animationJson.animations.walk.keyframes[1]).toMatchObject({ easing: 'easeInOutQuad' });
    expect(preview.frames).toHaveLength(3);
    expect(preview.frames[1]).toMatchObject({ rotation: 0.5, scaleX: 1.5, alpha: 0.75 });

    const pixi = {
      Assets: {
        added: [],
        loaded: [],
        add(entry) {
          this.added.push(entry);
        },
        async load(aliases) {
          this.loaded.push(...aliases);
        }
      }
    };
    class FakeSpine {
      constructor(options) {
        this.options = options;
        this.state = {
          calls: [],
          data: {},
          setAnimation: (track, name, loop) => this.state.calls.push({ track, name, loop })
        };
      }
    }
    const adapter = new SpinePixiRuntimeAdapter({ pixi, spine: { Spine: FakeSpine } });
    const spineEntity = await adapter.create({
      alias: 'hero',
      skeleton: 'assets/spine/hero.skel',
      atlas: 'assets/spine/hero.atlas',
      scale: 0.5
    });
    spineEntity.play('attack', true);

    expect(pixi.Assets.added).toEqual([
      { alias: 'heroData', src: 'assets/spine/hero.skel' },
      { alias: 'heroAtlas', src: 'assets/spine/hero.atlas' }
    ]);
    expect(pixi.Assets.loaded).toEqual(['heroData', 'heroAtlas']);
    expect(spineEntity.displayObject.options).toMatchObject({ skeleton: 'heroData', atlas: 'heroAtlas', scale: 0.5 });
    expect(spineEntity.displayObject.state.calls).toEqual([{ track: 0, name: 'attack', loop: true }]);

    const played = [];
    const entity = {
      play(name, loop) {
        played.push({ name, loop });
      }
    };
    const machine = new AnimationStateMachine(entity, {
      initial: 'idle',
      states: {
        idle: { animation: 'idle', loop: true },
        walk: { animation: 'walk', loop: true },
        attack: { animation: 'attack', loop: false }
      },
      transitions: [
        { from: 'idle', to: 'walk', when: ({ moving }) => moving },
        { from: 'walk', to: 'attack', when: ({ attacking }) => attacking },
        { from: 'attack', to: 'idle', when: ({ done }) => done }
      ]
    });

    machine.start();
    machine.update({ moving: true });
    machine.update({ attacking: true });
    machine.update({ done: true });

    expect(played).toEqual([
      { name: 'idle', loop: true },
      { name: 'walk', loop: true },
      { name: 'attack', loop: false },
      { name: 'idle', loop: true }
    ]);
  });
});

describe('production asset pipeline automation', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('packs grouped sprites, rewrites scene references, emits an asset graph, and skips unchanged groups', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-pack-assets-'));
    const assets = path.join(temp, 'assets');
    const sprites = path.join(assets, 'sprites', 'characters');
    const prefabs = path.join(assets, 'prefabs');
    const scenes = path.join(temp, 'scenes');
    const out = path.join(temp, 'dist');
    mkdirSync(sprites, { recursive: true });
    mkdirSync(prefabs, { recursive: true });
    mkdirSync(scenes, { recursive: true });
    writeFileSync(path.join(sprites, 'hero.png'), 'hero-image');
    writeFileSync(path.join(sprites, 'slime.png'), 'slime-image');
    writeFileSync(path.join(sprites, 'unused.png'), 'unused-image');
    writeFileSync(path.join(prefabs, 'crate.json'), JSON.stringify({
      name: 'crate',
      type: 'sprite',
      texture: 'assets/sprites/characters/hero.png',
      props: {
        icon: 'assets/sprites/characters/slime.png'
      }
    }, null, 2));
    writeFileSync(path.join(scenes, 'level.json'), JSON.stringify({
      entities: [
        { id: 'hero', texture: 'assets/sprites/characters/hero.png' },
        { id: 'slime', texture: 'assets/sprites/characters/slime.png' }
      ],
      prefabs: ['assets/prefabs/crate.json']
    }, null, 2));

    const args = [
      'scripts/pack-assets.js',
      '--assets',
      assets,
      '--scenes',
      scenes,
      '--out',
      out
    ];
    const first = JSON.parse(execFileSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' }));
    const second = JSON.parse(execFileSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' }));
    const atlas = JSON.parse(readFileSync(path.join(out, 'atlases', 'characters.atlas.json'), 'utf8'));
    const rewritten = JSON.parse(readFileSync(path.join(out, 'scenes', 'level.json'), 'utf8'));
    const graph = JSON.parse(readFileSync(path.join(out, 'asset-graph.json'), 'utf8'));

    expect(first.packed).toBe(1);
    expect(second.skipped).toBeGreaterThanOrEqual(1);
    expect(atlas.frames).toMatchObject({
      'hero.png': expect.objectContaining({ texture: 'atlases/characters.png' }),
      'slime.png': expect.objectContaining({ texture: 'atlases/characters.png' })
    });
    expect(rewritten.entities.map((entity) => entity.texture)).toEqual([
      'atlases/characters.atlas.json#hero.png',
      'atlases/characters.atlas.json#slime.png'
    ]);
    expect(graph.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        group: 'characters',
        output: 'atlases/characters.atlas.json',
        dependencies: expect.arrayContaining(['assets/sprites/characters/hero.png'])
      })
    ]));
    expect(graph.sceneDependencies).toEqual([
      expect.objectContaining({
        scene: 'level.json',
        dependencies: expect.objectContaining({
          images: expect.arrayContaining([
            'assets/sprites/characters/hero.png',
            'assets/sprites/characters/slime.png'
          ]),
          prefabs: ['assets/prefabs/crate.json']
        })
      })
    ]);
    expect(graph.prefabDependencies).toEqual([
      expect.objectContaining({
        prefab: 'assets/prefabs/crate.json',
        dependencies: expect.objectContaining({
          images: expect.arrayContaining([
            'assets/sprites/characters/hero.png',
            'assets/sprites/characters/slime.png'
          ])
        })
      })
    ]);
    expect(first.deadAssets).toEqual([
      expect.objectContaining({
        path: 'assets/sprites/characters/unused.png',
        reason: 'not-referenced'
      })
    ]);
    expect(graph.deadAssets).toEqual(first.deadAssets);
  });

  it('builds multiple platform asset variants in one command', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-platform-targets-'));
    const assets = path.join(temp, 'assets');
    const out = path.join(temp, 'platform');
    mkdirSync(assets, { recursive: true });
    writeFileSync(path.join(assets, 'hero.png'), '1234567890');
    writeFileSync(path.join(assets, 'assets.manifest.json'), JSON.stringify({
      images: [{ type: 'image', name: 'hero', path: 'hero.png', url: 'hero.png' }]
    }, null, 2));

    execFileSync(process.execPath, [
      'scripts/build-platform-assets.js',
      '--targets',
      'web,wechat',
      '--assets',
      assets,
      '--manifest',
      path.join(assets, 'assets.manifest.json'),
      '--out',
      out
    ], { cwd: process.cwd(), encoding: 'utf8' });

    const webReport = JSON.parse(readFileSync(path.join(out, 'web', 'asset-package-report.json'), 'utf8'));
    const wechatReport = JSON.parse(readFileSync(path.join(out, 'wechat', 'asset-package-report.json'), 'utf8'));
    expect(webReport.target).toBe('web');
    expect(wechatReport.target).toBe('wechat');
    expect(wechatReport.estimatedBytes).toBeLessThan(webReport.estimatedBytes);
  });
});

describe('production device matrix and WeChat testing', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('declares mobile browser projects and a constrained low-end Android CI job', () => {
    const playwrightConfig = readFileSync('playwright.config.js', 'utf8');
    const workflow = readFileSync('.github/workflows/benchmark.yml', 'utf8');

    expect(playwrightConfig).toContain("name: 'iPhone 12'");
    expect(playwrightConfig).toContain("name: 'Pixel 5'");
    expect(playwrightConfig).toContain("name: 'Samsung Galaxy S10'");
    expect(workflow).toContain('low-end-android');
    expect(workflow).toContain('OMNICORE_DEVICE_CPU_CORES: 2');
    expect(workflow).toContain('OMNICORE_DEVICE_MEMORY_GB: 4');
  });

  it('creates a WeChat developer tools import package and HTML performance report', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-wechat-test-'));
    execFileSync(process.execPath, [
      'scripts/test-wechat.js',
      '--out',
      temp,
      '--scene',
      'complex-scene'
    ], { cwd: process.cwd(), encoding: 'utf8' });

    expect(existsSync(path.join(temp, 'project.config.json'))).toBe(true);
    expect(existsSync(path.join(temp, 'game.json'))).toBe(true);
    expect(existsSync(path.join(temp, 'game.js'))).toBe(true);
    const logs = JSON.parse(readFileSync(path.join(temp, 'console-log.json'), 'utf8'));
    const report = readFileSync(path.join(temp, 'performance-report.html'), 'utf8');

    expect(logs).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'info', message: expect.stringContaining('complex-scene') })
    ]));
    expect(report).toContain('OmniCore WeChat Performance Report');
    expect(report).toContain('complex-scene');
  });
});

describe('production examples and official addons', () => {
  it('ships runnable platformer, RPG, and tilemap templates', () => {
    const templates = [
      ['template-platformer', ['gravity', 'jump', 'platform']],
      ['template-rpg', ['dialogueTree', 'inventory', 'topDown']],
      ['template-tilemap', ['Tiled', 'collision', 'parallax']]
    ];

    for (const [name, markers] of templates) {
      const root = path.join('examples', name);
      expect(existsSync(path.join(root, 'package.json'))).toBe(true);
      expect(existsSync(path.join(root, 'README.md'))).toBe(true);
      expect(existsSync(path.join(root, 'index.html'))).toBe(true);
      expect(existsSync(path.join(root, 'src', 'main.js'))).toBe(true);
      const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
      const readme = readFileSync(path.join(root, 'README.md'), 'utf8');
      const main = readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
      expect(pkg.scripts.dev).toContain('vite');
      expect(readme).toContain('npm install && npm run dev');
      for (const marker of markers) expect(main).toContain(marker);
    }
  });

  it('exposes 13 official addons with README usage and OmniCore.use one-line enablement', async () => {
    expect(typeof OmniCore.use).toBe('function');
    for (const name of addonNames) {
      const source = path.join('src', 'addons', `${name}.js`);
      const readmePath = path.join('src', 'addons', `${name}.README.md`);
      expect(existsSync(source)).toBe(true);
      expect(existsSync(readmePath)).toBe(true);
      const addon = addonModules[name];
      const readme = readFileSync(readmePath, 'utf8');
      expect(addon).toMatchObject({ name });
      expect(typeof addon.install).toBe('function');
      expect(readme).toContain('OmniCore.use()');
    }
  });
});
