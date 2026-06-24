import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createScene3DThreeRuntime } from 'omnicore-editor/src/panels/scene-3d-three-runtime.js';
import {
  createRapierDebugDrawVisualization,
  importGLBFile,
  runWebGPUHardwarePath
} from '../src/index.js';

describe('real 3D editor runtime adapters and template', () => {
  it('mounts a real Three viewport runtime with renderer, orbit controls, transform controls, raycaster, material editing, and animation switching', () => {
    const calls = [];
    const runtime = createScene3DThreeRuntime({
      THREE: createFakeThree(calls),
      OrbitControls: createFakeOrbitControls(calls),
      TransformControls: createFakeTransformControls(calls),
      canvas: { id: 'scene-3d-viewport-canvas' },
      scene: {
        cameras: [{ id: 'main-camera', fov: 60, position: { x: 0, y: 2, z: 5 }, target: { x: 0, y: 0, z: 0 } }],
        lights: [{ id: 'sun', type: 'directional', castShadow: true }],
        materials: [{ id: 'hero-pbr', baseColor: '#338cff', roughness: 0.42, metallic: 0.18 }],
        models: [{ id: 'hero', material: 'hero-pbr', animations: ['Idle', 'Run'], activeAnimation: 'Idle', collider: { shape: 'box' } }]
      }
    });

    const mount = runtime.mount();
    const selected = runtime.selectByPointer({ x: 0.5, y: 0.5 });
    const drag = runtime.dragSelected({ x: 1, y: 0.2, z: -0.5 });
    const material = runtime.editMaterial('hero-pbr', { baseColor: '#ffcc33', roughness: 0.2 });
    const animation = runtime.switchAnimation('hero', 'Run');
    const frame = runtime.renderFrame(1 / 60);

    expect(mount).toMatchObject({
      renderer: 'WebGLRenderer',
      orbitControls: true,
      transformControls: true,
      raycaster: true
    });
    expect(selected).toMatchObject({ selectedModelId: 'hero' });
    expect(drag.position).toMatchObject({ x: 1, y: 0.2, z: -0.5 });
    expect(material.material).toMatchObject({ color: '#ffcc33', roughness: 0.2 });
    expect(animation).toMatchObject({ modelId: 'hero', clip: 'Run' });
    expect(frame.summary).toMatchObject({ modelCount: 1, selectedModelId: 'hero' });
    expect(calls).toEqual(expect.arrayContaining([
      'WebGLRenderer',
      'OrbitControls',
      'TransformControls',
      'Raycaster',
      'transform.attach:hero'
    ]));
  });

  it('turns Rapier debug draw buffers, colliders, sensors, joints, and raycasts into visible overlay descriptors', () => {
    const visualization = createRapierDebugDrawVisualization({
      buffers: { vertices: [0, 0, 0, 1, 1, 1], colors: [1, 0, 0, 1, 0, 1, 0, 1] },
      colliders: [
        { id: 'hero-collider', shape: 'box', sensor: false, position: { x: 0, y: 1, z: 0 }, size: { x: 1, y: 1, z: 1 } },
        { id: 'goal-sensor', shape: 'box', sensor: true, position: { x: 0, y: 0.5, z: 0 }, size: { x: 2, y: 0.25, z: 2 } }
      ],
      constraints: [{ id: 'hero-floor-fixed-joint', type: 'fixed', bodyA: 'hero-body', bodyB: 'floor' }],
      raycasts: [{ id: 'pick-ray', hit: true, bodyId: 'hero-body', origin: { x: 0, y: 4, z: 0 }, point: { x: 0, y: 1, z: 0 } }]
    });

    expect(visualization.schema).toBe('omnicore.rapier-debug-draw-visualization.v1');
    expect(visualization.summary).toMatchObject({
      lineCount: 1,
      colliderOverlayCount: 2,
      sensorOverlayCount: 1,
      jointOverlayCount: 1,
      raycastOverlayCount: 1
    });
    expect(visualization.overlays.map((overlay) => overlay.kind)).toEqual(expect.arrayContaining([
      'debug-line',
      'collider-box',
      'sensor-volume',
      'joint-link',
      'raycast-hit'
    ]));
  });

  it('imports a real GLB file buffer, parses the JSON chunk, creates thumbnail/import data, collider, resource record, and scene patch', async () => {
    const buffer = createGLBBuffer({
      asset: { version: '2.0', generator: 'unit-test' },
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ material: 0 }] }],
      materials: [{ name: 'hero-pbr' }],
      animations: [{ name: 'Idle' }]
    });
    const result = await importGLBFile({
      file: { name: 'hero.glb', path: 'assets/hero.glb', arrayBuffer: async () => buffer }
    });

    expect(result.schema).toBe('omnicore.glb-file-import.v1');
    expect(result.glb).toMatchObject({ magic: 'glTF', version: 2 });
    expect(result.document.asset.version).toBe('2.0');
    expect(result.thumbnail).toMatchObject({ type: 'model-preview', modelId: 'hero' });
    expect(result.resourceRecord).toMatchObject({ type: 'model', path: 'assets/hero.glb' });
    expect(result.workflow.sceneInsertion.patch.runtime.models[0]).toMatchObject({
      id: 'hero',
      url: 'assets/hero.glb',
      activeAnimation: 'Idle',
      collider: { shape: 'box' }
    });
  });

  it('executes a WebGPU hardware path through requestAdapter, requestDevice, resource creation, render pass, submit, and device lost reporting', async () => {
    const calls = [];
    const report = await runWebGPUHardwarePath({
      navigator: createFakeNavigatorGPU(calls),
      canvas: createFakeCanvas(calls),
      label: 'unit-webgpu-path'
    });

    expect(report.schema).toBe('omnicore.webgpu-hardware-run.v1');
    expect(report.validation.summary).toMatchObject({
      browserCount: 1,
      webgpuPassedCount: 1,
      fallbackCount: 0,
      deviceLostRecovered: true
    });
    expect(report.pipeline.summary).toMatchObject({
      uploadedTextureCount: 1,
      bufferCount: 1,
      commandCount: 1,
      recoveryCount: 1
    });
    expect(calls).toEqual([
      'requestAdapter',
      'requestDevice',
      'getContext:webgpu',
      'configure',
      'createTexture',
      'createBuffer',
      'createCommandEncoder',
      'getCurrentTexture',
      'createView',
      'beginRenderPass',
      'endRenderPass',
      'finish',
      'queue.submit'
    ]);
  });

  it('ships an Electron 3D editor E2E contract and a playable 3D template with camera, controller, Rapier ground, pickup, animation, and export config', () => {
    const spec = readFileSync('tests/e2e/electron-3d-editor-contract.spec.js', 'utf8');
    const scene = JSON.parse(readFileSync('examples/template-3d-playable/scene.omnicore.json', 'utf8'));
    const main = readFileSync('examples/template-3d-playable/src/main.js', 'utf8');
    const rootPackage = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(spec).toContain('_electron.launch');
    expect(spec).toContain('打开官方 3D Demo');
    expect(spec).toContain('导入 GLB');
    expect(spec).toContain('保存场景');
    expect(spec).toContain('导出项目');
    expect(scene.runtime.cameras[0]).toMatchObject({ mode: 'third-person' });
    expect(scene.runtime.player).toMatchObject({ controller: 'third-person-character' });
    expect(scene.runtime.physics).toMatchObject({ backend: 'rapier3d-compat' });
    expect(scene.runtime.pickups[0]).toMatchObject({ id: 'coin-01' });
    expect(scene.export.targets).toEqual(expect.arrayContaining(['web', 'electron']));
    expect(main).toContain('third-person-character');
    expect(main).toContain('Rapier');
    expect(rootPackage.files).toContain('examples/template-3d-playable');
    expect(existsSync('examples/template-3d-playable/package.json')).toBe(true);
  });
});

