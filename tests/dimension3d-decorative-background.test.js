import { afterEach, describe, expect, it, vi } from 'vitest';
import Dimension3D from '../src/dimension3d/Dimension3D.js';

const threeState = vi.hoisted(() => ({
  loadedUrls: [],
  renderCalls: [],
  disposedMaterials: 0,
  disposedGeometries: 0,
  rendererDisposed: 0,
  mixerUpdates: [],
  playedClips: [],
  raycasterCalls: [],
  nextIntersectionObject: null,
  lastRenderer: null,
  gltfRoot: null,
  roots: new Map(),
  reset() {
    this.loadedUrls = [];
    this.renderCalls = [];
    this.disposedMaterials = 0;
    this.disposedGeometries = 0;
    this.rendererDisposed = 0;
    this.mixerUpdates = [];
    this.playedClips = [];
    this.raycasterCalls = [];
    this.nextIntersectionObject = null;
    this.lastRenderer = null;
    this.roots = new Map();
    this.gltfRoot = this.createRoot('/models/default.glb');
  },
  createRoot(url) {
    const child = {
      name: `${url.split('/').pop()}-child`,
      parent: null
    };
    const root = {
      name: url.split('/').pop(),
      position: { set: vi.fn() },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { set: vi.fn(), setScalar: vi.fn() },
      renderOrder: 0,
      child,
      traverse: vi.fn((visitor) => visitor({
        geometry: { dispose: vi.fn(() => { threeState.disposedGeometries += 1; }) },
        material: { dispose: vi.fn(() => { threeState.disposedMaterials += 1; }) }
      }))
    };
    child.parent = root;
    this.roots.set(url, root);
    return root;
  }
}));

threeState.reset();

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

    traverse(visitor) {
      this.children.forEach((child) => {
        if (typeof child.traverse === 'function') child.traverse(visitor);
        else visitor(child);
      });
    }
  }

  class PerspectiveCamera {
    constructor(fov, aspect, near, far) {
      this.fov = fov;
      this.aspect = aspect;
      this.near = near;
      this.far = far;
      this.position = { set: vi.fn(), z: 0 };
    }

    updateProjectionMatrix() {}
  }

  class WebGLRenderer {
    constructor(options) {
      this.options = options;
      this.domElement = options.canvas || document.createElement('canvas');
      this.setPixelRatio = vi.fn();
      this.setSize = vi.fn();
      this.render = vi.fn((scene, camera) => threeState.renderCalls.push({ scene, camera }));
      this.dispose = vi.fn(() => { threeState.rendererDisposed += 1; });
      threeState.lastRenderer = this;
    }
  }

  class AnimationMixer {
    constructor(root) {
      this.root = root;
    }

    clipAction(clip) {
      const action = {
        clip,
        reset: vi.fn(() => action),
        play: vi.fn(() => {
          threeState.playedClips.push(clip.name);
          return action;
        })
      };
      return action;
    }

    update(delta) {
      threeState.mixerUpdates.push({ root: this.root, delta });
    }
  }

  class Raycaster {
    setFromCamera(pointer, camera) {
      threeState.raycasterCalls.push({ pointer, camera });
    }

    intersectObjects(objects) {
      const object = threeState.nextIntersectionObject || objects[0];
      return object ? [{ object, point: { x: 0, y: 0, z: 0 } }] : [];
    }
  }

  class AmbientLight {
    constructor(color, intensity) {
      this.color = color;
      this.intensity = intensity;
    }
  }

  class DirectionalLight {
    constructor(color, intensity) {
      this.color = color;
      this.intensity = intensity;
      this.position = { set: vi.fn() };
    }
  }

  return {
    AmbientLight,
    AnimationMixer,
    DirectionalLight,
    PerspectiveCamera,
    Raycaster,
    Scene,
    WebGLRenderer
  };
});

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    async loadAsync(url) {
      threeState.loadedUrls.push(url);
      if (url.includes('empty')) return { animations: [] };
      const root = threeState.createRoot(url);
      threeState.gltfRoot = root;
      return {
        scene: root,
        animations: [{ name: 'Idle' }, { name: 'Jump' }]
      };
    }
  }
}));

