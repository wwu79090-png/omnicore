import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const threeState = vi.hoisted(() => ({
  loadedUrls: [],
  resolveLoad: null,
  reset() {
    this.loadedUrls = [];
    this.resolveLoad = null;
  },
  createRoot(url) {
    return {
      name: url.split('/').pop(),
      position: { set: vi.fn() },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { set: vi.fn(), setScalar: vi.fn() },
      userData: {},
      traverse: vi.fn((visitor) => visitor({
        geometry: { dispose: vi.fn() },
        material: { dispose: vi.fn() }
      }))
    };
  }
}));

vi.mock('three', () => {
  class Scene {
    constructor() {
      this.children = [];
    }

    add(object) {
      this.children.push(object);
    }

    remove(object) {
      this.children = this.children.filter((child) => child !== object);
    }
  }

  class PerspectiveCamera {
    constructor() {
      this.position = { z: 0, set: vi.fn() };
      this.updateProjectionMatrix = vi.fn();
    }
  }

  class WebGLRenderer {
    constructor(options) {
      this.domElement = options.canvas || document.createElement('canvas');
      this.setPixelRatio = vi.fn();
      this.setSize = vi.fn();
      this.render = vi.fn();
      this.dispose = vi.fn();
    }
  }

  class AmbientLight {}
  class DirectionalLight {
    constructor() {
      this.position = { set: vi.fn() };
    }
  }

  return {
    AmbientLight,
    AnimationMixer: null,
    DirectionalLight,
    InstancedMesh: null,
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
      return new Promise((resolve) => {
        threeState.resolveLoad = () => resolve({
          scene: threeState.createRoot(url),
          animations: []
        });
      });
    }
  }
}));

