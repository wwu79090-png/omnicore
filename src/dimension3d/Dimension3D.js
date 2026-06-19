import {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_DIMENSION3D_BACKEND
} from '../config/defaults.js';
import { createOmniError } from '../core/OmniError.js';

const MODEL_URL_PATTERN = /\.(gltf|glb)(?:$|[?#])/i;
const DEFAULT_MODEL_ROTATION_SPEED = Object.freeze({ x: 0, y: 0, z: 0 });
const DEFAULT_MODEL_TRANSFORM = Object.freeze({
  position: Object.freeze({ x: 0, y: 0, z: 0 }),
  rotation: Object.freeze({ x: 0, y: 0, z: 0 }),
  scale: 1
});
const DECORATIVE_CAPABILITIES = Object.freeze({
  decorativeOnly: true,
  maxModels: 1,
  supports: Object.freeze(['single-static-gltf-background']),
  unsupported: Object.freeze(['3d-animation', '3d-collision', '3d-camera-control'])
});
const UNSUPPORTED_3D_OPTIONS = Object.freeze({
  animation: '3D 动画',
  animations: '3D 动画',
  animationMixer: '3D 动画',
  mixer: '3D 动画',
  physics: '3D 碰撞',
  physicsWorld: '3D 碰撞',
  collision: '3D 碰撞',
  collisions: '3D 碰撞',
  collider: '3D 碰撞',
  colliders: '3D 碰撞',
  controls: '3D 摄像机控制',
  orbitControls: '3D 摄像机控制',
  cameraControls: '3D 摄像机控制',
  pointerLockControls: '3D 摄像机控制'
});

/**
 * Independent decorative 3D background layer for Three.js.
 *
 * This layer owns a separate canvas and lifecycle, but intentionally exposes
 * only a single static glTF/GLB model as a non-interactive visual background.
 * No 3D collisions, glTF animation playback, or camera controls are provided.
 *
 * @example
 * const dimension = new Dimension3D({
 *   canvas,
 *   decorativeModel: { url: '/models/cyberpunk-city.glb', rotationSpeed: { y: 0.2 } }
 * });
 * await dimension.init();
 * dimension.render(1 / 60);
 */
export class Dimension3D {
  constructor({
    backend = DEFAULT_DIMENSION3D_BACKEND,
    canvas,
    width = DEFAULT_CANVAS_WIDTH,
    height = DEFAULT_CANVAS_HEIGHT,
    parent = null,
    decorativeModel = null,
    backgroundModel = null,
    pixelRatio = null,
    ...options
  } = {}) {
    if (backend !== 'three') throw createOmniError('Dimension3D', '3D 背景层仅支持 Three.js。');
    assertDecorativeOnly(options);
    assertDecorativeOnly(decorativeModel);
    assertDecorativeOnly(backgroundModel);

    this.backend = backend;
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.parent = parent;
    this.pixelRatio = pixelRatio;
    this.engine = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.decorativeModelConfig = decorativeModel || backgroundModel;
    this.decorativeModel = null;
    this.gltfLoader = null;
    this.THREE = null;
    this.capabilities = {
      ...DECORATIVE_CAPABILITIES,
      supports: [...DECORATIVE_CAPABILITIES.supports],
      unsupported: [...DECORATIVE_CAPABILITIES.unsupported]
    };
  }

  async init() {
    return this._initThree();
  }

  async _initThree() {
    const THREE = await import('three');
    this.THREE = THREE;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000);
    this.camera.position.z = 5;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    const ratio = this.pixelRatio ?? globalThis.devicePixelRatio ?? 1;
    this.renderer.setPixelRatio?.(Math.min(ratio, 2));
    this.renderer.setSize(this.width, this.height, false);
    this.canvas = this.renderer.domElement || this.canvas;
    if (this.canvas?.style) this.canvas.style.pointerEvents = 'none';
    this.canvas?.setAttribute?.('aria-hidden', 'true');
    if (this.parent && this.canvas && !this.canvas.parentNode) this.parent.appendChild(this.canvas);
    this._addDefaultLights(THREE);
    if (this.decorativeModelConfig) await this.loadDecorativeModel(this.decorativeModelConfig);
    return this;
  }

  _addDefaultLights(THREE) {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
    keyLight.position.set(4, 6, 8);
    this.scene.add(keyLight);
  }

  async loadDecorativeModel(config = {}) {
    assertDecorativeOnly(config);
    if (!this.scene) throw createOmniError('Dimension3D', '请先调用 init() 再加载装饰模型。');
    if (!config.url || typeof config.url !== 'string') {
      throw createOmniError('Dimension3D', '装饰模型必须提供 url。');
    }
    if (!MODEL_URL_PATTERN.test(config.url)) {
      throw createOmniError('Dimension3D', '装饰模型仅支持 .gltf 或 .glb 文件。');
    }

    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    this.gltfLoader = this.gltfLoader || new GLTFLoader();
    const gltf = await this.gltfLoader.loadAsync(config.url);
    const root = gltf.scene || gltf.scenes?.[0];
    if (!root) throw createOmniError('Dimension3D', 'glTF/GLB 文件中没有可渲染场景。');

    this._removeDecorativeModel();
    applyModelTransform(root, config);
    this.scene.add(root);
    this.decorativeModel = {
      url: config.url,
      root,
      rotationSpeed: normalizeVector(config.rotationSpeed, DEFAULT_MODEL_ROTATION_SPEED)
    };
    delete this.decorativeModel.gltf;
    return this.decorativeModel;
  }

  render(deltaSeconds = 0) {
    this._rotateDecorativeModel(deltaSeconds);
    this.renderer?.render?.(this.scene, this.camera);
  }

  resize(width = this.width, height = this.height) {
    this.width = width;
    this.height = height;
    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix?.();
    }
    this.renderer?.setSize?.(width, height, false);
  }

  _rotateDecorativeModel(deltaSeconds) {
    if (!this.decorativeModel || typeof deltaSeconds !== 'number' || !Number.isFinite(deltaSeconds)) return;
    const { root, rotationSpeed } = this.decorativeModel;
    root.rotation.x += rotationSpeed.x * deltaSeconds;
    root.rotation.y += rotationSpeed.y * deltaSeconds;
    root.rotation.z += rotationSpeed.z * deltaSeconds;
  }

  destroy() {
    this._removeDecorativeModel();
    this.renderer?.dispose?.();
    this.engine = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.decorativeModel = null;
    this.gltfLoader = null;
    this.THREE = null;
  }

  _removeDecorativeModel() {
    if (!this.decorativeModel?.root) return;
    const { root } = this.decorativeModel;
    this.scene?.remove?.(root);
    disposeObject(root);
    this.decorativeModel = null;
  }
}

