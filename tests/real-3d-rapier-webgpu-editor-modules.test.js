import { describe, expect, it, afterEach } from 'vitest';
import {
  createRapierPhysicsBackend,
  createPhysicsWorld
} from '@omnicore/physics';
import { createEditorApp } from 'omnicore-editor/src/editor-app.js';
import { createEditorState } from 'omnicore-editor/src/live-sync-protocol.js';
import { createScene3DViewportRenderState } from 'omnicore-editor/src/panels/scene-3d-viewport-panel.js';
import {
  Runtime3DScene,
  ThreeRuntimeAdapter,
  WebGPURenderer
} from '../src/index.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('real 3D adapter, Rapier backend, WebGPU renderer runtime, and editor panel modules', () => {
  it('builds a real Three.js runtime from Runtime3DScene descriptors', async () => {
    const fake = createFakeThreeRuntime();
    const scene = new Runtime3DScene({ name: 'arena', background: '#101820' });
    scene.addCamera({ id: 'main-camera', mode: 'free', controls: ['orbit'], position: { x: 1, y: 2, z: 3 } });
    scene.addLight({ id: 'sun', type: 'directional', castShadow: true, intensity: 2 });
    scene.addPBRMaterial('hero-mat', { baseColor: '#88ccff', metallic: 0.25, roughness: 0.4 });
    scene.addGLTFModel({
      id: 'hero',
      url: 'assets/hero.glb',
      material: 'hero-mat',
      animations: ['Idle', 'Run'],
      animation: 'Idle',
      castShadow: true,
      collider: { shape: 'box', width: 1, height: 2, depth: 1 }
    });

    const adapter = new ThreeRuntimeAdapter({
      THREE: fake.THREE,
      GLTFLoader: fake.GLTFLoader,
      EffectComposer: fake.EffectComposer,
      RenderPass: fake.RenderPass,
      canvas: { id: 'canvas' },
      width: 640,
      height: 360,
      postprocess: [{ type: 'bloom' }]
    });
    await adapter.build(scene);
    await adapter.loadModels();
    adapter.playAnimation('hero', 'Run');
    adapter.renderFrame(1 / 60);

    const snapshot = adapter.createSnapshot();

    expect(snapshot.schema).toBe('omnicore.three-runtime-adapter.v1');
    expect(snapshot.summary).toMatchObject({
      renderer: 'WebGLRenderer',
      cameraCount: 1,
      lightCount: 1,
      materialCount: 1,
      modelCount: 1,
      gltfLoadedCount: 1,
      mixerCount: 1,
      composerEnabled: true,
      shadowMapEnabled: true
    });
    expect(snapshot.models[0]).toMatchObject({
      id: 'hero',
      url: 'assets/hero.glb',
      activeAnimation: 'Run',
      castShadow: true,
      receiveShadow: true
    });
    expect(fake.calls).toEqual(expect.arrayContaining([
      ['renderer.setSize', 640, 360],
      ['loader.loadAsync', 'assets/hero.glb'],
      ['mixer.clipAction', 'Run'],
      ['action.play', 'Run'],
      ['composer.render']
    ]));
  });

  it('wraps Rapier JS APIs as a real backend for bodies, colliders, sensors, joints, raycast, and debug draw', () => {
    const fakeRapier = createFakeRapierModule();
    const world = createPhysicsWorld({
      backend: 'rapier3d',
      backends: [createRapierPhysicsBackend({ id: 'rapier3d', RAPIER: fakeRapier })]
    });

    world.addBody({
      id: 'hero',
      type: 'dynamic',
      x: 1,
      y: 2,
      z: 3,
      collider: { shape: 'box', width: 2, height: 4, depth: 6 }
    });
    world.addSensor({
      id: 'trigger',
      x: 3,
      y: 2,
      collider: { shape: 'ball', radius: 1 }
    });
    world.addConstraint({ id: 'hero-trigger-joint', type: 'fixed', bodyA: 'hero', bodyB: 'trigger' });

    const step = world.step(1 / 60);
    const hit = world.raycast({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 10);
    const debugDraw = world.debugDraw();

    expect(step).toMatchObject({ backend: 'rapier3d', stepped: true });
    expect(hit).toMatchObject({ bodyId: 'hero', distance: 4 });
    expect(debugDraw).toMatchObject({
      source: 'external-backend',
      buffers: { vertices: [0, 0, 0, 1, 1, 1], colors: [1, 0, 0, 1] }
    });
    expect(fakeRapier.calls.map((call) => call[0])).toEqual(expect.arrayContaining([
      'World',
      'RigidBodyDesc.dynamic',
      'ColliderDesc.cuboid',
      'ColliderDesc.ball',
      'ColliderDesc.setSensor',
      'World.createImpulseJoint',
      'World.step',
      'World.castRay',
      'World.debugRender'
    ]));
  });

  it('feeds WebGPUPipelineRuntime from WebGPURenderer render frames', async () => {
    const renderer = await new WebGPURenderer({
      canvas: createWebGPUCanvas(),
      gpu: createFakeGPU()
    }).init();

    renderer.renderScene({
      children: [
        { id: 'hero', type: 'sprite', texture: 'hero-atlas', x: 0, y: 0, width: 16, height: 16 }
      ]
    });

    const snapshot = renderer.pipelineRuntime.createSnapshot();

    expect(snapshot.summary).toMatchObject({
      textureCount: 2,
      uploadedTextureCount: 1,
      bufferCount: 1,
      bindGroupCount: 1,
      pipelineCount: 1,
      commandCount: 1,
      deviceLost: false
    });
    expect(snapshot.textures.map((texture) => texture.id)).toEqual(expect.arrayContaining([
      'swapchain',
      'hero-atlas'
    ]));
    expect(snapshot.pipelineCache[0]).toMatchObject({ id: 'sprite-batch-pipeline', warmed: true });
  });

  it('moves 3D editor viewport real-preview state into a panel module', () => {
    const input = {
      cameras: [{ id: 'main-camera', type: 'Camera3D', mode: 'free' }],
      lights: [{ id: 'sun', type: 'directional', castShadow: true }],
      materials: [{ id: 'hero-mat', type: 'PBRMaterial', baseColor: '#88ccff' }],
      models: [{
        id: 'hero',
        url: 'assets/hero.glb',
        material: 'hero-mat',
        animations: ['Idle', 'Run'],
        activeAnimation: 'Idle'
      }],
      colliders: [{ modelId: 'hero', shape: 'box' }]
    };
    const renderState = createScene3DViewportRenderState(input, {
      runtimeAdapter: 'three',
      renderMode: 'real-preview'
    });

    expect(renderState).toMatchObject({
      runtimeAdapter: 'three',
      renderMode: 'real-preview',
      gltfPreloadQueue: ['assets/hero.glb'],
      overlays: {
        colliders: true,
        lights: true,
        shadows: true
      }
    });
    expect(renderState.animationPreview).toMatchObject({ modelId: 'hero', clip: 'Idle' });

    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, { state: createEditorState() });
    const viewport = app.EditorAPI.openScene3DViewport(input, {
      runtimeAdapter: 'three',
      renderMode: 'real-preview'
    });

    expect(viewport.runtimeAdapter).toBe('three');
    expect(viewport.gltfPreloadQueue).toEqual(['assets/hero.glb']);
    expect(root.querySelector('[data-scene-3d-real-preview]')?.textContent).toContain('Three.js');
    app.destroy();
  });
});