describe('Dimension3D decorative background layer', () => {
  afterEach(() => {
    threeState.reset();
    document.body.innerHTML = '';
  });

  it('loads one static GLB background and rotates only the model root during render', async () => {
    const canvas = document.createElement('canvas');
    const dimension = new Dimension3D({
      canvas,
      width: 640,
      height: 360,
      decorativeModel: {
        url: '/models/cyberpunk-city.glb',
        position: { x: 0, y: -1, z: -8 },
        scale: 1.4,
        rotation: { y: 0.25 },
        rotationSpeed: { y: 0.5 }
      }
    });

    await dimension.init();
    dimension.render(2);

    expect(dimension.capabilities).toMatchObject({
      decorativeOnly: true,
      maxModels: Infinity
    });
    expect(dimension.capabilities.supports).toEqual(expect.arrayContaining([
      'multi-gltf-backgrounds',
      'preset-animation-playback',
      'raycaster-click-events'
    ]));
    expect(dimension.capabilities.unsupported).toEqual(expect.arrayContaining([
      '3d-collision',
      '3d-camera-control'
    ]));
    expect(threeState.loadedUrls).toEqual(['/models/cyberpunk-city.glb']);
    expect(threeState.gltfRoot.position.set).toHaveBeenCalledWith(0, -1, -8);
    expect(threeState.gltfRoot.scale.setScalar).toHaveBeenCalledWith(1.4);
    expect(threeState.gltfRoot.rotation.y).toBe(1.25);
    expect(threeState.renderCalls).toHaveLength(1);
    expect(canvas.style.pointerEvents).toBe('auto');
    expect(dimension.decorativeModel.gltf).toBeUndefined();
    expect(dimension.controls).toBeUndefined();
    expect(dimension.physicsWorld).toBeUndefined();

    dimension.destroy();

    expect(threeState.disposedGeometries).toBe(1);
    expect(threeState.disposedMaterials).toBe(1);
    expect(threeState.rendererDisposed).toBe(1);
  });

  it('rejects non-decorative 3D backends and feature options', () => {
    expect(() => new Dimension3D({ backend: 'babylon' })).toThrow(/仅支持 Three\.js/);
    expect(() => new Dimension3D({ controls: true })).toThrow(/纯装饰/);
    expect(() => new Dimension3D({
      decorativeModel: {
        url: '/models/city.glb',
        colliders: []
      }
    })).toThrow(/3D 碰撞/);
    expect(() => new Dimension3D({
      decorativeModel: {
        url: '/models/city.glb',
        cameraControls: true
      }
    })).toThrow(/3D 摄像机控制/);
  });

  it('only accepts glTF or GLB files for the decorative model', async () => {
    const dimension = new Dimension3D();
    await dimension.init();

    await expect(dimension.loadDecorativeModel({ url: '/models/city.fbx' })).rejects.toThrow(/\.gltf 或 \.glb/);
    await dimension.loadDecorativeModel({ url: '/models/city.gltf' });

    expect(threeState.loadedUrls).toEqual(['/models/city.gltf']);
  });

  it('loads multiple glTF models with rotation, preset animation playback, and click callbacks', async () => {
    const canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 640,
      height: 360
    });
    const dimension = new Dimension3D({ canvas, width: 640, height: 360 });

    await dimension.init();
    const city = await dimension.addModel('city', '/models/city.glb', { x: 0, y: 0, z: -4 }, 1.2);
    const hero = await dimension.addModel('hero', '/models/hero.gltf', { x: 1, y: 0, z: -3 }, { x: 1, y: 2, z: 1 });
    const onCityClick = vi.fn();

    city.on('click', onCityClick);
    hero.rotateY(0.5);
    const action = city.playAnimation('Jump');
    dimension.render(2);
    threeState.nextIntersectionObject = city.root;
    dimension.handlePointerEvent({ clientX: 320, clientY: 180, preventDefault: vi.fn() });

    expect(dimension.models).toHaveLength(2);
    expect(threeState.loadedUrls).toEqual(['/models/city.glb', '/models/hero.gltf']);
    expect(city).toMatchObject({
      name: 'city',
      glbPath: '/models/city.glb',
      animations: expect.arrayContaining(['Idle', 'Jump'])
    });
    expect(hero.root.scale.set).toHaveBeenCalledWith(1, 2, 1);
    expect(hero.root.rotation.y).toBe(1);
    expect(action.play).toHaveBeenCalled();
    expect(threeState.playedClips).toEqual(['Jump']);
    expect(threeState.mixerUpdates).toHaveLength(2);
    expect(threeState.raycasterCalls[0].pointer).toMatchObject({ x: 0, y: 0 });
    expect(onCityClick).toHaveBeenCalledWith(expect.objectContaining({
      model: city,
      intersection: expect.objectContaining({ object: city.root })
    }));
  });

  it('sorts loaded models for 2.5D masking and resolves raycast hits on child meshes', async () => {
    const canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 640,
      height: 360
    });
    const dimension = new Dimension3D({ canvas, width: 640, height: 360 });

    await dimension.init();
    const back = await dimension.addModel({ name: 'back', glbPath: '/models/back.glb', position: { x: 0, y: -1, z: -2 } });
    const front = await dimension.addModel({ name: 'front', glbPath: '/models/front.glb', position: { x: 0, y: 2, z: 1 } });
    const onFrontClick = vi.fn();

    front.on('click', onFrontClick);
    const sorted = dimension.sortModelsForMasking({ zToYScale: 1, startRenderOrder: 10 });
    threeState.nextIntersectionObject = front.root.child;
    dimension.handlePointerEvent({ clientX: 320, clientY: 180, preventDefault: vi.fn() });

    expect(sorted.map((model) => model.name)).toEqual(['back', 'front']);
    expect(back.root.renderOrder).toBe(10);
    expect(front.root.renderOrder).toBe(11);
    expect(front.root.userData.omnicoreMaskSortDepth).toBe(3);
    expect(onFrontClick).toHaveBeenCalledWith(expect.objectContaining({ model: front }));
  });

  it('keeps the previous decorative model when a replacement glTF has no renderable scene', async () => {
    const dimension = new Dimension3D();

    await dimension.init();
    const first = await dimension.loadDecorativeModel({ url: '/models/city.glb' });

    await expect(dimension.loadDecorativeModel({ url: '/models/empty.glb' })).rejects.toThrow(/没有可渲染场景/);

    expect(dimension.decorativeModel).toBe(first);
    expect(dimension.models).toEqual([first]);
    expect(threeState.disposedGeometries).toBe(0);
    expect(threeState.disposedMaterials).toBe(0);
  });

  it('guards model APIs, supports click unsubscribe, and cleans up every loaded model', async () => {
    const canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 640,
      height: 360
    });
    const dimension = new Dimension3D({ canvas, width: 640, height: 360 });

    await dimension.init();
    const city = await dimension.addModel('city', '/models/city.glb');
    const hero = await dimension.addModel('hero', '/models/hero.gltf');
    const onCityClick = vi.fn();
    const offClick = city.on('click', onCityClick);

    expect(() => city.playAnimation('Missing')).toThrow(/动画不存在/);
    await expect(dimension.addModel('bad', '/models/bad.fbx')).rejects.toThrow(/\.gltf 或 \.glb/);

    offClick();
    threeState.nextIntersectionObject = city.root;
    dimension.handlePointerEvent({ clientX: 320, clientY: 180, preventDefault: vi.fn() });

    expect(onCityClick).not.toHaveBeenCalled();
    expect(dimension.models).toEqual([city, hero]);

    dimension.destroy();

    expect(dimension.models).toHaveLength(0);
    expect(threeState.disposedGeometries).toBe(2);
    expect(threeState.disposedMaterials).toBe(2);
    expect(threeState.rendererDisposed).toBe(1);
  });
});