export class Dimension3DScene {
  constructor({
    canvas = null,
    parent = null,
    width = DEFAULT_CANVAS_WIDTH,
    height = DEFAULT_CANVAS_HEIGHT,
    pixelRatio = null,
    camera = {},
    controls = false,
    background = null
  } = {}) {
    this.canvas = canvas;
    this.parent = parent;
    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    this.cameraConfig = camera;
    this.controlsConfig = normalizeControlsConfig(controls);
    this.background = background;
    this.THREE = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.models = [];
    this.lights = [];
    this.skybox = null;
  }

  async init() {
    const THREE = await import('three');
    this.THREE = THREE;
    this.scene = new THREE.Scene();
    if (this.background !== null && this.background !== undefined && THREE.Color) {
      this.scene.background = new THREE.Color(this.background);
    }
    const fov = this.cameraConfig.fov || 60;
    const near = this.cameraConfig.near || 0.1;
    const far = this.cameraConfig.far || 1000;
    this.camera = new THREE.PerspectiveCamera(fov, this.width / this.height, near, far);
    const position = this.cameraConfig.position || { x: 0, y: 2, z: 5 };
    this.camera.position?.set?.(position.x ?? 0, position.y ?? 2, position.z ?? 5);
    if (!this.camera.position?.set) this.camera.position.z = position.z ?? 5;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    const ratio = this.pixelRatio ?? globalThis.devicePixelRatio ?? 1;
    this.renderer.setPixelRatio?.(Math.min(ratio, 2));
    this.renderer.setSize?.(this.width, this.height, false);
    this.canvas = this.renderer.domElement || this.canvas;
    if (this.parent && this.canvas && !this.canvas.parentNode) this.parent.appendChild(this.canvas);
    await this._setupControls();
    return this;
  }

