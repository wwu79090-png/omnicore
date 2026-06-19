import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import OmniCore, { Dimension3D } from '../src/index.js';

const officialPlugins = [
  'AiPathfinding',
  'UIManager',
  'ParticlePack',
  'Localization',
  'AudioMixer',
  '3DDecorator',
  'CameraShake',
  'DebugConsole',
  'Achievement',
  'SaveCloud'
];

describe('decoupled editor and runtime packages', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('ships omnicore-runtime and standalone omnicore-editor without editor imports into runtime core', async () => {
    expect(existsSync('packages/omnicore-runtime/package.json')).toBe(true);
    expect(existsSync('packages/omnicore-editor/package.json')).toBe(true);
    expect(existsSync('packages/omnicore-editor/electron.main.cjs')).toBe(true);
    expect(existsSync('packages/omnicore-editor/vite.config.js')).toBe(true);

    const editorFiles = listFiles('packages/omnicore-editor/src').filter((file) => file.endsWith('.js'));
    const editorSource = editorFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(editorSource).not.toMatch(/from ['"].*src\//);
    expect(editorSource).not.toContain('omnicore-runtime');
    expect(editorSource).not.toContain('../src/index.js');

    const overlaySource = readFileSync('src/debug/EditorOverlay.js', 'utf8');
    expect(overlaySource).not.toContain('omnicore-editor-overlay');
    expect(overlaySource).not.toContain('../editor/AnimationEditor');
    expect(overlaySource).not.toContain('PrefabManager');
    expect(overlaySource).toContain('omnicore-editor');

    const { createEditorApp } = await importFile('packages/omnicore-editor/src/editor-app.js');
    const { createEditorState, applyLiveSyncMessage } = await importFile('packages/omnicore-editor/src/live-sync-protocol.js');
    const root = document.createElement('main');
    document.body.appendChild(root);
    const state = createEditorState({
      scene: {
        entities: [{ id: 'hero', name: 'Hero', x: 10, y: 20, texture: 'hero.png' }]
      }
    });
    const app = createEditorApp(root, { state });

    expect(root.querySelector('[data-panel="hierarchy"]')?.textContent).toContain('Hero');
    expect(root.querySelector('[data-panel="inspector"]')).toBeTruthy();
    expect(root.querySelector('[data-panel="scene-view"]')).toBeTruthy();
    expect(root.querySelector('[data-panel="tilemap"]')).toBeTruthy();
    expect(root.querySelector('[data-panel="animation-timeline"]')).toBeTruthy();

    const next = applyLiveSyncMessage(state, {
      type: 'runtime:scene',
      payload: { entities: [{ id: 'npc', name: 'NPC', x: 40, y: 50 }] }
    });
    app.update(next);
    expect(root.querySelector('[data-panel="hierarchy"]')?.textContent).toContain('NPC');
  });

  it('defines a WebSocket Live Sync protocol and runtime bridge without editor UI coupling', async () => {
    const { createLiveSyncMessage, applyLiveSyncMessage } = await importFile('packages/omnicore-editor/src/live-sync-protocol.js');
    const { RuntimeLiveSyncBridge } = await importFile('src/editor/RuntimeLiveSyncBridge.js');
    const sent = [];
    const bridge = new RuntimeLiveSyncBridge({
      game: {
        scene: { current: { name: 'level', children: [{ id: 'hero', x: 1, y: 2 }] } },
        store: { set: (key, value) => sent.push({ key, value }) }
      },
      transport: { send: (message) => sent.push(JSON.parse(message)) }
    });

    bridge.publishScene();
    const message = createLiveSyncMessage('editor:update-entity', { id: 'hero', patch: { x: 32 } });
    const state = applyLiveSyncMessage(undefined, message);

    expect(sent[0]).toMatchObject({ type: 'runtime:scene', payload: { name: 'level' } });
    expect(state.pendingCommands[0]).toMatchObject({ id: 'hero', patch: { x: 32 } });
    expect(typeof OmniCore.connectEditorSync).toBe('function');
  });
});

describe('Dimension3D 2.5D runtime integration', () => {
  it('maps 3D world coordinates to 2D screen coordinates and back with stable precision', () => {
    const scene = new Dimension3D.Scene({ width: 800, height: 400 });
    const screen = scene.worldToScreen({ x: 2, y: 1, z: 0 });
    const world = scene.screenToWorld(screen);

    expect(screen).toMatchObject({ x: 600, y: 100 });
    expect(world.x).toBeCloseTo(2, 3);
    expect(world.y).toBeCloseTo(1, 3);
    expect(world.z).toBeCloseTo(0, 3);
    expect(scene['3DTo2DCoord']({ x: 2, y: 1, z: 0 })).toEqual(screen);
  });

  it('supports model/light/skybox records, Character3D AABB collision, and raycaster picking', () => {
    const scene = new Dimension3D.Scene({ width: 800, height: 400 });
    const model = scene.addModel({ id: 'crate', url: 'crate.glb', position: { x: 0, y: 0, z: 0 }, bounds: { width: 2, height: 2, depth: 2 } });
    const light = scene.addLight('directional', { intensity: 2 });
    const skybox = scene.setSkybox({ texture: 'sky.hdr' });
    const character = scene.addCharacter2D({
      id: 'hero',
      sprite: { x: 390, y: 190, width: 32, height: 48 },
      depth: 0,
      scale: 0.05
    });
    const picked = scene.pickModelAt({ x: 400, y: 200 });

    expect(model).toMatchObject({ id: 'crate', type: 'Model' });
    expect(light).toMatchObject({ type: 'Light', lightType: 'directional' });
    expect(skybox).toMatchObject({ type: 'Skybox', texture: 'sky.hdr' });
    expect(character.aabb).toMatchObject({ minX: expect.any(Number), maxX: expect.any(Number) });
    expect(character.intersects(model)).toBe(true);
    expect(picked).toMatchObject({ id: 'crate', highlighted: true });
  });
});

describe('asset importer, intelligent atlas, and platform variants', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('imports source-assets, emits converted manifests, packs static-analysis atlases, and resolves platform variants', async () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-industrial-assets-'));
    const source = path.join(temp, 'source-assets');
    const out = path.join(temp, 'dist-assets');
    mkdirSync(source, { recursive: true });
    writeFileSync(path.join(source, 'hero.aseprite'), 'aseprite-source');
    writeFileSync(path.join(source, 'portrait.psd'), 'psd-source');
    writeFileSync(path.join(source, 'hit.wav'), 'wav-source');
    writeFileSync(path.join(source, 'enemy.fbx'), 'fbx-source');
    writeFileSync(path.join(source, 'crate.gltf'), '{"asset":{"version":"2.0"}}');
    writeFileSync(path.join(source, 'level.scene.json'), JSON.stringify({
      entities: [
        { texture: 'source-assets/hero.aseprite' },
        { texture: 'source-assets/portrait.psd' }
      ]
    }));

    const report = JSON.parse(execFileSync(process.execPath, [
      'scripts/asset-importer.js',
      '--source',
      source,
      '--out',
      out
    ], { cwd: process.cwd(), encoding: 'utf8' }));
    const graph = JSON.parse(readFileSync(path.join(out, 'asset-graph.json'), 'utf8'));
    const atlas = JSON.parse(readFileSync(path.join(out, 'atlases', 'smart.atlas.json'), 'utf8'));
    const { PlatformVariantResolver } = await importFile('src/assets/PlatformVariantResolver.js');
    const resolver = new PlatformVariantResolver({
      platform: 'wechat',
      variants: {
        web: { basePath: '/assets/web', scale: 1 },
        wechat: { basePath: '/assets/wechat', scale: 0.5 }
      }
    });

    expect(report.conversions).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'hero.aseprite', to: 'spritesheets/hero.json', type: 'spritesheet' }),
      expect.objectContaining({ from: 'hit.wav', type: 'audio' }),
      expect.objectContaining({ from: 'enemy.fbx', to: 'models/enemy.glb', type: 'model' })
    ]));
    expect(report.drawCallReductionTarget).toBe(0.9);
    expect(graph.dependencies.length).toBeGreaterThanOrEqual(5);
    expect(atlas.staticAnalysis.drawCallReductionTarget).toBe(0.9);
    expect(resolver.resolve('hero.png')).toBe('/assets/wechat/hero.png');
    expect(existsSync('config/platform-variants.json')).toBe(true);
  });
});

