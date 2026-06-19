import { afterEach, describe, expect, it, vi } from 'vitest';
import Dimension3D from '../src/dimension3d/Dimension3D.js';

const threeState = vi.hoisted(() => ({
  loadedUrls: [],
  renderCalls: [],
  disposedMaterials: 0,
  disposedGeometries: 0,
  rendererDisposed: 0,
  lastRenderer: null,
  gltfRoot: null,
  reset() {
    this.loadedUrls = [];
    this.renderCalls = [];
    this.disposedMaterials = 0;
    this.disposedGeometries = 0;
    this.rendererDisposed = 0;
    this.lastRenderer = null;
    this.gltfRoot = {
      position: { set: vi.fn() },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { setScalar: vi.fn() },
      traverse: vi.fn((visitor) => visitor({
        geometry: { dispose: vi.fn(() => { threeState.disposedGeometries += 1; }) },
        material: { dispose: vi.fn(() => { threeState.disposedMaterials += 1; }) }
      }))
    };
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
    DirectionalLight,
    PerspectiveCamera,
    Scene,
    WebGLRenderer
  };
});

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    async loadAsync(url) {
      threeState.loadedUrls.push(url);
      return {
        scene: threeState.gltfRoot,
        animations: [{ name: 'ignored-idle' }]
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
      maxModels: 1
    });
    expect(dimension.capabilities.supports).toEqual(['single-static-gltf-background']);
    expect(dimension.capabilities.unsupported).toEqual(expect.arrayContaining([
      '3d-animation',
      '3d-collision',
      '3d-camera-control'
    ]));
    expect(threeState.loadedUrls).toEqual(['/models/cyberpunk-city.glb']);
    expect(threeState.gltfRoot.position.set).toHaveBeenCalledWith(0, -1, -8);
    expect(threeState.gltfRoot.scale.setScalar).toHaveBeenCalledWith(1.4);
    expect(threeState.gltfRoot.rotation.y).toBe(1.25);
    expect(threeState.renderCalls).toHaveLength(1);
    expect(canvas.style.pointerEvents).toBe('none');
    expect(dimension.decorativeModel.gltf).toBeUndefined();
    expect(dimension.controls).toBeUndefined();
    expect(dimension.animationMixer).toBeUndefined();
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
        animations: true
      }
    })).toThrow(/3D 动画/);
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
});
