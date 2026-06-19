import { execFileSync, spawnSync } from 'node:child_process';
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
import { afterEach, describe, expect, it } from 'vitest';
import {
  Entity,
  Light2D,
  Node,
  StaticBatchCompiler,
  VisualEventGraph,
  WebGPURenderer
} from '../src/index.js';
import { bakeTilemapCollisionFiles } from '../scripts/bake-tilemap-collisions.js';

const tempRoots = [];

function makeTempRoot(prefix) {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function writeJson(file, payload) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

describe('OmniCore full stack phase 1 contracts', () => {
  afterEach(() => {
    while (tempRoots.length) rmSync(tempRoots.pop(), { recursive: true, force: true });
  });

  it('emits typed static batches and preserves them ahead of dynamic WebGPU commands', () => {
    const manifest = StaticBatchCompiler.compileScene({
      name: 'batch-room',
      children: [
        { id: 'tile-a', type: 'sprite', static: true, texture: 'tiles.png', x: 0, y: 0, width: 16, height: 16 },
        { id: 'tile-b', type: 'sprite', static: true, texture: 'tiles.png', x: 16, y: 0, width: 16, height: 16 }
      ]
    }, {
      now: () => '2026-06-19T00:00:00.000Z'
    });
    const [batch] = manifest.batches;

    expect(batch.vertexBuffer).toMatchObject({
      format: 'float32',
      strideFloats: 8,
      vertexCount: 8,
      spriteCount: 2
    });
    expect(batch.vertexBuffer.data).toBeInstanceOf(Float32Array);
    expect(Array.from(batch.vertexBuffer.data.slice(0, 8))).toEqual([
      0, 0, 0, 0, 1, 1, 1, 1
    ]);

    const renderer = new WebGPURenderer();
    renderer.renderScene({
      staticBatches: manifest.batches,
      children: [
        { id: 'hero', type: 'sprite', x: 4, y: 8, width: 16, height: 16, texture: 'hero.png' }
      ]
    });

    expect(renderer.lastInstructions[0]).toMatchObject({
      op: 'static-batch',
      texture: 'tiles.png',
      spriteCount: 2,
      vertexCount: 8
    });
    expect(renderer.lastInstructions.at(-1)).toMatchObject({ op: 'rect', x: 4, y: 8 });
  });

  it('serializes Light2D color-temperature previews for editor hot editing', () => {
    const torch = Light2D.point({
      x: 96,
      y: 64,
      radius: 192,
      intensity: 0.75,
      colorTemperature: 3200
    });
    const directional = Light2D.directional({ angle: Math.PI / 3, colorTemperature: 6500 });

    expect(torch.preview()).toMatchObject({
      type: 'point',
      colorTemperature: 3200,
      resolvedColor: '#ffb87b',
      intensity: 0.75
    });
    expect(torch.toDrawCommand()).toMatchObject({
      op: 'light2d',
      resolvedColor: '#ffb87b',
      colorTemperature: 3200
    });
    expect(directional.preview()).toMatchObject({
      type: 'directional',
      resolvedColor: '#fffefa'
    });
  });

  it('connects Node and plain Entity signals to handlers or target signals', () => {
    const source = new Node({ name: 'source' });
    const target = new Node({ name: 'target' });
    const forwarded = [];
    target.on('accepted', (payload) => forwarded.push(payload));

    const disconnectForward = source.connect('ready', target, 'accepted');
    source.emit('ready', { frame: 1 });
    disconnectForward();
    source.emit('ready', { frame: 2 });

    const plain = Entity.create({ id: 'plain-actor', type: 'Actor' });
    const receiver = {
      hits: [],
      accept(payload) {
        this.hits.push(payload);
      }
    };
    plain.connect('hit', receiver, 'accept');
    plain.emit('hit', { damage: 3 });

    expect(forwarded).toEqual([{ frame: 1 }]);
    expect(receiver.hits).toEqual([{ damage: 3 }]);
  });

  it('exports visual flow graphs as EventSheet JSON for editor file saves', () => {
    const graph = new VisualEventGraph({ debug: false });
    graph.addNode({ id: 'start', type: 'event', label: 'Scene Start', data: { when: { op: 'scene:start' } } });
    graph.addNode({ id: 'has-key', type: 'condition', data: { op: 'equals', left: 'inventory.key', right: true } });
    graph.addNode({ id: 'open-door', type: 'execution', data: { op: 'set', target: 'door.open', value: true } });
    graph.connect('start', 'has-key').connect('has-key', 'open-door');

    const exported = JSON.parse(graph.exportEventSheetJSON({ pretty: true }));

    expect(exported).toMatchObject({
      format: 'OmniCore.EventSheet',
      version: 1,
      events: [
        {
          name: 'Scene Start',
          when: { op: 'scene:start' },
          conditions: [{ op: 'equals', left: 'inventory.key', right: true }],
          actions: [{ op: 'set', target: 'door.open', value: true }]
        }
      ]
    });
  });

  it('bakes Tilemap collision files and matching navmesh JSON assets', () => {
    const root = makeTempRoot('omnicore-navmesh-');
    const source = path.join(root, 'assets', 'maps');
    const outDir = path.join(root, 'dist', 'tilemap-collisions');
    writeJson(path.join(source, 'level.json'), {
      width: 3,
      height: 2,
      tilewidth: 16,
      tileheight: 16,
      layers: [
        {
          id: 1,
          name: 'Collision',
          type: 'tilelayer',
          width: 3,
          height: 2,
          data: [
            0, 1, 0,
            0, 0, 0
          ]
        }
      ]
    });

    const report = bakeTilemapCollisionFiles({ source, outDir, collisionTileIds: [1] });
    const navmesh = JSON.parse(readFileSync(path.join(outDir, 'level.navmesh.json'), 'utf8'));

    expect(report).toMatchObject({ baked: 1, navmeshes: 1 });
    expect(existsSync(path.join(outDir, 'level.collision.bin'))).toBe(true);
    expect(navmesh).toMatchObject({
      format: 'OmniCore.NavMesh',
      version: 1,
      width: 3,
      height: 2,
      tileWidth: 16,
      tileHeight: 16,
      grid: [
        [0, 1, 0],
        [0, 0, 0]
      ]
    });
  });

  it('supports --platform asset builds with rewritten paths and unused resource reports', () => {
    const root = makeTempRoot('omnicore-platform-phase1-');
    const assets = path.join(root, 'assets');
    const out = path.join(root, 'out');
    mkdirSync(assets, { recursive: true });
    writeFileSync(path.join(assets, 'hero.png'), 'hero-bytes');
    writeFileSync(path.join(assets, 'unused.png'), 'unused-bytes');
    writeJson(path.join(assets, 'assets.manifest.json'), {
      images: [{ type: 'image', name: 'hero', path: 'hero.png', url: 'hero.png' }]
    });

    execFileSync(process.execPath, [
      path.resolve('scripts/build-platform-assets.js'),
      '--platform',
      'wechat',
      '--assets',
      assets,
      '--manifest',
      path.join(assets, 'assets.manifest.json'),
      '--out',
      out
    ], { cwd: process.cwd(), encoding: 'utf8' });

    const manifest = JSON.parse(readFileSync(path.join(out, 'assets.manifest.json'), 'utf8'));
    const report = JSON.parse(readFileSync(path.join(out, 'asset-package-report.json'), 'utf8'));
    const unused = readFileSync(path.join(out, 'unused-resources.txt'), 'utf8');

    expect(existsSync(path.join(out, 'wechat', 'hero.png'))).toBe(true);
    expect(manifest.images[0]).toMatchObject({
      url: 'wechat/hero.png',
      originalUrl: 'hero.png'
    });
    expect(report.assets[0].output).toContain('out/wechat/hero.png');
    expect(unused).toContain('unused.png');
  });

  it('blocks dependency lifecycle installers that reference explicitly denied hosts', () => {
    const root = makeTempRoot('omnicore-denied-host-');
    writeJson(path.join(root, 'package.json'), { name: 'denied-host-fixture', version: '1.0.0' });
    writeJson(path.join(root, 'package-lock.json'), {
      name: 'denied-host-fixture',
      lockfileVersion: 3,
      packages: {
        '': { name: 'denied-host-fixture', version: '1.0.0' },
        'node_modules/suspicious-pkg': { version: '1.0.0' }
      }
    });
    writeJson(path.join(root, 'config', 'dependency-forensics.json'), {
      deniedHosts: ['github.com']
    });
    writeJson(path.join(root, 'node_modules', 'suspicious-pkg', 'package.json'), {
      name: 'suspicious-pkg',
      version: '1.0.0',
      scripts: {
        postinstall: 'node postinstall.js'
      }
    });
    writeFileSync(
      path.join(root, 'node_modules', 'suspicious-pkg', 'postinstall.js'),
      "fetch('https://github.com/example/suspicious/releases/latest')\n",
      'utf8'
    );

    const result = spawnSync(process.execPath, [
      path.resolve('scripts/dependency-forensics.js'),
      '--root',
      root
    ], { cwd: process.cwd(), encoding: 'utf8' });
    const report = readFileSync(path.join(root, 'docs', 'security', 'dependency-forensics-latest.md'), 'utf8');

    expect(result.status).toBe(1);
    expect(report).toContain('denied-lifecycle-host');
    expect(report).toContain('github.com');
  });
});