function createFakeThree(calls) {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
      this.set(x, y, z);
    }

    set(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
  }

  class Object3D {
    constructor() {
      this.position = new Vector3();
      this.rotation = new Vector3();
      this.scale = new Vector3(1, 1, 1);
      this.children = [];
      this.material = null;
      this.name = '';
    }

    add(child) {
      this.children.push(child);
    }

    lookAt() {}
  }

  return {
    Scene: class extends Object3D {},
    PerspectiveCamera: class extends Object3D {
      constructor(fov, aspect, near, far) {
        super();
        this.fov = fov;
        this.aspect = aspect;
        this.near = near;
        this.far = far;
      }
    },
    DirectionalLight: class extends Object3D {
      constructor(color, intensity) {
        super();
        this.color = color;
        this.intensity = intensity;
        this.shadow = { mapSize: { set() {} } };
      }
    },
    MeshStandardMaterial: class {
      constructor(options = {}) {
        Object.assign(this, options);
      }
    },
    BoxGeometry: class {},
    Mesh: class extends Object3D {
      constructor(geometry, material) {
        super();
        this.geometry = geometry;
        this.material = material;
      }
    },
    Raycaster: class {
      constructor() {
        calls.push('Raycaster');
      }

      setFromCamera() {}

      intersectObjects(objects) {
        return objects.length ? [{ object: objects[0] }] : [];
      }
    },
    WebGLRenderer: class {
      constructor() {
        calls.push('WebGLRenderer');
        this.shadowMap = {};
      }

      setSize() {}

      render() {}
    },
    AnimationMixer: class {
      constructor(object) {
        this.object = object;
      }

      clipAction(clip) {
        return { clip, play() {} };
      }

      update() {}
    },
    Vector3
  };
}