  add(model, options = {}) {
    if (!model) return null;
    applyModelTransform(model, options);
    const rotationSpeed = normalizeVector(options.rotationSpeed || model.userData?.omnicoreRotationSpeed, DEFAULT_MODEL_ROTATION_SPEED);
    model.userData ||= {};
    model.userData.omnicoreRotationSpeed = rotationSpeed;
    this.scene?.add?.(model);
    if (!this.models.includes(model)) this.models.push(model);
    return model;
  }

  remove(model) {
    this.scene?.remove?.(model);
    this.models = this.models.filter((item) => item !== model);
    return model;
  }

  addModel(config = {}) {
    const model = {
      id: config.id || config.name || `model-${this.models.length + 1}`,
      type: 'Model',
      url: config.url || null,
      position: normalizeVector(config.position, DEFAULT_MODEL_TRANSFORM.position),
      rotation: normalizeVector(config.rotation, DEFAULT_MODEL_TRANSFORM.rotation),
      scale: config.scale ?? 1,
      bounds: normalizeBounds(config.bounds || config),
      rotationSpeed: normalizeVector(config.rotationSpeed, DEFAULT_MODEL_ROTATION_SPEED),
      highlighted: false,
      userData: { ...(config.userData || {}) }
    };
    model.userData.omnicoreRotationSpeed = model.rotationSpeed;
    this.models.push(model);
    return model;
  }

  addLight(type = 'ambient', config = {}) {
    if (this.THREE) return this.setLight(type, config);
    const light = {
      id: config.id || `light-${this.lights.length + 1}`,
      type: 'Light',
      lightType: type,
      color: config.color ?? 0xffffff,
      intensity: config.intensity ?? 1,
      position: normalizeVector(config.position, { x: 0, y: 2, z: 2 })
    };
    this.lights.push(light);
    return light;
  }

  setSkybox(config = {}) {
    this.skybox = {
      type: 'Skybox',
      texture: config.texture || config.url || null,
      color: config.color ?? null
    };
    if (this.scene && this.THREE && this.skybox.color != null && this.THREE.Color) {
      this.scene.background = new this.THREE.Color(this.skybox.color);
    }
    return this.skybox;
  }

  worldToScreen(point = {}) {
    const scale = this._coordScale();
    return {
      x: Number(((this.width / 2) + Number(point.x || 0) * scale).toFixed(6)),
      y: Number(((this.height / 2) - Number(point.y || 0) * scale).toFixed(6)),
      z: Number(point.z || 0)
    };
  }

  screenToWorld(point = {}) {
    const scale = this._coordScale();
    return {
      x: Number(((Number(point.x || 0) - this.width / 2) / scale).toFixed(6)),
      y: Number(((this.height / 2 - Number(point.y || 0)) / scale).toFixed(6)),
      z: Number(point.z || 0)
    };
  }

  '3DTo2DCoord'(point = {}) {
    return this.worldToScreen(point);
  }

  addCharacter2D(config = {}) {
    return new Character3D(config, this);
  }

  pickModelAt(point = {}) {
    const world = this.screenToWorld(point);
    const picked = this.models.find((model) => intersectsPoint(modelAabb(model), world)) || null;
    if (picked) this.highlightModel(picked);
    return picked;
  }

  raycastFromScreen(point = {}) {
    const normalized = this.normalizedPointer(point);
    if (this.THREE?.Raycaster && this.camera && this.scene) {
      const raycaster = new this.THREE.Raycaster();
      raycaster.setFromCamera?.(normalized, this.camera);
      const intersects = raycaster.intersectObjects?.(this.models, true) || [];
      const object = intersects[0]?.object || null;
      if (object) {
        this.highlightModel(object);
        return {
          hit: true,
          model: object,
          point: intersects[0]?.point || null,
          normalized
        };
      }
    }

    const model = this.pickModelAt(point);
    return {
      hit: Boolean(model),
      model,
      point: model ? this.screenToWorld(point) : null,
      normalized
    };
  }