describe('Dimension3D 2.5D hardening', () => {
  let Dimension3D;

  beforeAll(async () => {
    vi.resetModules();
    Dimension3D = (await import('../src/dimension3d/Dimension3D.js')).default;
  });

  afterEach(() => {
    threeState.reset();
    document.body.innerHTML = '';
  });

  it('uses manual depthMap baselines and colliders separately from visual Z mapping', () => {
    const hero = { id: 'hero', x: 92, y: 140, width: 24, height: 36 };
    const canopy = {
      id: 'canopy',
      position: { x: 100, y: 0, z: 12 },
      bounds: { width: 140, height: 180, depth: 90 },
      depthMap: {
        baselineY: 88,
        range: { minY: 64, maxY: 168 },
        collider: { x: 80, y: 72, width: 48, height: 72 }
      }
    };
    const layer = new Dimension3D.PlaneLayer({ zToYScale: 16 });

    layer.add3D(canopy);
    layer.add2D(hero);
    layer.applyZSort();

    expect(canopy.omnicorePlaneDepth).toBe(88);
    expect(canopy.zIndex).toBeLessThan(hero.zIndex);
    expect(layer.projectCollider3D(canopy)).toMatchObject({
      x: 80,
      y: 72,
      width: 48,
      height: 72,
      minX: 80,
      maxX: 128,
      minY: 72,
      maxY: 144
    });
  });

  it('returns debug guides for model depth ranges and 2D sprite projection lines', () => {
    const layer = new Dimension3D.PlaneLayer({ zToYScale: 16, debug: true });
    const canopy = {
      id: 'canopy',
      position: { x: 100, y: 0, z: 12 },
      bounds: { width: 140, height: 180, depth: 90 },
      depthMap: {
        baselineY: 88,
        range: { minY: 64, maxY: 168 }
      }
    };
    const hero = { id: 'hero', x: 92, y: 140, width: 24, height: 36 };
    layer.add3D(canopy);
    layer.add2D(hero);

    const guides = layer.createDebugGuides({ sprites: [hero], models: [canopy] });

    expect(guides.enabled).toBe(true);
    expect(guides.modelDepthRanges[0]).toMatchObject({
      id: 'canopy',
      baselineY: 88,
      minY: 64,
      maxY: 168
    });
    expect(guides.spriteProjectionLines[0]).toMatchObject({
      id: 'hero',
      from: { x: 104, y: 176 },
      to: { x: 104, y: 88 }
    });
  });

  it('applies a coordinate bias to 2D/3D plane projection and debug guides', () => {
    const layer = new Dimension3D.PlaneLayer({ zToYScale: 16, debug: true });
    const bias = layer.setCoordinateBias(0.5, -1);
    const canopy = {
      id: 'canopy',
      position: { x: 100, y: 0, z: 12 },
      bounds: { width: 140, height: 180, depth: 90 }
    };

    expect(bias).toEqual({ x: 0.5, y: -1 });
    expect(layer.worldToPlane(canopy.position)).toEqual({ x: 100.5, y: 191 });
    expect(layer.projectCollider3D(canopy)).toMatchObject({
      x: 30.5,
      y: 146,
      minX: 30.5,
      maxX: 170.5,
      minY: 146,
      maxY: 236
    });

    const guides = layer.createDebugGuides({ models: [canopy] });
    expect(guides.coordinateBias).toEqual({ x: 0.5, y: -1 });
    expect(guides.modelDepthRanges[0]).toMatchObject({
      baselineY: 191,
      minY: 146,
      maxY: 236
    });
  });

  it('projects cinematic 2.5D models with depth scaling, parallax, lod, shadow, and depth bands', () => {
    const layer = new Dimension3D.PlaneLayer({
      zToYScale: 10,
      perspective: {
        depthScale: 0.02,
        minScale: 0.5,
        maxScale: 1.25,
        parallax: { x: 0.1, y: 0.05 }
      },
      depthBands: [
        { name: 'background', maxY: 160, zIndex: 0 },
        { name: 'midground', minY: 160, maxY: 230, zIndex: 100 },
        { name: 'foreground', minY: 230, zIndex: 200 }
      ]
    });
    const tower = {
      id: 'tower',
      position: { x: 50, y: 0, z: 20 },
      bounds: { width: 100, height: 160, depth: 80 },
      shadow: { type: 'ellipse', opacity: 0.4, radiusX: 50, radiusY: 40 },
      lods: [
        { level: 'high', minScreenArea: 4000, mesh: 'tower-high.glb' },
        { level: 'mid', minScreenArea: 1000, mesh: 'tower-mid.glb' },
        { level: 'low', mesh: 'tower-low.glb' }
      ]
    };

    const projected = layer.projectModel2D(tower, {
      camera: { x: 10, y: -4 },
      viewport: { x: 0, y: 0, width: 240, height: 260 }
    });

    expect(projected).toMatchObject({
      id: 'tower',
      scale: 0.6,
      parallaxOffset: { x: -20, y: 4 },
      band: { name: 'midground', zIndex: 100 },
      lod: { level: 'mid', mesh: 'tower-mid.glb' },
      visible: true,
      screenArea: 2880
    });
    expect(projected.collider).toMatchObject({
      x: 0,
      y: 180,
      width: 60,
      height: 48,
      minX: 0,
      maxX: 60,
      minY: 180,
      maxY: 228
    });
    expect(projected.shadow).toMatchObject({
      radiusX: 30,
      radiusY: 24,
      opacity: 0.24
    });
  });

  it('composes a 2.5D render plan with culling, occlusion pairs, stable sorting, and diagnostics', () => {
    const layer = new Dimension3D.PlaneLayer({
      zToYScale: 8,
      perspective: { depthScale: 0.01, minScale: 0.7 },
      depthBands: [
        { name: 'back', maxY: 120, zIndex: 0 },
        { name: 'playfield', minY: 120, maxY: 220, zIndex: 100 },
        { name: 'front', minY: 220, zIndex: 200 }
      ]
    });
    const hero = { id: 'hero', x: 94, y: 148, width: 28, height: 42 };
    const nearTree = {
      id: 'near-tree',
      position: { x: 110, y: 0, z: 18 },
      bounds: { width: 90, height: 150, depth: 80 },
      lods: [{ level: 'high', minScreenArea: 6000 }, { level: 'mid', minScreenArea: 1500 }, { level: 'low' }]
    };
    const farTree = {
      id: 'far-tree',
      position: { x: 520, y: 0, z: 12 },
      bounds: { width: 90, height: 150, depth: 80 },
      lods: [{ level: 'high', minScreenArea: 6000 }, { level: 'mid', minScreenArea: 1500 }, { level: 'low' }]
    };

    const plan = layer.composeScene2D({
      sprites: [hero],
      models: [nearTree, farTree],
      viewport: { x: 0, y: 0, width: 260, height: 260 },
      camera: { x: 0, y: 0 }
    });

    expect(plan.diagnostics).toMatchObject({
      modelCount: 2,
      spriteCount: 1,
      visibleModels: 1,
      culledModels: 1,
      occlusionPairs: 1
    });
    expect(plan.modelProjections.find((item) => item.id === 'near-tree')).toMatchObject({
      visible: true,
      lod: { level: 'mid' },
      band: { name: 'playfield' }
    });
    expect(plan.modelProjections.find((item) => item.id === 'far-tree')).toMatchObject({
      visible: false,
      cullReason: 'outside-viewport'
    });
    expect(plan.occlusionPairs).toEqual([
      expect.objectContaining({ spriteId: 'hero', modelId: 'near-tree' })
    ]);
    expect(plan.renderQueue.map((item) => item.id)).toEqual(['near-tree', 'hero']);
    expect(plan.renderQueue[0]).toMatchObject({ kind: '3d', visible: true });
    expect(plan.renderQueue[1]).toMatchObject({ kind: '2d', visible: true });
  });

  it('exposes coordinate bias tuning on Dimension3D debug guide projection', () => {
    const dimension = new Dimension3D({ debug: true });
    const returned = dimension.setCoordinateBias(1, 2);

    expect(returned).toBe(dimension);
    expect(dimension.coordinateBias).toEqual({ x: 1, y: 2 });

    const guides = dimension.createDebugGuides({
      models: [{
        id: 'pillar',
        position: { x: 4, y: 0, z: 2 },
        bounds: { width: 2, height: 4, depth: 8 }
      }]
    });

    expect(guides.coordinateBias).toEqual({ x: 1, y: 2 });
    expect(guides.modelDepthRanges[0]).toMatchObject({
      baselineY: 4
    });
  });

  it('loads models asynchronously, marks fade-in state, and creates 2D shadow metadata', async () => {
    const dimension = await new Dimension3D({
      canvas: document.createElement('canvas'),
      debug: true
    }).init();

    const load = Dimension3D.loadModelAsync(dimension, {
      name: 'canopy',
      url: '/models/canopy.glb',
      position: { x: 10, y: 0, z: 6 },
      bounds: { width: 120, height: 160, depth: 80 },
      fadeInMs: 450,
      shadowGenerator: { opacity: 0.32 }
    });

    expect(dimension.pendingModelLoads).toHaveLength(1);
    expect(dimension.models).toHaveLength(0);

    await vi.waitFor(() => {
      expect(threeState.resolveLoad).toEqual(expect.any(Function));
    });
    threeState.resolveLoad();
    const model = await load;

    expect(threeState.loadedUrls).toEqual(['/models/canopy.glb']);
    expect(dimension.pendingModelLoads).toHaveLength(0);
    expect(model.root.userData.omnicoreAsyncLoaded).toBe(true);
    expect(model.root.userData.omnicoreFadeIn).toMatchObject({ durationMs: 450, opacity: 0 });
    expect(model.shadow).toMatchObject({
      type: 'ellipse',
      x: 10,
      y: 0,
      radiusX: 60,
      radiusY: 40,
      opacity: 0.32
    });
  });
});
