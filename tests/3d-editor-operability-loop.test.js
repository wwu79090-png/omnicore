import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runRapierSimulationDemo } from '@omnicore/physics';
import { createEditorApp } from 'omnicore-editor/src/editor-app.js';
import { createScene3DInteractionRuntime } from 'omnicore-editor/src/panels/scene-3d-interaction-runtime.js';
import { createScene3DViewportRenderState } from 'omnicore-editor/src/panels/scene-3d-viewport-panel.js';
import {
  createGLTFImportWorkflow,
  createWebGPUHardwareValidationReport,
  WebGPUPipelineRuntime
} from '../src/index.js';

describe('3D editor operability loop', () => {
  it('drives orbit, selection, drag, material, animation, and collider overlay from a 3D interaction runtime', () => {
    const runtime = createScene3DInteractionRuntime({
      cameras: [{ id: 'main-camera', mode: 'orbit' }],
      materials: [{ id: 'hero-pbr', baseColor: '#338cff', roughness: 0.42 }],
      models: [{ id: 'hero', position: { x: 0, y: 0, z: 0 }, animations: ['Idle', 'Run'], activeAnimation: 'Idle', collider: { shape: 'box' } }]
    });

    const orbit = runtime.orbitCamera({ yaw: 15, pitch: -5, distance: -0.5 });
    const selected = runtime.selectModel('hero');
    const dragged = runtime.dragSelected({ x: 1, y: 0.25, z: -0.5 });
    const material = runtime.editMaterial('hero-pbr', { baseColor: '#ffcc33', roughness: 0.2 });
    const animation = runtime.switchAnimation('hero', 'Run');
    const overlay = runtime.toggleColliderOverlay(false);
    const snapshot = runtime.createSnapshot();

    expect(orbit.patch.camera.orbit).toMatchObject({ yaw: 15, pitch: -5, distance: 3.5 });
    expect(selected.patch.selectedModelId).toBe('hero');
    expect(dragged.patch.models[0].position).toMatchObject({ x: 1, y: 0.25, z: -0.5 });
    expect(material.patch.materials[0]).toMatchObject({ id: 'hero-pbr', baseColor: '#ffcc33', roughness: 0.2 });
    expect(animation.patch.models[0]).toMatchObject({ id: 'hero', activeAnimation: 'Run' });
    expect(overlay.patch.overlays.colliders).toBe(false);
    expect(snapshot.trace.map((entry) => entry.type)).toEqual([
      'orbit-camera',
      'select-model',
      'drag-model',
      'edit-material',
      'switch-animation',
      'toggle-collider-overlay'
    ]);

    const renderState = createScene3DViewportRenderState({
      cameras: [{ id: 'main-camera', mode: 'orbit' }],
      materials: [{ id: 'hero-pbr' }],
      models: [{ id: 'hero', animations: ['Idle', 'Run'], activeAnimation: 'Run', collider: { shape: 'box' } }]
    }, { runtimeAdapter: 'three', renderMode: 'real-preview' });
    expect(renderState.interaction.tools.map((tool) => tool.id)).toEqual(expect.arrayContaining([
      'orbit-camera',
      'select-model',
      'drag-model',
      'edit-material',
      'switch-animation',
      'toggle-collider-overlay'
    ]));
  });

  it('runs a real Rapier-style simulation demo with falling body, floor, sensor, joint, raycast, and debug draw', () => {
    const fakeRapier = createFakeRapierModule();
    const report = runRapierSimulationDemo({
      RAPIER: fakeRapier,
      steps: 4,
      gravity: { x: 0, y: -9.81, z: 0 }
    });

    expect(report.schema).toBe('omnicore.rapier-simulation-demo.v1');
    expect(report.summary).toMatchObject({
      bodyCount: 3,
      dynamicBodyCount: 1,
      sensorCount: 1,
      jointCount: 1,
      raycastHit: true
    });
    expect(report.bodies.find((body) => body.id === 'hero-body').translation.y).toBeLessThan(3);
    expect(report.raycast).toMatchObject({ bodyId: 'hero-body' });
    expect(report.debugDraw.buffers.vertices.length).toBeGreaterThan(0);
  });

  it('creates a GLTF/GLB import workflow with drop UI, inspection, repairs, collider generation, and scene insertion patch', () => {
    const workflow = createGLTFImportWorkflow({
      file: { name: 'hero.glb', path: 'assets/hero.glb', byteLength: 4096 },
      document: {
        meshes: [{ primitives: [{ material: 0 }] }],
        materials: [{ name: 'hero-pbr', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
        textures: [{ source: 3 }],
        images: [],
        animations: [{ name: 'Idle' }],
        skins: []
      }
    }, {
      targetSceneId: 'scene-3d-demo',
      material: 'hero-pbr'
    });

    expect(workflow.schema).toBe('omnicore.gltf-import-workflow.v1');
    expect(workflow.dropzone.accept).toEqual(['.glb', '.gltf']);
    expect(workflow.inspection.summary).toMatchObject({ missingTextureCount: 1, animationClipCount: 1 });
    expect(workflow.repairPlan.actions.map((action) => action.type)).toEqual(expect.arrayContaining([
      'registerMissingTexture',
      'generateCollider',
      'generateLOD'
    ]));
    expect(workflow.sceneInsertion.patch.runtime.models[0]).toMatchObject({
      id: 'hero',
      url: 'assets/hero.glb',
      material: 'hero-pbr',
      activeAnimation: 'Idle'
    });
  });

  it('reports WebGPU hardware validation across success, fallback, device-lost recovery, browsers, and pipeline lifecycle', () => {
    const pipeline = new WebGPUPipelineRuntime({ label: 'hardware-validation-test' });
    pipeline.createTexture({ id: 'hero-texture', width: 64, height: 64 });
    pipeline.queueTextureUpload('hero-texture', { bytes: 64 * 64 * 4, source: 'hero.glb' });
    pipeline.flushTextureUploads();
    pipeline.createBuffer({ id: 'hero-buffer', size: 256, usage: 'vertex' });
    pipeline.createBindGroup({ id: 'hero-bind', resources: ['hero-texture', 'hero-buffer'] });
    pipeline.createPipeline({ id: 'hero-pipeline', vertex: 'vs_main', fragment: 'fs_main' });
    pipeline.encodeDraw({ pipeline: 'hero-pipeline', bindGroup: 'hero-bind', vertexCount: 3 });
    pipeline.loseDevice('browser-test');
    pipeline.recoverDevice({ strategy: 'recreate-device-and-reupload' });

    const report = createWebGPUHardwareValidationReport({
      browsers: [
        { name: 'Chromium', webgpu: 'passed', adapter: 'discrete-gpu', fallback: null },
        { name: 'Firefox', webgpu: 'fallback', fallback: 'webgl2', reason: 'adapter-unavailable' },
        { name: 'WebKit', webgpu: 'fallback', fallback: 'webgl2', reason: 'feature-disabled' }
      ],
      pipelineSnapshot: pipeline.createSnapshot()
    });

    expect(report.schema).toBe('omnicore.webgpu-hardware-validation.v1');
    expect(report.summary).toMatchObject({
      browserCount: 3,
      webgpuPassedCount: 1,
      fallbackCount: 2,
      deviceLostRecovered: true
    });
    expect(report.fallbacks.map((fallback) => fallback.backend)).toEqual(['webgl2', 'webgl2']);
    expect(report.resourceLifecycle.summary.uploadedTextureCount).toBe(1);
  });

  it('wires official 3D demo and GLTF import workflow into the desktop launcher windows', async () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, { state: { scene: { entities: [] } } });

    root.querySelector('[data-desktop-command="scene-3d-demo"]').click();
    await Promise.resolve();
    const demoWindow = root.querySelector('[data-desktop-command-window="scene-3d-demo"]');
    expect(demoWindow?.textContent).toContain('examples/3d-runtime-demo');
    expect(demoWindow?.textContent).toContain('打开官方 3D Demo');
    expect(demoWindow?.textContent).toContain('运行 Demo');
    expect(demoWindow?.textContent).toContain('编辑场景');
    expect(demoWindow?.textContent).toContain('导出项目');
    demoWindow?.querySelector('[data-desktop-command-window-action="execute"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(app.getState().scene3DViewport?.interaction?.tools?.map((tool) => tool.id)).toContain('drag-model');

    root.querySelector('[data-desktop-command="gltf-import"]').click();
    await Promise.resolve();
    const importWindow = root.querySelector('[data-desktop-command-window="gltf-import"]');
    expect(importWindow?.textContent).toContain('拖入 GLB/GLTF');
    expect(importWindow?.textContent).toContain('一键导入到场景');

    app.destroy();
  });

  it('extends the 3D runtime browser E2E contract for import, real Rapier, interaction, hardware validation, and EXE entry evidence', () => {
    const spec = readFileSync('tests/e2e/3d-runtime-demo.spec.js', 'utf8');
    const demo = readFileSync('examples/3d-runtime-demo/src/main.js', 'utf8');

    expect(spec).toContain('GLTF 导入');
    expect(spec).toContain('真实 Rapier');
    expect(spec).toContain('旋转视角');
    expect(spec).toContain('WebGPU hardware validation');
    expect(spec).toContain('EXE 启动器');
    expect(demo).toContain('runRapierSimulationDemo');
    expect(demo).toContain('createGLTFImportWorkflow');
    expect(demo).toContain('createWebGPUHardwareValidationReport');
  });
});

function createFakeRapierModule() {
  class RigidBody {
    constructor(desc = {}) {
      this.desc = desc;
      this.id = desc.id;
      this.type = desc.type || 'dynamic';
      this.position = { ...(desc.translation || { x: 0, y: 0, z: 0 }) };
    }

    translation() {
      return { ...this.position };
    }
  }

  class Collider {
    constructor(desc = {}, body = null) {
      this.desc = desc;
      this.body = body;
      this.shape = desc.shape || 'box';
      this.sensor = Boolean(desc.sensor);
    }

    parent() {
      return this.body;
    }
  }

  class World {
    constructor(gravity = {}) {
      this.gravity = gravity;
      this.bodies = [];
      this.colliders = [];
      this.joints = [];
    }

    createRigidBody(desc) {
      const body = new RigidBody(desc);
      this.bodies.push(body);
      return body;
    }

    createCollider(desc, body) {
      const collider = new Collider(desc, body);
      this.colliders.push(collider);
      return collider;
    }

    createImpulseJoint(desc, bodyA, bodyB) {
      const joint = { desc, bodyA, bodyB };
      this.joints.push(joint);
      return joint;
    }

    step() {
      for (const body of this.bodies) {
        if (body.type !== 'dynamic') continue;
        body.position.y += Number(this.gravity.y || 0) / 60;
        if (body.position.y < 0.5) body.position.y = 0.5;
      }
    }

    castRay() {
      const body = this.bodies.find((candidate) => candidate.id === 'hero-body');
      const collider = this.colliders.find((candidate) => candidate.body === body);
      return { toi: 1.25, collider };
    }

    debugRender() {
      return {
        vertices: [0, 0, 0, 1, 1, 1],
        colors: [1, 0, 0, 1, 0, 1, 0, 1]
      };
    }
  }

  return {
    World,
    Ray: class {
      constructor(origin, direction) {
        this.origin = origin;
        this.direction = direction;
      }
    },
    RigidBodyDesc: {
      dynamic: () => createDesc({ type: 'dynamic' }),
      fixed: () => createDesc({ type: 'static' }),
      kinematicPositionBased: () => createDesc({ type: 'kinematic' })
    },
    ColliderDesc: {
      cuboid: (x, y, z) => createDesc({ shape: 'box', width: x * 2, height: y * 2, depth: z * 2 }),
      ball: (radius) => createDesc({ shape: 'sphere', radius }),
      capsule: (height, radius) => createDesc({ shape: 'capsule', height, radius })
    },
    JointData: {
      fixed: () => ({ type: 'fixed' })
    }
  };
}

function createDesc(seed = {}) {
  return {
    ...seed,
    setTranslation(x, y, z) {
      this.translation = { x, y, z };
      return this;
    },
    setSensor(sensor) {
      this.sensor = sensor;
      return this;
    }
  };
}
