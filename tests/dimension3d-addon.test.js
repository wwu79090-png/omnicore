import { afterEach, describe, expect, it, vi } from 'vitest';

const threeState = vi.hoisted(() => ({
  orbitUpdates: 0,
  firstPersonUpdates: [],
  renderCalls: [],
  reset() {
    this.orbitUpdates = 0;
    this.firstPersonUpdates = [];
    this.renderCalls = [];
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
    constructor(options = {}) {
      this.domElement = options.canvas || document.createElement('canvas');
      this.setPixelRatio = vi.fn();
      this.setSize = vi.fn();
      this.render = vi.fn((scene, camera) => threeState.renderCalls.push({ scene, camera }));
      this.dispose = vi.fn();
    }
  }

  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = { x: 0, y: 0, z: 0, set: vi.fn((x, y, z) => Object.assign(this.position, { x, y, z })) };
      this.rotation = { x: 0, y: 0, z: 0 };
      this.scale = { x: 1, y: 1, z: 1, setScalar: vi.fn((value) => Object.assign(this.scale, { x: value, y: value, z: value })) };
      this.userData = {};
    }
  }

  class BoxGeometry {
    constructor(width, height, depth) {
      this.width = width;
      this.height = height;
      this.depth = depth;
    }
  }

  class MeshStandardMaterial {
    constructor(config) {
      this.config = config;
    }
  }

  class AmbientLight {
    constructor(color, intensity) {
      this.type = 'AmbientLight';
      this.color = color;
      this.intensity = intensity;
    }
  }

  class DirectionalLight {
    constructor(color, intensity) {
      this.type = 'DirectionalLight';
      this.color = color;
      this.intensity = intensity;
      this.position = { set: vi.fn() };
    }
  }

  class HemisphereLight {
    constructor(skyColor, groundColor, intensity) {
      this.type = 'HemisphereLight';
      this.skyColor = skyColor;
      this.groundColor = groundColor;
      this.intensity = intensity;
    }
  }

  class Color {
    constructor(value) {
      this.value = value;
    }
  }

  return {
    AmbientLight,
    BoxGeometry,
    Color,
    DirectionalLight,
    HemisphereLight,
    Mesh,
    MeshStandardMaterial,
    PerspectiveCamera,
    Scene,
    WebGLRenderer
  };
});

vi.mock('three/addons/controls/OrbitControls.js', () => ({
  OrbitControls: class {
    constructor(camera, domElement) {
      this.camera = camera;
      this.domElement = domElement;
      this.target = { set: vi.fn() };
    }

    update() {
      threeState.orbitUpdates += 1;
    }

    dispose() {}
  }
}));

vi.mock('three/addons/controls/FirstPersonControls.js', () => ({
  FirstPersonControls: class {
    constructor(camera, domElement) {
      this.camera = camera;
      this.domElement = domElement;
      this.lookSpeed = 0;
      this.movementSpeed = 0;
    }

    update(delta) {
      threeState.firstPersonUpdates.push(delta);
    }

    dispose() {}
  }
}));

const { default: OmniCore, Dimension3D } = await import('../src/index.js');

describe('Dimension3D addon scene API', () => {
  afterEach(() => {
    threeState.reset();
    document.body.innerHTML = '';
  });

  it('exposes OmniCore.Dimension3D.Scene with add/remove/setLight and orbit controls', async () => {
    const canvas = document.createElement('canvas');
    const scene3D = await new Dimension3D.Scene({
      canvas,
      width: 800,
      height: 450,
      controls: 'orbit'
    }).init();

    const cube = scene3D.createRotatingBox({ color: 0x38bdf8, rotationSpeed: { y: 1 } });
    scene3D.add(cube);
    scene3D.setLight('directional', { color: 0xffffff, intensity: 2, position: { x: 1, y: 2, z: 3 } });
    scene3D.render(0.5);
    scene3D.remove(cube);

    expect(OmniCore.Dimension3D.Scene).toBe(Dimension3D.Scene);
    expect(scene3D.models).not.toContain(cube);
    expect(cube.rotation.y).toBe(0.5);
    expect(threeState.orbitUpdates).toBeGreaterThan(0);
    expect(threeState.renderCalls).toHaveLength(1);
    expect(scene3D.lights[0]).toMatchObject({ type: 'DirectionalLight', intensity: 2 });
  });

  it('switches to first person controls with simple config', async () => {
    const scene3D = await new Dimension3D.Scene({
      controls: { type: 'firstPerson', movementSpeed: 12, lookSpeed: 0.08 }
    }).init();

    scene3D.render(0.25);

    expect(scene3D.controls.movementSpeed).toBe(12);
    expect(scene3D.controls.lookSpeed).toBe(0.08);
    expect(threeState.firstPersonUpdates).toEqual([0.25]);
  });

  it('sorts 2D sprites and 3D models through PlaneLayer for 2.5D occlusion', () => {
    const hero = { id: 'hero', zIndex: 0 };
    const wall = { id: 'wall', renderOrder: 0 };
    const layer = new Dimension3D.PlaneLayer({ zScale: 1 });

    layer.add2D(hero, { depth: 10 });
    layer.add3D(wall, { depth: 20 });
    layer.applyZSort();

    expect(hero.zIndex).toBeLessThan(wall.renderOrder);

    layer.update(hero, { depth: 30 });
    layer.applyZSort();

    expect(hero.zIndex).toBeGreaterThan(wall.renderOrder);
    expect(layer.sorted().map((item) => item.object.id)).toEqual(['wall', 'hero']);
  });
});
