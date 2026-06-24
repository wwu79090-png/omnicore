import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createScene3DEditorRuntimeSession } from 'omnicore-editor/src/panels/scene-3d-editor-runtime-session.js';
import { createScene3DViewportRenderState } from 'omnicore-editor/src/panels/scene-3d-viewport-panel.js';
import {
  createRapierDebugDrawVisualization,
  importGLBFile,
  runWebGPUHardwarePath
} from '../src/index.js';

describe('3D editor runtime session loop', () => {
  it('orchestrates viewport mount, GLB import, model editing, Rapier overlays, WebGPU capture, save patch, and export plan', async () => {
    const calls = [];
    const session = createScene3DEditorRuntimeSession({
      scene: createSceneDescriptor(),
      viewport: {
        THREE: createFakeThree(calls),
        OrbitControls: createFakeOrbitControls(calls),
        TransformControls: createFakeTransformControls(calls),
        canvas: { id: 'scene-3d-viewport-canvas' }
      },
      adapters: {
        importGLBFile,
        createRapierDebugDrawVisualization,
        runWebGPUHardwarePath
      }
    });

    const mounted = session.mountViewport();
    const imported = await session.importGLBAsset({
      name: 'crate.glb',
      path: 'assets/crate.glb',
      arrayBuffer: async () => createGLBBuffer({
        asset: { version: '2.0', generator: 'session-test' },
        scenes: [{ nodes: [0] }],
        nodes: [{ mesh: 0 }],
        meshes: [{ primitives: [{ material: 0 }] }],
        materials: [{ name: 'crate-pbr' }],
        animations: [{ name: 'Idle' }]
      })
    });
    const selected = session.selectByPointer({ x: 0.25, y: 0.5 });
    const dragged = session.dragSelected({ x: 0.5, y: 0, z: -1 });
    const material = session.editMaterial('hero-pbr', { baseColor: '#ff8844', roughness: 0.18 });
    const animation = session.switchAnimation('hero', 'Run');
    const rapier = session.applyRapierDebugDraw({
      buffers: { vertices: [0, 0, 0, 0, 1, 0] },
      colliders: [{ id: 'hero-collider', shape: 'box', sensor: false }],
      raycasts: [{ id: 'pick-ray', hit: true, bodyId: 'hero-body', origin: { x: 0, y: 2, z: 0 }, point: { x: 0, y: 1, z: 0 } }]
    });
    const webgpu = await session.captureWebGPUHardware({
      navigator: createFakeNavigatorGPU(calls),
      canvas: createFakeCanvas(calls),
      label: 'session-webgpu'
    });
    const savePatch = session.createSavePatch();
    const exportPlan = session.createExportPlan({ target: 'electron' });
    const snapshot = session.createSnapshot();

    expect(mounted).toMatchObject({ status: 'mounted', viewport: { renderer: 'WebGLRenderer' } });
    expect(imported).toMatchObject({ modelId: 'crate', resourceRecord: { type: 'model', path: 'assets/crate.glb' } });
    expect(selected).toMatchObject({ selectedModelId: 'hero' });
    expect(dragged.position).toMatchObject({ x: 0.5, y: 0, z: -1 });
    expect(material.material).toMatchObject({ color: '#ff8844', roughness: 0.18 });
    expect(animation).toMatchObject({ modelId: 'hero', clip: 'Run' });
    expect(rapier.summary).toMatchObject({ overlayCount: 3, colliderOverlayCount: 1, raycastOverlayCount: 1 });
    expect(webgpu.validation.summary).toMatchObject({ webgpuPassedCount: 1, deviceLostRecovered: true });
    expect(savePatch).toMatchObject({
      schema: 'omnicore.editor-scene-3d-save-patch.v1',
      runtime: {
        importedAssets: [{ id: 'crate', path: 'assets/crate.glb' }],
        selectedModelId: 'hero'
      }
    });
    expect(exportPlan.steps.map((step) => step.id)).toEqual([
      'write-scene',
      'bundle-assets',
      'include-rapier-debug',
      'include-webgpu-report',
      'package-electron'
    ]);
    expect(snapshot.trace.map((entry) => entry.type)).toEqual([
      'mount-viewport',
      'import-glb',
      'select-model',
      'drag-model',
      'edit-material',
      'switch-animation',
      'rapier-debug-draw',
      'webgpu-hardware',
      'save-patch',
      'export-plan'
    ]);
    expect(calls).toEqual(expect.arrayContaining(['WebGLRenderer', 'OrbitControls', 'TransformControls', 'queue.submit']));
  });

  it('exposes runtime session metadata from the 3D viewport render state for the editor UI', () => {
    const renderState = createScene3DViewportRenderState(createSceneDescriptor(), { renderMode: 'real-preview' });

    expect(renderState.runtimeSession).toMatchObject({
      module: 'scene-3d-editor-runtime-session',
      factory: 'createScene3DEditorRuntimeSession',
      lifecycle: ['mountViewport', 'importGLBAsset', 'createSavePatch', 'createExportPlan']
    });
    expect(renderState.runtimeSession.affordances).toEqual(expect.arrayContaining([
      'save-scene-patch',
      'export-electron-project',
      'capture-webgpu-hardware',
      'toggle-rapier-debug'
    ]));
  });

  it('keeps the Electron desktop contract tied to the runtime session save/export flow', () => {
    const spec = readFileSync('tests/e2e/electron-3d-editor-contract.spec.js', 'utf8');

    expect(spec).toContain('scene-3d-editor-runtime-session');
    expect(spec).toContain('createSavePatch');
    expect(spec).toContain('createExportPlan');
  });
});

function createSceneDescriptor() {
  return {
    cameras: [{ id: 'main-camera', fov: 60, position: { x: 0, y: 2, z: 5 }, target: { x: 0, y: 0, z: 0 } }],
    lights: [{ id: 'sun', type: 'directional', castShadow: true }],
    materials: [{ id: 'hero-pbr', baseColor: '#338cff', roughness: 0.42, metallic: 0.18 }],
    models: [{ id: 'hero', material: 'hero-pbr', animations: ['Idle', 'Run'], activeAnimation: 'Idle', collider: { shape: 'box' } }]
  };
}

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
      this.name = '';
    }

    add(child) {
      this.children.push(child);
    }

    lookAt() {}
  }

  return {
    Scene: class extends Object3D {},
    PerspectiveCamera: class extends Object3D {},
    DirectionalLight: class extends Object3D {
      constructor() {
        super();
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
      clipAction(clip) {
        return { clip, play() {} };
      }

      update() {}
    }
  };
}

function createFakeOrbitControls(calls) {
  return class {
    constructor() {
      calls.push('OrbitControls');
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

    setMode() {}
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
    lost: Promise.resolve({ reason: 'destroyed', message: 'session device lost' }),
    createTexture() {
      return { createView: () => ({}) };
    },
    createBuffer() {
      return {};
    },
    createCommandEncoder() {
      return {
        beginRenderPass() {
          return { end() {} };
        },
        finish() {
          return {};
        }
      };
    }
  };
  return {
    gpu: {
      getPreferredCanvasFormat: () => 'bgra8unorm',
      async requestAdapter() {
        return {
          async requestDevice() {
            return device;
          }
        };
      }
    }
  };
}

function createFakeCanvas() {
  return {
    width: 64,
    height: 64,
    getContext() {
      return {
        configure() {},
        getCurrentTexture() {
          return {
            createView() {
              return {};
            }
          };
        }
      };
    }
  };
}