function createFakeThreeRuntime() {
  const calls = [];

  class Object3D {
    constructor(type = 'Object3D') {
      this.type = type;
      this.children = [];
      this.position = createVectorWriter(`${type}.position`, calls);
      this.rotation = createVectorWriter(`${type}.rotation`, calls);
      this.scale = createVectorWriter(`${type}.scale`, calls);
      this.castShadow = false;
      this.receiveShadow = false;
    }

    add(child) {
      this.children.push(child);
      calls.push([`${this.type}.add`, child.type || child.id]);
    }

    traverse(visitor) {
      visitor(this);
      for (const child of this.children) child.traverse?.(visitor);
    }
  }

  class WebGLRenderer {
    constructor(options) {
      this.type = 'WebGLRenderer';
      this.options = options;
      this.shadowMap = { enabled: false };
      this.domElement = {};
      calls.push(['WebGLRenderer', options]);
    }

    setSize(width, height) {
      calls.push(['renderer.setSize', width, height]);
    }

    render() {
      calls.push(['renderer.render']);
    }
  }

  class PerspectiveCamera extends Object3D {
    constructor(fov, aspect, near, far) {
      super('PerspectiveCamera');
      this.fov = fov;
      this.aspect = aspect;
      this.near = near;
      this.far = far;
    }

    lookAt(x, y, z) {
      calls.push(['camera.lookAt', x, y, z]);
    }
  }

  class DirectionalLight extends Object3D {
    constructor(color, intensity) {
      super('DirectionalLight');
      this.color = color;
      this.intensity = intensity;
      this.shadow = { mapSize: createVectorWriter('DirectionalLight.shadow.mapSize', calls) };
    }
  }

  class MeshStandardMaterial {
    constructor(options) {
      this.type = 'MeshStandardMaterial';
      this.options = options;
      calls.push(['MeshStandardMaterial', options.color, options.metalness, options.roughness]);
    }
  }

  class AnimationMixer {
    constructor(object) {
      this.object = object;
      calls.push(['AnimationMixer', object.type]);
    }

    clipAction(clip) {
      calls.push(['mixer.clipAction', clip.name]);
      return {
        play() {
          calls.push(['action.play', clip.name]);
        }
      };
    }

    update(delta) {
      calls.push(['mixer.update', delta]);
    }
  }

  class GLTFLoader {
    async loadAsync(url) {
      calls.push(['loader.loadAsync', url]);
      const mesh = new Object3D('Mesh');
      const scene = new Object3D('GLTFScene');
      scene.add(mesh);
      return { scene, animations: [{ name: 'Idle' }, { name: 'Run' }] };
    }
  }

  class EffectComposer {
    constructor(renderer) {
      this.renderer = renderer;
      this.passes = [];
      calls.push(['EffectComposer']);
    }

    addPass(pass) {
      this.passes.push(pass);
      calls.push(['composer.addPass', pass.type]);
    }

    render() {
      calls.push(['composer.render']);
    }
  }

  class RenderPass {
    constructor(scene, camera) {
      this.type = 'RenderPass';
      this.scene = scene;
      this.camera = camera;
    }
  }

  return {
    calls,
    THREE: {
      Scene: class Scene extends Object3D {
        constructor() {
          super('Scene');
        }
      },
      Color: class Color {
        constructor(value) {
          this.value = value;
        }
      },
      WebGLRenderer,
      PerspectiveCamera,
      DirectionalLight,
      MeshStandardMaterial,
      AnimationMixer
    },
    GLTFLoader,
    EffectComposer,
    RenderPass
  };
}