  normalizedPointer(point = {}) {
    const x = Number(point.x ?? point.clientX ?? 0);
    const y = Number(point.y ?? point.clientY ?? 0);
    return {
      x: (x / this.width) * 2 - 1,
      y: -(y / this.height) * 2 + 1
    };
  }

  highlightModel(model, feedback = {}) {
    if (!model) return null;
    model.highlighted = feedback.highlighted ?? true;
    model.userData ||= {};
    model.userData.omnicoreHighlighted = model.highlighted;
    model.userData.omnicoreHighlightColor = feedback.color ?? model.userData.omnicoreHighlightColor ?? 0xfacc15;
    return model;
  }

  setLight(type = 'ambient', config = {}) {
    if (!this.THREE) throw createOmniError('Dimension3D', '请先调用 init() 再设置灯光。');
    const light = createLight(this.THREE, type, config);
    this.scene?.add?.(light);
    this.lights.push(light);
    return light;
  }

  createRotatingBox({
    size = 1,
    width = size,
    height = size,
    depth = size,
    color = 0x38bdf8,
    rotationSpeed = { y: 0.6 },
    material = {}
  } = {}) {
    if (!this.THREE) throw createOmniError('Dimension3D', '请先调用 init() 再创建 3D 模型。');
    const geometry = new this.THREE.BoxGeometry(width, height, depth);
    const meshMaterial = new this.THREE.MeshStandardMaterial({ color, ...material });
    const mesh = new this.THREE.Mesh(geometry, meshMaterial);
    mesh.userData ||= {};
    mesh.userData.omnicoreRotationSpeed = normalizeVector(rotationSpeed, DEFAULT_MODEL_ROTATION_SPEED);
    return mesh;
  }

  render(deltaSeconds = 0) {
    this._rotateModels(deltaSeconds);
    if (this.controls?.update) {
      if (this.controlsType === 'firstPerson') this.controls.update(deltaSeconds);
      else this.controls.update();
    }
    this.renderer?.render?.(this.scene, this.camera);
  }

  resize(width = this.width, height = this.height) {
    this.width = width;
    this.height = height;
    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix?.();
    }
    this.renderer?.setSize?.(width, height, false);
  }

  destroy() {
    this.controls?.dispose?.();
    for (const model of [...this.models]) {
      this.scene?.remove?.(model);
      disposeObject(model);
    }
    this.models.length = 0;
    this.lights.length = 0;
    this.renderer?.dispose?.();
    this.controls = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.THREE = null;
  }

  async _setupControls() {
    const config = normalizeControlsConfig(this.controlsConfig);
    this.controlsType = config.type;
    if (!config.type) return;
    if (config.type === 'orbit') {
      const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
      this.controls = new OrbitControls(this.camera, this.canvas);
      if (config.target) this.controls.target?.set?.(config.target.x ?? 0, config.target.y ?? 0, config.target.z ?? 0);
      this.controls.update?.();
      return;
    }
    if (config.type === 'firstPerson') {
      const { FirstPersonControls } = await import('three/addons/controls/FirstPersonControls.js');
      this.controls = new FirstPersonControls(this.camera, this.canvas);
      this.controls.movementSpeed = config.movementSpeed ?? 8;
      this.controls.lookSpeed = config.lookSpeed ?? 0.08;
    }
  }

  _rotateModels(deltaSeconds) {
    if (typeof deltaSeconds !== 'number' || !Number.isFinite(deltaSeconds)) return;
    for (const model of this.models) {
      const speed = normalizeVector(model.userData?.omnicoreRotationSpeed, DEFAULT_MODEL_ROTATION_SPEED);
      model.rotation ||= { x: 0, y: 0, z: 0 };
      model.rotation.x += speed.x * deltaSeconds;
      model.rotation.y += speed.y * deltaSeconds;
      model.rotation.z += speed.z * deltaSeconds;
    }
  }

  _coordScale() {
    return Math.max(1, Math.min(this.width, this.height) / 4);
  }
}

