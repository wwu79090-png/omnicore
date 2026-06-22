import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { createEditorApp } from 'omnicore-editor/src/editor-app.js';
import { createEditorState } from 'omnicore-editor/src/live-sync-protocol.js';
import OmniCore, {
  Camera,
  Scene,
  SpineAdapter,
  StaticBatchCompiler,
  createHD2DFilter,
  createNormalLightShader,
  createSpineFFDVertexShader
} from '../src/index.js';
import Dimension3D from '../src/dimension3d/Dimension3D.js';

describe('industrial 2.5D pipeline', () => {
  it('creates HD-2D, normal-light, and Spine FFD shader descriptors without runtime dependencies', () => {
    const hd2d = createHD2DFilter({ cornerBlur: 0.35, toneSeparation: 4, chromaticAberration: 0.018 });
    const normalLight = createNormalLightShader({
      normalMap: 'hero-normal.png',
      light: { x: 0.25, y: -0.5, z: 0.85 },
      specularStrength: 0.7
    });
    const ffdShader = createSpineFFDVertexShader({ strength: 0.42, phase: 0.2 });
    const spine = new SpineAdapter().create({
      url: 'hero.skel',
      atlas: 'hero.atlas',
      customVertexShader: ffdShader,
      ffd: { enabled: true, mesh: 'hero-face', strength: 0.42 }
    });

    expect(hd2d).toMatchObject({
      type: 'omnicore-hd2d-filter',
      uniforms: {
        uCornerBlur: 0.35,
        uToneSeparation: 4,
        uChromaticAberration: 0.018
      }
    });
    expect(hd2d.fragment).toContain('toneSteps');
    expect(normalLight).toMatchObject({
      type: 'omnicore-25d-normal-light-shader',
      normalMap: 'hero-normal.png',
      uniforms: { uSpecularStrength: 0.7 }
    });
    expect(normalLight.fragment).toContain('normalSample');
    expect(ffdShader.vertex).toContain('uFFDStrength');
    expect(spine.toJSON()).toMatchObject({
      format: 'spine',
      customVertexShader: { type: 'omnicore-spine-ffd-vertex-shader' },
      ffd: { enabled: true, mesh: 'hero-face', strength: 0.42 }
    });
  });

  it('coordinates parallax camera presets, scene Y-sort, fake shadows, and 2D/3D viewport sync', () => {
    const camera = new Camera({ x: 100, y: 50 });
    camera.configureParallax25D({
      background: 0.5,
      actors: 1,
      ui: 0
    });

    expect(camera.getLayerTransform('background')).toMatchObject({ x: -50, y: -25, factorX: 0.5 });
    expect(camera.getLayerTransform('ui')).toMatchObject({ x: 0, y: 0, factorX: 0 });

    const scene = new Scene('iso-town');
    const canopy = scene.add({ id: 'canopy', type: 'model-proxy', y: 120, zIndex: 0, shadow: { radiusX: 30, radiusY: 12 } });
    const hero = scene.add({ id: 'hero', type: 'sprite', y: 160, height: 48, zIndex: 0 });
    scene.apply25DSort({ shadowCorrection: true });

    expect(scene.children.map((child) => child.id)).toEqual(['canopy', 'hero']);
    expect(canopy.zIndex).toBeLessThan(hero.zIndex);
    expect(canopy.omnicoreFakeShadow).toMatchObject({ y: 120, opacity: expect.any(Number) });

    const dimension = new Dimension3D({ debug: true });
    const sync = dimension.syncViewport2D({
      camera,
      viewport: { width: 960, height: 540 },
      layers: camera.getParallaxTransforms()
    });

    expect(sync).toMatchObject({
      protocol: 'omnicore-25d-viewport-sync/v1',
      viewport: { width: 960, height: 540 },
      camera: { x: 100, y: 50, zoom: 1 }
    });
    expect(sync.layers.find((layer) => layer.id === 'background')).toMatchObject({ factorX: 0.5 });
  });

  it('exposes editor 2.5D preview, mixed node dragging, and one-click fake shadow generation', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        scene: {
          name: 'market-demo',
          entities: [
            { id: 'hero-spine', type: 'spine', x: 80, y: 180, height: 64 },
            { id: 'city-tower', type: 'dimension3d-model', x: 140, y: 120, z: 8, bounds: { width: 80, height: 160, depth: 40 } }
          ]
        }
      })
    });

    const preview = app.create25DPreview({ zToYScale: 16, showReferenceLines: true });
    const drag = app.drag25DNode('city-tower', { x: 200, y: 150, z: 10 });
    const shadows = app.generateFakeShadows({ opacity: 0.32 });

    expect(preview).toMatchObject({
      protocol: 'omnicore-editor-25d-preview/v1',
      guides: { yToZReferenceLines: expect.arrayContaining([expect.objectContaining({ axis: 'z' })]) }
    });
    expect(preview.mixedNodes.map((node) => node.kind)).toEqual(['spine', 'dimension3d']);
    expect(drag).toMatchObject({ id: 'city-tower', position: { x: 200, y: 150, z: 10 } });
    expect(shadows).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityId: 'hero-spine', type: 'ellipse', opacity: 0.32 }),
      expect.objectContaining({ entityId: 'city-tower', type: 'ellipse', opacity: 0.32 })
    ]));
    app.destroy();
  });

  it('plans static 3D instancing, Spine draw-call grouping, and distance LOD degradation', () => {
    const modelBatches = StaticBatchCompiler.compileStaticModelInstances([
      { id: 'tower-a', url: 'city.glb', static: true, material: 'lit-city', transform: { x: 0, y: 0, z: 0 } },
      { id: 'tower-b', url: 'city.glb', static: true, material: 'lit-city', transform: { x: 20, y: 0, z: 0 } },
      { id: 'car', url: 'car.glb', static: false, material: 'lit-city' }
    ]);
    const spineGroups = StaticBatchCompiler.compileSpineDrawCallGroups([
      { id: 'hero', atlas: 'hero.atlas', material: 'normal-lit', state: 'walk' },
      { id: 'npc', atlas: 'hero.atlas', material: 'normal-lit', state: 'walk' },
      { id: 'boss', atlas: 'boss.atlas', material: 'normal-lit', state: 'idle' }
    ]);
    const lod = StaticBatchCompiler.plan25DLOD([
      { id: 'hero', distance: 12, ffd: true, textureScale: 1 },
      { id: 'crowd', distance: 96, ffd: true, textureScale: 1 }
    ], { ffdDisableDistance: 64, lowTextureDistance: 80 });

    expect(modelBatches).toMatchObject({
      drawCallsBefore: 2,
      drawCallsAfter: 1,
      batches: [expect.objectContaining({ mesh: 'city.glb', instanceCount: 2 })]
    });
    expect(spineGroups.groups[0]).toMatchObject({
      atlas: 'hero.atlas',
      material: 'normal-lit',
      state: 'walk',
      skeletonCount: 2,
      drawCallsAfter: 1
    });
    expect(lod.items.find((item) => item.id === 'crowd')).toMatchObject({
      ffdEnabled: false,
      texturePrecision: 'half'
    });
  });

  it('detects .spine, .blend, and transparent PNG assets in the import pipeline', async () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'omnicore-25d-import-'));
    const source = path.join(temp, 'source-assets');
    const out = path.join(temp, 'out');
    await mkdir(source, { recursive: true });
    writeFileSync(path.join(source, 'hero.spine'), '{"skeleton":{"hash":"demo"}}');
    writeFileSync(path.join(source, 'city.blend'), 'BLENDER');
    writeFileSync(path.join(source, 'grass.png'), 'PNG transparent edge placeholder');

    const output = execFileSync(process.execPath, [
      path.resolve('scripts/asset-importer.js'),
      '--source',
      source,
      '--out',
      out
    ], { cwd: process.cwd(), encoding: 'utf8' });
    const report = JSON.parse(output);
    const manifest = JSON.parse(await readFile(path.join(out, 'assets.manifest.json'), 'utf8'));

    expect(report.conversions).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'hero.spine', to: 'spine/hero.skel', type: 'spine', converter: 'spine-cli' }),
      expect.objectContaining({ from: 'city.blend', to: 'models/city.glb', type: 'blend-model', converter: 'blender' }),
      expect.objectContaining({ from: 'grass.png', type: 'image', edgePadding: 2, atlasPacked: true })
    ]));
    expect(manifest.spine[0]).toMatchObject({ name: 'hero', skeleton: 'spine/hero.skel', atlas: 'spine/hero.atlas' });
    expect(manifest.models[0]).toMatchObject({ name: 'city', format: 'glb', sourceFormat: 'blend' });
    expect(existsSync(path.join(out, 'textures/grass.webp'))).toBe(true);
  });

  it('ships a directly runnable 2.5D technical demo for market showcase', () => {
    const packageJson = JSON.parse(readFileSync('examples/2.5d-demo/package.json', 'utf8'));
    const html = readFileSync('examples/2.5d-demo/index.html', 'utf8');
    const main = readFileSync('examples/2.5d-demo/src/main.js', 'utf8');
    const readme = readFileSync('examples/2.5d-demo/README.md', 'utf8');

    expect(packageJson.scripts.dev).toBe('vite --host 0.0.0.0');
    expect(html).toContain('OmniCore Industrial 2.5D Demo');
    expect(main).toContain('createHD2DFilter');
    expect(main).toContain('createSpineFFDVertexShader');
    expect(main).toContain('compileStaticModelInstances');
    expect(main).toContain('create25DPreview');
    expect(readme).toContain('Spine FFD');
    expect(readme).toContain('3D city decor');
    expect(OmniCore.createHD2DFilter).toBe(createHD2DFilter);
  });
});
