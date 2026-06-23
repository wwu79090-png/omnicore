import { describe, expect, it } from 'vitest';
import {
  createExternalPhysicsBackend,
  createPhysicsWorld
} from '@omnicore/physics';
import { createEditorAuthoringModules } from 'omnicore-editor/src/editor-authoring-modules.js';
import {
  Runtime3DScene,
  WebGPUPipelineRuntime
} from '../src/index.js';

describe('runtime hardening contracts for 3D, WebGPU, physics, and editor modules', () => {
  it('creates a runnable 3D scene snapshot with camera controls, lights, PBR, GLTF animation, colliders, and physics binding', () => {
    const scene = new Runtime3DScene({ name: 'arena' });
    scene.addCamera({ id: 'main-camera', mode: 'free', controls: ['orbit', 'wasd'] });
    scene.addLight({ id: 'sun', type: 'directional', castShadow: true });
    scene.addPBRMaterial('hero-mat', { baseColor: '#88ccff', metallic: 0.2, roughness: 0.45 });
    scene.addGLTFModel({
      id: 'hero',
      url: 'assets/hero.glb',
      material: 'hero-mat',
      animations: ['Idle', 'Run'],
      collider: { shape: 'capsule', radius: 0.35, height: 1.8 },
      rigidBody: { type: 'dynamic', mass: 1 }
    });
    scene.playAnimation('hero', 'Run');
    scene.bindPhysicsBody('hero', { backend: 'rapier', bodyId: 'rb-hero' });

    const snapshot = scene.createRuntimeSnapshot();

    expect(snapshot.schema).toBe('omnicore.runtime-3d-scene.v1');
    expect(snapshot.summary).toMatchObject({
      cameraCount: 1,
      lightCount: 1,
      pbrMaterialCount: 1,
      gltfModelCount: 1,
      animatedModelCount: 1,
      colliderCount: 1,
      physicsBindingCount: 1,
      shadowCasterCount: 1
    });
    expect(snapshot.cameras[0]).toMatchObject({
      id: 'main-camera',
      controls: ['orbit', 'wasd']
    });
    expect(snapshot.models[0]).toMatchObject({
      id: 'hero',
      activeAnimation: 'Run',
      physicsBinding: { backend: 'rapier', bodyId: 'rb-hero' }
    });
    expect(snapshot.debugDraw.colliders[0]).toMatchObject({ modelId: 'hero', shape: 'capsule' });
  });

  it('tracks WebGPU uploads, buffers, bind groups, pipeline cache, command encoding, and device recovery', () => {
    const runtime = new WebGPUPipelineRuntime({ label: 'main-frame' });
    runtime.createTexture({ id: 'hero-atlas', width: 256, height: 256, format: 'rgba8unorm' });
    runtime.queueTextureUpload('hero-atlas', { bytes: 256 * 256 * 4, source: 'assets/hero.png' });
    runtime.flushTextureUploads();
    runtime.createBuffer({ id: 'camera-uniforms', size: 128, usage: 'uniform' });
    runtime.createBindGroup({ id: 'frame-bindings', resources: ['hero-atlas', 'camera-uniforms'] });
    runtime.createPipeline({ id: 'pbr-forward', layout: 'frame-bindings', vertex: 'vs_main', fragment: 'fs_main' });
    runtime.encodeDraw({ pipeline: 'pbr-forward', bindGroup: 'frame-bindings', vertexCount: 36, instanceCount: 2 });
    runtime.loseDevice('adapter-reset');
    runtime.recoverDevice({ strategy: 'recreate-device' });

    const snapshot = runtime.createSnapshot();

    expect(snapshot.schema).toBe('omnicore.webgpu-pipeline-runtime.v1');
    expect(snapshot.summary).toMatchObject({
      textureCount: 1,
      uploadedTextureCount: 1,
      bufferCount: 1,
      bindGroupCount: 1,
      pipelineCount: 1,
      commandCount: 1,
      recoveryCount: 1,
      deviceLost: false
    });
    expect(snapshot.textures[0]).toMatchObject({ id: 'hero-atlas', uploadState: 'uploaded' });
    expect(snapshot.commandBuffers[0]).toMatchObject({ encoded: true, drawCalls: 1 });
    expect(snapshot.pipelineCache[0]).toMatchObject({ id: 'pbr-forward', hits: 1 });
  });

  it('delegates bodies, sensors, joints, raycast, debug draw, and step calls to external backend modules', () => {
    const calls = [];
    const fakeRapier = {
      createWorld({ gravity }) {
        calls.push(['createWorld', gravity]);
        return { id: 'rapier-world' };
      },
      createRigidBody(world, body) {
        calls.push(['createRigidBody', world.id, body.id, body.type]);
        return { handle: `rb:${body.id}` };
      },
      createJoint(world, joint) {
        calls.push(['createJoint', world.id, joint.id]);
        return { handle: `joint:${joint.id}` };
      },
      step(world, delta) {
        calls.push(['step', world.id, delta]);
        return {
          contacts: [{ bodyA: 'hero', bodyB: 'crate' }],
          sensors: [{ sensorId: 'trigger', bodyId: 'hero' }]
        };
      },
      raycast(world, ray) {
        calls.push(['raycast', world.id, ray.maxDistance]);
        return { bodyId: 'hero', distance: 3, point: { x: 3, y: 0 } };
      },
      debugDraw(world) {
        calls.push(['debugDraw', world.id]);
        return {
          colliders: [{ id: 'hero', shape: 'box' }],
          constraints: [{ id: 'rope', type: 'distance' }]
        };
      }
    };

    const world = createPhysicsWorld({
      backend: 'rapier-real',
      backends: [createExternalPhysicsBackend('rapier-real', { module: fakeRapier, kind: 'rapier' })]
    });
    world.addBody({ id: 'hero', type: 'dynamic', width: 8, height: 8 });
    world.addSensor({ id: 'trigger', width: 4, height: 4 });
    world.addConstraint({ id: 'rope', bodyA: 'hero', bodyB: 'trigger', type: 'distance' });

    const step = world.step(1 / 60);
    const hit = world.raycast({ x: 0, y: 0 }, { x: 1, y: 0 }, 16);
    const snapshot = world.createDiagnosticsSnapshot();

    expect(step).toMatchObject({
      backend: 'rapier-real',
      contacts: [{ bodyA: 'hero', bodyB: 'crate' }],
      sensors: [{ sensorId: 'trigger', bodyId: 'hero' }]
    });
    expect(hit).toMatchObject({ bodyId: 'hero', distance: 3 });
    expect(snapshot.debugDraw).toMatchObject({
      colliders: [{ id: 'hero', shape: 'box' }],
      constraints: [{ id: 'rope', type: 'distance' }]
    });
    expect(calls.map((call) => call[0])).toEqual(expect.arrayContaining([
      'createWorld',
      'createRigidBody',
      'createJoint',
      'step',
      'raycast',
      'debugDraw'
    ]));
  });

  it('exposes editor authoring modules so large panels can move out of editor-app.js', () => {
    const modules = createEditorAuthoringModules();

    expect(Object.keys(modules)).toEqual([
      'visualScript',
      'scene3DViewport',
      'prefabDependencyGraph',
      'webgpuPipeline',
      'dockWindow',
      'runtimeSync'
    ]);
    expect(modules.visualScript.panels).toContain('visual-scripting');
    expect(modules.scene3DViewport.capabilities).toContain('camera3d-preview');
    expect(modules.webgpuPipeline.capabilities).toContain('device-lost-recovery');
  });
});