export class Character3D {
  constructor({ id = 'character', sprite = {}, depth = 0, scale = 1, height = null } = {}, scene = null) {
    this.id = id;
    this.type = 'Character3D';
    this.sprite = sprite;
    this.depth = depth;
    this.scale = scale;
    this.scene = scene;
    this.height = height;
    this.depthLayer = 0;
    this.position = { x: 0, y: 0, z: depth };
    this.aabb = modelAabb({ position: this.position, bounds: { width: 1, height: 1, depth: 1 } });
    this.updateFromSprite(sprite);
  }

  updateFromSprite(sprite = this.sprite, { depth = this.depth } = {}) {
    this.sprite = sprite;
    this.depth = depth;
    const center = this.scene.screenToWorld({
      x: (sprite.x || 0) + (sprite.width || 0) / 2,
      y: (sprite.y || 0) + (sprite.height || 0) / 2,
      z: depth
    });
    const width = Math.max(0.01, (sprite.width || 0) * this.scale);
    const boxHeight = Math.max(0.01, (this.height ?? sprite.height ?? 0) * this.scale);
    this.position = { x: center.x, y: center.y, z: depth };
    this.depthLayer = Math.max(0, Math.round((center.y + depth) * 1000));
    this.aabb = {
      minX: center.x - width / 2,
      maxX: center.x + width / 2,
      minY: center.y - boxHeight / 2,
      maxY: center.y + boxHeight / 2,
      minZ: depth - width / 2,
      maxZ: depth + width / 2
    };
    if (sprite && typeof sprite === 'object') sprite.zIndex = this.depthLayer;
    return this;
  }

  intersects(target) {
    return intersectsAabb(this.aabb, modelAabb(target));
  }
}

export class PlaneLayer {
  constructor({ zScale = 1, baseZ = 0 } = {}) {
    this.zScale = zScale;
    this.baseZ = baseZ;
    this.items = [];
  }

  add2D(object, options = {}) {
    return this._add('2d', object, options);
  }

  add3D(object, options = {}) {
    return this._add('3d', object, options);
  }

  update(object, options = {}) {
    const item = this.items.find((entry) => entry.object === object);
    if (!item) return null;
    Object.assign(item, normalizePlaneOptions(object, options, this));
    return item;
  }

  remove(object) {
    const item = this.items.find((entry) => entry.object === object) || null;
    this.items = this.items.filter((entry) => entry.object !== object);
    return item;
  }

  sorted() {
    return [...this.items].sort((left, right) => left.depth - right.depth);
  }

  applyZSort() {
    this.sorted().forEach((item, index) => {
      if (item.kind === '3d') item.object.renderOrder = index;
      else item.object.zIndex = index;
    });
    return this.sorted();
  }

  _add(kind, object, options) {
    const item = {
      kind,
      object,
      ...normalizePlaneOptions(object, options, this)
    };
    this.items.push(item);
    return item;
  }
}

function assertDecorativeOnly(options) {
  if (!options || typeof options !== 'object') return;
  const blockedKey = Object.keys(UNSUPPORTED_3D_OPTIONS).find((key) => optionEnabled(options[key]));
  if (!blockedKey) return;
  const feature = UNSUPPORTED_3D_OPTIONS[blockedKey];
  throw createOmniError('Dimension3D', `Dimension3D 是纯装饰 3D 背景层，不支持${feature}。`);
}

function optionEnabled(value) {
  return value !== undefined && value !== null && value !== false;
}

function normalizeVector(value = {}, fallback = {}) {
  return {
    x: Number.isFinite(value.x) ? value.x : fallback.x ?? 0,
    y: Number.isFinite(value.y) ? value.y : fallback.y ?? 0,
    z: Number.isFinite(value.z) ? value.z : fallback.z ?? 0
  };
}

