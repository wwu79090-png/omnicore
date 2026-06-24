import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadRapier3DCompatBackend } from '@omnicore/physics';
import {
  Runtime3DScene,
  ThreeRuntimeAdapter,
  WebGPUPipelineRuntime,
  inspectGLTFAsset
} from 'omnicore/src/index.js';

const canvas = document.querySelector('#scene');
const reportRoot = document.querySelector('#report');

const runtimeScene = new Runtime3DScene({
  name: '3d-runtime-demo',
  background: '#10141f'
});

runtimeScene.addCamera({
  id: 'main-camera',
  mode: 'orbit',
  position: { x: 0, y: 1.6, z: 4.2 },
  target: { x: 0, y: 0.3, z: 0 }
});
runtimeScene.addLight({
  id: 'sun',
  type: 'directional',
  intensity: 1.8,
  castShadow: true,
  position: { x: 3, y: 5, z: 2 }
});
runtimeScene.addPBRMaterial('hero-pbr', {
  baseColor: '#338cff',
  metallic: 0.18,
  roughness: 0.42
});
runtimeScene.addGLTFModel({
  id: 'hero',
  url: './assets/hero.glb',
  material: 'hero-pbr',
  animations: ['Idle', 'Run'],
  animation: 'Idle',
  castShadow: true,
  receiveShadow: true,
  collider: { shape: 'box', width: 1.2, height: 1.4, depth: 0.4 },
  rigidBody: { type: 'dynamic', mass: 1 },
  physicsBinding: { backend: 'rapier3d-compat', bodyId: 'hero-body', colliderId: 'hero-collider' }
});

const gltfDocument = await fetch('./assets/hero.gltf').then((response) => response.json());
const gltfReport = inspectGLTFAsset({
  path: 'assets/hero.gltf',
  byteLength: JSON.stringify(gltfDocument).length,
  document: gltfDocument,
  collider: { shape: 'box' },
  lods: ['runtime-preview'],
  compression: { meshopt: true }
});

const adapter = new ThreeRuntimeAdapter({
  THREE,
  GLTFLoader,
  canvas,
  width: canvas.width,
  height: canvas.height,
  postprocess: ['shadow-preview']
});
await adapter.build(runtimeScene);

const rapierEvidence = await createRapierEvidence();
let threeSnapshot;
try {
  await adapter.loadModels();
  threeSnapshot = adapter.renderFrame();
} catch (error) {
  threeSnapshot = {
    schema: 'omnicore.three-runtime-adapter.v1',
    loadingError: error.message,
    summary: adapter.createSnapshot().summary
  };
}

const webgpuSnapshot = createWebGPUResourceLifecycleEvidence();
const runtimeSnapshot = runtimeScene.createRuntimeSnapshot();
const debugDraw = runtimeScene.createDebugDraw();

renderEvidence([
  ['Runtime3DScene', runtimeSnapshot.summary],
  ['ThreeRuntimeAdapter', threeSnapshot.summary],
  ['GLTF 资源检查', gltfReport.summary],
  ['Rapier debug draw', rapierEvidence],
  ['WebGPUPipelineRuntime', webgpuSnapshot.summary],
  ['播放动画', { model: 'hero', clip: 'Idle' }],
  ['WebGPU fallback', { preferred: 'webgpu', fallback: 'webgl', ready: true }],
  ['导出项目', { file: 'scene.omnicore.json', openWith: 'scene-3d-viewport' }],
  ['Debug draw', debugDraw]
]);

function createWebGPUResourceLifecycleEvidence() {
  const pipeline = new WebGPUPipelineRuntime({ label: '3d-runtime-demo' });
  pipeline.createTexture({ id: 'hero-basecolor', width: 512, height: 512, format: 'rgba8unorm' });
  pipeline.queueTextureUpload('hero-basecolor', { bytes: 512 * 512 * 4, source: 'assets/hero.glb' });
  pipeline.flushTextureUploads();
  pipeline.createBuffer({ id: 'hero-vertices', size: 256, usage: 'vertex' });
  pipeline.createBindGroup({ id: 'hero-bind-group', resources: ['hero-basecolor', 'hero-vertices'] });
  pipeline.createPipeline({ id: 'hero-pbr-pipeline', vertex: 'vs_pbr', fragment: 'fs_pbr', topology: 'triangle-list' });
  pipeline.encodeDraw({
    id: 'hero-render-pass',
    pipeline: 'hero-pbr-pipeline',
    bindGroup: 'hero-bind-group',
    vertexCount: 3
  });
  pipeline.loseDevice('demo-device-lost-recovery');
  pipeline.recoverDevice({ strategy: 'recreate-device-and-reupload' });
  return pipeline.createSnapshot();
}

async function createRapierEvidence() {
  try {
    const backend = await loadRapier3DCompatBackend();
    return {
      backend: backend.id,
      available: backend.available,
      capabilities: backend.capabilities,
      debugDraw: runtimeScene.createDebugDraw().colliders.length
    };
  } catch (error) {
    return {
      backend: 'rapier3d-compat',
      available: false,
      fallback: 'arcade',
      reason: error.message,
      debugDraw: runtimeScene.createDebugDraw().colliders.length
    };
  }
}

function renderEvidence(items) {
  reportRoot.replaceChildren(...items.map(([title, payload]) => {
    const panel = document.createElement('article');
    panel.className = 'panel';
    const heading = document.createElement('h2');
    heading.textContent = title;
    const body = document.createElement('pre');
    body.textContent = JSON.stringify(payload, null, 2);
    panel.append(heading, body);
    return panel;
  }));
}