function createFakeOrbitControls(calls) {
  return class {
    constructor() {
      calls.push('OrbitControls');
      this.target = { set() {} };
    }

    update() {}
  };
}

function createFakeTransformControls(calls) {
  return class {
    constructor() {
      calls.push('TransformControls');
    }

    attach(object) {
      calls.push(`transform.attach:${object.name}`);
    }

    setMode(mode) {
      this.mode = mode;
    }
  };
}

function createGLBBuffer(document) {
  const json = JSON.stringify(document);
  const jsonBytes = new TextEncoder().encode(json.padEnd(json.length + ((4 - (json.length % 4)) % 4), ' '));
  const total = 12 + 8 + jsonBytes.byteLength;
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'glTF');
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.byteLength, true);
  writeAscii(view, 16, 'JSON');
  new Uint8Array(buffer, 20, jsonBytes.byteLength).set(jsonBytes);
  return buffer;
}

function writeAscii(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
}

function createFakeNavigatorGPU(calls) {
  const device = {
    queue: {
      submit() {
        calls.push('queue.submit');
      }
    },
    lost: Promise.resolve({ reason: 'destroyed', message: 'test device lost' }),
    createTexture() {
      calls.push('createTexture');
      return { createView: () => ({}) };
    },
    createBuffer() {
      calls.push('createBuffer');
      return {};
    },
    createCommandEncoder() {
      calls.push('createCommandEncoder');
      return {
        beginRenderPass() {
          calls.push('beginRenderPass');
          return {
            end() {
              calls.push('endRenderPass');
            }
          };
        },
        finish() {
          calls.push('finish');
          return {};
        }
      };
    }
  };
  return {
    gpu: {
      getPreferredCanvasFormat: () => 'bgra8unorm',
      async requestAdapter() {
        calls.push('requestAdapter');
        return {
          async requestDevice() {
            calls.push('requestDevice');
            return device;
          }
        };
      }
    }
  };
}

function createFakeCanvas(calls) {
  return {
    width: 64,
    height: 64,
    getContext(type) {
      calls.push(`getContext:${type}`);
      return {
        configure() {
          calls.push('configure');
        },
        getCurrentTexture() {
          calls.push('getCurrentTexture');
          return {
            createView() {
              calls.push('createView');
              return {};
            }
          };
        }
      };
    }
  };
}
