import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  loadRapier3DCompatBackend
} from '@omnicore/physics';
import { createEditorApp } from 'omnicore-editor/src/editor-app.js';
import { createEditorState } from 'omnicore-editor/src/live-sync-protocol.js';
import { createScene3DViewportRenderState } from 'omnicore-editor/src/panels/scene-3d-viewport-panel.js';
import {
  inspectGLTFAsset,
  Runtime3DScene
} from '../src/index.js';

describe('3D demo, Rapier compat, GLTF inspection, WebGPU, and editor real-preview hardening', () => {
  it('updates top-level README positioning and capability matrix for the current 3D runtime', () => {
    const readme = readFileSync('README.md', 'utf8');
    const firstSection = readme.slice(0, 1800);

    expect(firstSection).not.toContain('明确不是全 3D 引擎');
    expect(firstSection).toContain('2D 优先');
    expect(firstSection).toContain('生产级 3D 路径');
    expect(firstSection).toContain('| 能力 | 当前状态 | 入口 |');
    expect(firstSection).toContain('Runtime3DScene');
    expect(firstSection).toContain('ThreeRuntimeAdapter');
    expect(firstSection).toContain('RapierPhysicsBackend');
    expect(firstSection).toContain('WebGPUPipelineRuntime');
    expect(firstSection).toContain('scene-3d-viewport real-preview');
  });

  it('ships an official 3D runtime demo with GLB/GLTF assets, Rapier, debug draw, editor data, and WebGPU evidence', () => {
    const root = join(process.cwd(), 'examples/3d-runtime-demo');
    const main = readFileSync(join(root, 'src/main.js'), 'utf8');
    const readme = readFileSync(join(root, 'README.md'), 'utf8');
    const scene = JSON.parse(readFileSync(join(root, 'scene.omnicore.json'), 'utf8'));
    const glbHeader = readFileSync(join(root, 'assets/hero.glb')).subarray(0, 4).toString('utf8');

    expect(existsSync(join(root, 'index.html'))).toBe(true);
    expect(glbHeader).toBe('glTF');
    expect(main).toContain('Runtime3DScene');
    expect(main).toContain('ThreeRuntimeAdapter');
    expect(main).toContain('loadRapier3DCompatBackend');
    expect(main).toContain('inspectGLTFAsset');
    expect(main).toContain('WebGPUPipelineRuntime');
    expect(readme).toContain('3D Runtime Demo');
    expect(scene.editor.openWith).toBe('scene-3d-viewport');
    expect(scene.runtime.models[0]).toMatchObject({
      url: 'assets/hero.glb',
      material: 'hero-pbr'
    });
  });

  it('loads Rapier 3D compat as an optional backend and preserves injectable initialization', async () => {
    const rootPackage = JSON.parse(readFileSync('package.json', 'utf8'));
    const calls = [];
    const backend = await loadRapier3DCompatBackend({
      id: 'rapier-compat-test',
      importRapier: async () => ({
        init: async () => {
          calls.push('init');
          console.warn('using deprecated parameters for the initialization function; pass a single object instead');
        },
        World: class {
          constructor() {
            calls.push('World');
          }
        },
        RigidBodyDesc: {
          dynamic: () => ({ setTranslation() { return this; } }),
          fixed: () => ({ setTranslation() { return this; } }),
          kinematicPositionBased: () => ({ setTranslation() { return this; } })
        },
        ColliderDesc: {
          cuboid: () => ({ setSensor() { return this; } }),
          ball: () => ({ setSensor() { return this; } }),
          capsule: () => ({ setSensor() { return this; } })
        },
        JointData: { fixed: () => ({ type: 'fixed' }) },
        Ray: class {}
      })
    });

    expect(rootPackage.optionalDependencies).toMatchObject({
      '@dimforge/rapier3d-compat': '^0.19.3'
    });
    expect(backend).toMatchObject({
      id: 'rapier-compat-test',
      kind: 'rapier',
      available: true,
      diagnostics: {
        initWarnings: [{
          source: '@dimforge/rapier3d-compat',
          level: 'warning',
          message: 'using deprecated parameters for the initialization function; pass a single object instead'
        }]
      }
    });
    expect(calls).toContain('init');
  });

  it('inspects GLTF assets for materials, textures, animation clips, skins, collider, LOD, compression, and repair actions', () => {
    const report = inspectGLTFAsset({
      path: 'assets/hero.gltf',
      byteLength: 2048,
      document: {
        scenes: [{ nodes: [0] }],
        nodes: [{ mesh: 0, skin: 0 }],
        meshes: [{ primitives: [{ material: 0 }, { material: 1 }] }],
        materials: [{ name: 'hero-pbr', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }, { name: 'broken' }],
        textures: [{ source: 0 }, { source: 9 }],
        images: [{ uri: 'hero-basecolor.png' }],
        animations: [{ name: 'Idle' }, { name: 'Run' }],
        skins: [{ joints: [0] }]
      }
    }, {
      collider: null,
      lods: [],
      compression: {}
    });

    expect(report.schema).toBe('omnicore.gltf-asset-inspector.v1');
    expect(report.summary).toMatchObject({
      materialCount: 2,
      missingTextureCount: 1,
      animationClipCount: 2,
      skinCount: 1,
      colliderReady: false,
      lodReady: false,
      compressionReady: false
    });
    expect(report.animationClips).toEqual(['Idle', 'Run']);
    expect(report.recommendations).toEqual(expect.arrayContaining([
      'generateCollider:box',
      'generateLOD:medium-low',
      'enableCompression:meshopt-or-draco'
    ]));
    expect(report.repairActions.map((action) => action.type)).toEqual(expect.arrayContaining([
      'registerMissingTexture',
      'generateCollider',
      'generateLOD'
    ]));
  });

  it('exposes a Three canvas mount contract in the editor 3D real-preview panel', () => {
    const input = {
      cameras: [{ id: 'main-camera', mode: 'orbit' }],
      lights: [{ id: 'sun', type: 'directional', castShadow: true }],
      materials: [{ id: 'hero-pbr', type: 'PBRMaterial' }],
      models: [{ id: 'hero', url: 'assets/hero.glb', animations: ['Idle'], activeAnimation: 'Idle', collider: { shape: 'box' } }]
    };
    const renderState = createScene3DViewportRenderState(input, {
      runtimeAdapter: 'three',
      renderMode: 'real-preview'
    });

    expect(renderState.canvasMount).toMatchObject({
      renderer: 'three',
      attachTarget: 'scene-3d-viewport-canvas',
      controls: ['orbit', 'select', 'animation-preview'],
      debugOverlays: ['colliders', 'lights', 'shadows']
    });

    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, { state: createEditorState() });
    app.EditorAPI.openScene3DViewport(input, {
      runtimeAdapter: 'three',
      renderMode: 'real-preview'
    });

    expect(root.querySelector('[data-scene-3d-three-canvas]')?.textContent).toContain('Three.js Canvas');
    app.destroy();
  });

  it('defines an E2E contract for the 3D demo editor flow', () => {
    const spec = readFileSync('tests/e2e/3d-runtime-demo.spec.js', 'utf8');
    const scene = new Runtime3DScene({ name: 'demo' });
    scene.addCamera({ id: 'main-camera' });

    expect(spec).toContain('3d-runtime-demo');
    expect(spec).toContain('播放动画');
    expect(spec).toContain('Rapier debug draw');
    expect(spec).toContain('WebGPU fallback');
    expect(spec).toContain('导出项目');
    expect(scene.createRuntimeSnapshot().schema).toBe('omnicore.runtime-3d-scene.v1');
  });
});