describe('industrial gates, examples, marketplace, and docs', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('declares benchmark, minigame compliance, and visual regression gates', () => {
    const workflow = readFileSync('.github/workflows/benchmark.yml', 'utf8');
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const visualScript = readFileSync('scripts/visual-regression.js', 'utf8');

    expect(workflow).toContain('1000 Sprite >=45 FPS');
    expect(workflow).toContain('OMNICORE_BENCHMARK_MIN_FPS: 45');
    expect(packageJson.scripts['test:minigame']).toBe('node scripts/test-minigame.js');
    expect(packageJson.scripts['test:visual']).toContain('scripts/visual-regression.js');
    expect(visualScript).toContain('threshold = 0.005');
    expect(existsSync('tests/visual/golden/examples.json')).toBe(true);
  });

  it('generates a minigame compliance and performance report', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-minigame-'));
    execFileSync(process.execPath, [
      'scripts/test-minigame.js',
      '--out',
      temp,
      '--target',
      'wechat'
    ], { cwd: process.cwd(), encoding: 'utf8' });

    const report = JSON.parse(readFileSync(path.join(temp, 'minigame-compliance-report.json'), 'utf8'));
    const html = readFileSync(path.join(temp, 'minigame-performance-report.html'), 'utf8');

    expect(report).toMatchObject({
      target: 'wechat',
      checks: expect.arrayContaining([
        expect.objectContaining({ name: 'package-size', pass: true }),
        expect.objectContaining({ name: 'fps-1000-sprite', pass: true, threshold: 45 })
      ])
    });
    expect(html).toContain('MiniGame Compliance');
  });

  it('ships three runnable examples, plugin marketplace, quickstart, and TypeDoc config', () => {
    const examples = [
      ['template-2d-platformer', 'gravity'],
      ['template-2d-rpg', 'dialogueTree'],
      ['template-25d-showcase', 'Character3D']
    ];
    for (const [name, marker] of examples) {
      const root = path.join('examples', name);
      expect(existsSync(path.join(root, 'package.json'))).toBe(true);
      expect(existsSync(path.join(root, 'src', 'main.js'))).toBe(true);
      expect(readFileSync(path.join(root, 'src', 'main.js'), 'utf8')).toContain(marker);
    }

    const marketplace = readFileSync('website/plugins/index.html', 'utf8');
    for (const plugin of officialPlugins) expect(marketplace).toContain(plugin);

    const quickstart = readFileSync('docs/quickstart.md', 'utf8');
    expect(quickstart).toContain('2 小时');
    expect(quickstart).toContain('三步');
    expect(quickstart).toContain('new OmniCore.Sprite');

    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(packageJson.scripts['docs:typedoc']).toContain('typedoc');
    expect(existsSync('typedoc.json')).toBe(true);
  });
});

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else files.push(full);
  }
  return files;
}

function importFile(file) {
  return import(/* @vite-ignore */ pathToFileURL(path.resolve(file)).href);
}