function createVectorWriter(label, calls) {
  return {
    set(...values) {
      calls.push([`${label}.set`, ...values]);
    }
  };
}

function createFakeRapierModule() {
  const calls = [];

  class World {
    constructor(gravity) {
      this.gravity = gravity;
      this.bodies = [];
      this.colliders = [];
      this.joints = [];
      calls.push(['World', gravity]);
    }

    createRigidBody(desc) {
      const body = { id: desc.id, desc, handle: `body:${desc.id}` };
      this.bodies.push(body);
      calls.push(['World.createRigidBody', desc.kind, desc.translation]);
      return body;
    }

    createCollider(desc, body) {
      const collider = { desc, body, handle: `collider:${body.id}` };
      this.colliders.push(collider);
      calls.push(['World.createCollider', desc.shape, body.id]);
      return collider;
    }

    createImpulseJoint(joint, bodyA, bodyB) {
      this.joints.push({ joint, bodyA, bodyB });
      calls.push(['World.createImpulseJoint', joint.type, bodyA.id, bodyB.id]);
      return { handle: `joint:${bodyA.id}:${bodyB.id}` };
    }

    step() {
      calls.push(['World.step']);
    }

    castRay(ray, maxDistance) {
      calls.push(['World.castRay', maxDistance]);
      return { collider: { parent: () => this.bodies[0] }, toi: 4 };
    }

    debugRender() {
      calls.push(['World.debugRender']);
      return { vertices: [0, 0, 0, 1, 1, 1], colors: [1, 0, 0, 1] };
    }
  }

  const RigidBodyDesc = {
    dynamic: () => createBodyDesc('dynamic', calls),
    fixed: () => createBodyDesc('fixed', calls),
    kinematicPositionBased: () => createBodyDesc('kinematic', calls)
  };

  const ColliderDesc = {
    cuboid: (hx, hy, hz) => createColliderDesc('cuboid', { hx, hy, hz }, calls),
    ball: (radius) => createColliderDesc('ball', { radius }, calls),
    capsule: (halfHeight, radius) => createColliderDesc('capsule', { halfHeight, radius }, calls)
  };

  const JointData = {
    fixed: () => ({ type: 'fixed' })
  };

  class Ray {
    constructor(origin, direction) {
      this.origin = origin;
      this.direction = direction;
      calls.push(['Ray', origin, direction]);
    }
  }

  return { calls, World, RigidBodyDesc, ColliderDesc, JointData, Ray };
}

function createBodyDesc(kind, calls) {
  calls.push([`RigidBodyDesc.${kind}`]);
  return {
    kind,
    setTranslation(x, y, z) {
      this.translation = { x, y, z };
      return this;
    }
  };
}

function createColliderDesc(shape, size, calls) {
  calls.push([`ColliderDesc.${shape}`, size]);
  return {
    shape,
    size,
    setSensor(value) {
      this.sensor = Boolean(value);
      calls.push(['ColliderDesc.setSensor', this.sensor]);
      return this;
    }
  };
}

function createWebGPUCanvas() {
  return {
    width: 0,
    height: 0,
    getContext(type) {
      if (type !== 'webgpu') return null;
      return {
        configure(config) {
          this.config = config;
        }
      };
    }
  };
}

function createFakeGPU() {
  return {
    getPreferredCanvasFormat: () => 'bgra8unorm',
    requestAdapter: async () => ({
      requestDevice: async () => ({
        createShaderModule: (descriptor) => descriptor,
        createRenderPipeline: (descriptor) => descriptor,
        createBuffer: (descriptor) => ({ descriptor, buffer: new ArrayBuffer(descriptor.size || 0) }),
        queue: {
          writeBuffer() {},
          submit() {}
        }
      })
    })
  };
}
