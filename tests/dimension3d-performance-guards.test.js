import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const threeState = vi.hoisted(() => ({
  renderCalls: [],
  sceneAdds: [],
  sceneRemoves: [],
  instancedMeshes: [],
  loadedUrls: [],
  nextComplexity: null,
  reset() {
    this.renderCalls = [];
    this.sceneAdds = [];
    this.sceneRemoves = [];
    this.instancedMeshes = [];
    this.loadedUrls = [];
    this.nextComplexity = null;
  },
  createMesh(url) {
    const complexity = this.nextComplexity || {
      indexCount: 300,
      textureWidth: 512,
      textureHeight: 512
    };
    const mesh = {
      name: `${url}-mesh`,
      isMesh: true,
      geometry: {
        index: { count: complexity.indexCount },
        attributes: {
          position: { count: complexity.positionCount || complexity.indexCount }
        },
        dispose: vi.fn()
      },
      material: {
        map: {
          image: {
            width: complexity.textureWidth,
            height: complexity.textureHeight
          }
        },
        dispose: vi.fn()
      }
    };
    const root = {
      name: url,
      position: { set: vi.fn() },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { set: vi.fn(), setScalar: vi.fn() },
      userData: {},
      children: [mesh],
      updateMatrix: vi.fn(() => {
        root.matrix = { from: url, updated: true };
      }),
      traverse: vi.fn((visitor) => {
        visitor(root);
        visitor(mesh);
      })
    };
    mesh.parent = root;
    return root;
  }
}));

vi.mock('three', () => {
  class Scene {
    constructor() {
      this.children = [];
    }

    add(object) {
      this.children.push(object);
      threeState.sceneAdds.push(object);
    }

    remove(object) {
      this.children = this.children.filter((child) => child !== object);
      threeState.sceneRemoves.push(object);
    }
  }

  class PerspectiveCamera {
    constructor() {
      this.position = { z: 0 };
    }

    updateProjectionMatrix() {}
  }

  class WebGLRenderer {
    constructor(options) {
      this.domElement = options.canvas || document.createElement('canvas');
      this.setPixelRatio = vi.fn();
      this.setSize = vi.fn();
      this.render = vi.fn((scene, camera) => threeState.renderCalls.push({ scene, camera }));
      this.dispose = vi.fn();
    }
  }

  class InstancedMesh {
    constructor(geometry, material, count) {
      this.geometry = geometry;
      this.material = material;
      this.maxCount = count;
      this.count = 0;
      this.instanceMatrix = { needsUpdate: false };
      this.matrices = [];
      this.userData = {};
      this.isInstancedMesh = true;
      this.rotation = { x: 0, y: 0, z: 0 };
      threeState.instancedMeshes.push(this);
    }

    setMatrixAt(index, matrix) {
      this.matrices[index] = matrix;
    }
  }

  class AmbientLight {}
  class DirectionalLight {
    constructor() {
      this.position = { set: vi.fn() };
    }
  }
  class AnimationMixer {
    update() {}
  }

  return {
    AmbientLight,
    AnimationMixer,
    DirectionalLight,
    InstancedMesh,
    PerspectiveCamera,
    Raycaster: null,
    Scene,
    WebGLRenderer
  };
});

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    async loadAsync(url) {
      threeState.loadedUrls.push(url);
      return {
        scene: threeState.createMesh(url),
        animations: []
      };
    }
  }
}));

describe('Dimension3D performance guards', () => {
  let Dimension3D;
  let rafCallbacks;
  let rafId;

  beforeAll(async () => {
    Dimension3D = (await import('../src/dimension3d/Dimension3D.js')).default;
  });

  afterEach(() => {
    threeState.reset();
    rafCallbacks = [];
    rafId = 0;
    vi.restoreAllMocks();
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
    document.body.innerHTML = '';
  });

  it('does not cap the decorative renderer by default on high refresh frames', async () => {
    rafCallbacks = [];
    rafId = 0;
    globalThis.requestAnimationFrame = vi.fn((callback) => {
      rafCallbacks.push(callback);
      rafId += 1;
      return rafId;
    });
    globalThis.cancelAnimationFrame = vi.fn();
    const dimension = await new Dimension3D({ canvas: document.createElement('canvas') }).init();

    dimension.startRenderLoop();
    runNextFrame(0);
    runNextFrame(16);
    expect(threeState.renderCalls).toHaveLength(1);
    runNextFrame(24);
    expect(threeState.renderCalls).toHaveLength(2);
    expect(dimension.renderTargetFps).toBeNull();

    dimension.stopRenderLoop();
    expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
  });

  it('warns when loaded GLB complexity exceeds triangle or texture budgets', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    threeState.nextComplexity = {
      indexCount: 60003,
      textureWidth: 4096,
      textureHeight: 2048
    };
    const dimension = await new Dimension3D({ canvas: document.createElement('canvas') }).init();

    const model = await dimension.addModel('city', '/models/city.glb');

    expect(model.complexity).toMatchObject({
      triangles: 20001,
      maxTextureSize: 4096,
      overBudget: true
    });
    expect(warn).toHaveBeenCalledWith('[OmniCore] 2.5D 模型复杂度过高，建议优化。', expect.objectContaining({
      url: '/models/city.glb',
      triangles: 20001,
      maxTextureSize: 4096
    }));
  });

  it('merges repeated static model references into one InstancedMesh draw group', async () => {
    const dimension = await new Dimension3D({ canvas: document.createElement('canvas') }).init();

    const first = await dimension.addModel('tree-a', '/models/tree.glb', { x: 0, y: 0, z: 0 });
    const second = await dimension.addModel('tree-b', '/models/tree.glb', { x: 2, y: 0, z: 0 });

    expect(first.instanceGroup).toBe(second.instanceGroup);
    expect(threeState.instancedMeshes).toHaveLength(1);
    expect(threeState.instancedMeshes[0].count).toBe(2);
    expect(threeState.instancedMeshes[0].matrices).toHaveLength(2);
    expect(threeState.sceneAdds.filter((object) => object.isInstancedMesh)).toHaveLength(1);
  });

  it('filters 2.5D occlusion sorting through projected AABB candidates', () => {
    const layer = new Dimension3D.PlaneLayer({ zToYScale: 12 });
    const hero = { id: 'hero', x: 96, y: 120, width: 32, height: 48 };
    const nearTree = {
      id: 'near-tree',
      position: { x: 112, y: 0, z: 10 },
      bounds: { width: 96, height: 160, depth: 96 }
    };
    const farTree = {
      id: 'far-tree',
      position: { x: 520, y: 0, z: 10 },
      bounds: { width: 96, height: 160, depth: 96 }
    };

    const candidates = layer.occlusionCandidates2D(hero, [nearTree, farTree]);

    expect(candidates.map((entry) => entry.model.id)).toEqual(['near-tree']);
    expect(farTree.omnicoreOcclusionSkipped).toBe(true);
    expect(nearTree.omnicoreProjectedAabb).toMatchObject({
      minX: 64,
      maxX: 160
    });
  });

  function runNextFrame(timestamp) {
    const callback = rafCallbacks.shift();
    expect(callback).toBeTypeOf('function');
    callback(timestamp);
  }
});