function applyModelTransform(root, config) {
  const position = normalizeVector(config.position, DEFAULT_MODEL_TRANSFORM.position);
  const rotation = normalizeVector(config.rotation, DEFAULT_MODEL_TRANSFORM.rotation);
  root.position?.set?.(position.x, position.y, position.z);
  root.rotation.x = rotation.x;
  root.rotation.y = rotation.y;
  root.rotation.z = rotation.z;
  if (typeof config.scale === 'number') root.scale?.setScalar?.(config.scale);
  else if (config.scale && typeof config.scale === 'object') {
    const scale = normalizeVector(config.scale, { x: 1, y: 1, z: 1 });
    root.scale?.set?.(scale.x, scale.y, scale.z);
  } else {
    root.scale?.setScalar?.(DEFAULT_MODEL_TRANSFORM.scale);
  }
}

function disposeObject(root) {
  root.traverse?.((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
    else object.material?.dispose?.();
  });
}

function normalizeControlsConfig(controls) {
  if (!controls) return { type: null };
  if (controls === true) return { type: 'orbit' };
  if (typeof controls === 'string') return { type: controls };
  return { type: controls.type || controls.mode || 'orbit', ...controls };
}

function createLight(THREE, type, config = {}) {
  const color = config.color ?? 0xffffff;
  const intensity = config.intensity ?? 1;
  if (type === 'directional') {
    const light = new THREE.DirectionalLight(color, intensity);
    const position = config.position || { x: 4, y: 6, z: 8 };
    light.position?.set?.(position.x ?? 4, position.y ?? 6, position.z ?? 8);
    return light;
  }
  if (type === 'hemisphere') {
    return new THREE.HemisphereLight(color, config.groundColor ?? 0x202020, intensity);
  }
  if (type === 'point' && THREE.PointLight) {
    const light = new THREE.PointLight(color, intensity, config.distance ?? 0, config.decay ?? 2);
    const position = config.position || { x: 0, y: 2, z: 2 };
    light.position?.set?.(position.x ?? 0, position.y ?? 2, position.z ?? 2);
    return light;
  }
  return new THREE.AmbientLight(color, intensity);
}

function normalizePlaneOptions(object, options, layer) {
  const depth = Number.isFinite(Number(options.depth))
    ? Number(options.depth)
    : Number.isFinite(Number(options.z))
      ? Number(options.z)
      : Number.isFinite(Number(object?.zIndex))
        ? Number(object.zIndex)
        : Number(object?.position?.z ?? object?.y ?? 0);
  return {
    depth: layer.baseZ + depth * layer.zScale
  };
}

function normalizeBounds(bounds = {}) {
  return {
    width: Number(bounds.width ?? bounds.w ?? 1),
    height: Number(bounds.height ?? bounds.h ?? 1),
    depth: Number(bounds.depth ?? bounds.d ?? 1)
  };
}

function modelAabb(model = {}) {
  const position = normalizeVector(model.position, DEFAULT_MODEL_TRANSFORM.position);
  const bounds = normalizeBounds(model.bounds || model);
  return {
    minX: position.x - bounds.width / 2,
    maxX: position.x + bounds.width / 2,
    minY: position.y - bounds.height / 2,
    maxY: position.y + bounds.height / 2,
    minZ: position.z - bounds.depth / 2,
    maxZ: position.z + bounds.depth / 2
  };
}

function intersectsPoint(aabb, point = {}) {
  return point.x >= aabb.minX
    && point.x <= aabb.maxX
    && point.y >= aabb.minY
    && point.y <= aabb.maxY
    && Number(point.z || 0) >= aabb.minZ
    && Number(point.z || 0) <= aabb.maxZ;
}

function intersectsAabb(left, right) {
  return left.minX <= right.maxX
    && left.maxX >= right.minX
    && left.minY <= right.maxY
    && left.maxY >= right.minY
    && left.minZ <= right.maxZ
    && left.maxZ >= right.minZ;
}

Dimension3D.Scene = Dimension3DScene;
Dimension3D.PlaneLayer = PlaneLayer;
Dimension3D.Character3D = Character3D;

export default Dimension3D;
