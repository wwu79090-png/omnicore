import {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_DIMENSION3D_BACKEND
} from '../config/defaults.js';
import { createOmniError } from '../core/OmniError.js';

const MODEL_URL_PATTERN = /\.(gltf|glb)(?:$|[?#])/i;
const DEFAULT_MODEL_ROTATION_SPEED = Object.freeze({ x: 0, y: 0, z: 0 });
const DECORATIVE_RENDER_FPS = 30;
const MODEL_COMPLEXITY_WARNING = '[OmniCore] 2.5D 模型复杂度过高，建议优化。';
const MODEL_COMPLEXITY_LIMITS = Object.freeze({
  triangles: 20000,
  textureSize: 2048
});
const DEFAULT_INSTANCE_CAPACITY = 1024;
const DEFAULT_MODEL_TRANSFORM = Object.freeze({
  position: Object.freeze({ x: 0, y: 0, z: 0 }),
  rotation: Object.freeze({ x: 0, y: 0, z: 0 }),
  scale: 1
});
const DECORATIVE_CAPABILITIES = Object.freeze({
  decorativeOnly: true,
  maxModels: Infinity,
  renderFps: DECORATIVE_RENDER_FPS,
  complexityWarning: MODEL_COMPLEXITY_WARNING,
  complexityLimits: MODEL_COMPLEXITY_LIMITS,
  instanceCapacity: DEFAULT_INSTANCE_CAPACITY,
  supports: Object.freeze([
    'multi-gltf-backgrounds',
    'basic-mask-sorting',
    'preset-animation-playback',
    'raycaster-click-events',
    'manual-depth-map',
    'debug-depth-guides',
    'async-model-loading',
    'ground-shadow-metadata',
    '30fps-decorative-loop',
    'model-complexity-budget',
    'instanced-static-models',
    'aabb-occlusion-candidates',
    'cinematic-25d-projection',
    'depth-band-render-plan',
    'lod-aware-2d-composition',
    'parallax-depth-scaling'
  ]),
  unsupported: Object.freeze(['3d-collision', '3d-camera-control', 'free-3d-camera-control'])
});
const UNSUPPORTED_3D_OPTIONS = Object.freeze({
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

function getOptionalThreeExport(THREE, name) {
  if (!THREE) return null;
  if (Object.prototype.hasOwnProperty.call(THREE, name)) return THREE[name] || null;
  try {
    if (Object.prototype.hasOwnProperty.call(THREE, 'default')) return THREE.default?.[name] || null;
    return null;
  } catch (error) {
    if (/No ".+" export/.test(String(error?.message || ''))) return null;
    throw error;
  }
}

/**
 * Independent decorative 3D background layer for Three.js.
 *
 * This layer owns a separate canvas and lifecycle, but intentionally exposes
 * decorative glTF/GLB models, preset animation playback, simple rotation, and
 * raycast click events for bridging back into 2D gameplay. No 3D collisions,
 * physics world, or free 3D camera controls are provided.
 *
 * @example
 * const dimension = new Dimension3D({
 *   canvas,
 *   decorativeModel: { url: '/models/cyberpunk-city.glb', rotationSpeed: { y: 0.2 } }
 * });
 * await dimension.init();
 * const hero = await dimension.addModel('hero', '/models/hero.glb');
 * hero.playAnimation('Idle');
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
    debug = false,
    shadowGenerator = true,
    coordinateBias = null,
    targetFps = DECORATIVE_RENDER_FPS,
    heightMap = null,
    terrain = null,
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
    this.debug = Boolean(debug);
    this.shadowGenerator = shadowGenerator;
    this.coordinateBias = normalizeCoordinateBias(coordinateBias);
    this.heightMap = normalizeHeightMap(heightMap || terrain?.heightMap || terrain || null);
    this.engine = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.decorativeModelConfig = decorativeModel || backgroundModel;
    this.decorativeModel = null;
    this.models = [];
    this.pendingModelLoads = [];
    this.modelRoots = new WeakMap();
    this.instanceGroups = new Map();
    this.gameTime = null;
    this.particleSystems = [];
    this.raycaster = null;
    this.gltfLoader = null;
    this.THREE = null;
    this.renderTargetFps = Math.max(1, Number(targetFps) || DECORATIVE_RENDER_FPS);
    this.renderLoopRunning = false;
    this.renderLoopFrame = null;
    this.renderLoopLastTimestamp = null;
    this.renderLoopAccumulatorMs = 0;
    this.renderLoopRequestFrame = null;
    this.renderLoopCancelFrame = null;
    this.handlePointerEvent = this.handlePointerEvent.bind(this);
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
    const Raycaster = getOptionalThreeExport(THREE, 'Raycaster');
    this.raycaster = Raycaster ? new Raycaster() : null;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    const ratio = this.pixelRatio ?? globalThis.devicePixelRatio ?? 1;
    this.renderer.setPixelRatio?.(Math.min(ratio, 2));
    this.renderer.setSize(this.width, this.height, false);
    this.canvas = this.renderer.domElement || this.canvas;
    if (this.canvas?.style) this.canvas.style.pointerEvents = 'auto';
    this.canvas?.setAttribute?.('aria-label', 'OmniCore 2.5D decorative model layer');
    this.canvas?.addEventListener?.('click', this.handlePointerEvent);
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
    const previousModel = this.decorativeModel;
    const model = await this.addModel(
      config.name || 'decorative',
      config.url,
      config.position,
      config.scale,
      config
    );
    if (previousModel && previousModel !== model) this._removeModel(previousModel);
    this.decorativeModel = model;
    return model;
  }

  static loadModelAsync(dimension, config = {}) {
    if (!dimension || typeof dimension.loadModelAsync !== 'function') {
      throw createOmniError('Dimension3D', 'Dimension3D.loadModelAsync 需要传入已初始化的 Dimension3D 实例。');
    }
    return dimension.loadModelAsync(config);
  }

  loadModelAsync(config = {}) {
    const request = {
      url: config.url || config.glbPath || config.path,
      status: 'loading',
      startedAt: Date.now()
    };
    const promise = this.addModel(config)
      .then((model) => {
        model.root.userData ||= {};
        model.root.userData.omnicoreAsyncLoaded = true;
        installFadeInState(model, config.fadeInMs ?? config.fadeMs ?? 300);
        request.status = 'loaded';
        request.model = model;
        return model;
      })
      .catch((error) => {
        request.status = 'failed';
        request.error = error;
        throw error;
      })
      .finally(() => {
        this.pendingModelLoads = this.pendingModelLoads.filter((item) => item !== request);
      });
    request.promise = promise;
    this.pendingModelLoads.push(request);
    return promise;
  }

  async addModel(name, glbPath, position, scale, options = {}) {
    const config = normalizeAddModelConfig(name, glbPath, position, scale, options);
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

    const modelPosition = normalizeVector(config.position, DEFAULT_MODEL_TRANSFORM.position);
    const modelRotation = normalizeVector(config.rotation, DEFAULT_MODEL_TRANSFORM.rotation);
    const modelBounds = normalizeBounds(config.bounds || config);
    const depthMap = normalizeDepthMap(config.depthMap);
    applyModelTransform(root, config);
    const complexity = inspectModelComplexity(root, config.url);
    warnIfModelOverBudget(complexity);
    const clips = Array.isArray(gltf.animations) ? gltf.animations.filter(Boolean) : [];
    const AnimationMixer = getOptionalThreeExport(this.THREE, 'AnimationMixer');
    const mixer = AnimationMixer ? new AnimationMixer(root) : null;
    const handlers = new Map();
    const model = {
      name: config.name,
      glbPath: config.url,
      url: config.url,
      root,
      position: modelPosition,
      rotation: modelRotation,
      scale: config.scale ?? DEFAULT_MODEL_TRANSFORM.scale,
      bounds: modelBounds,
      depthMap,
      complexity,
      mixer,
      clips,
      actions: new Map(),
      animations: clips.map((clip) => clip.name).filter(Boolean),
      currentAnimation: null,
      rotationSpeed: normalizeVector(config.rotationSpeed, DEFAULT_MODEL_ROTATION_SPEED),
      userData: { ...(config.userData || {}) },
      playAnimation(animationName) {
        const clip = clips.find((item) => item?.name === animationName);
        if (!clip) {
          throw createOmniError('Dimension3D', `动画不存在：${animationName}`);
        }
        if (!mixer?.clipAction) return null;
        const action = this.actions.get(animationName) || mixer.clipAction(clip);
        this.actions.set(animationName, action);
        action.reset?.();
        action.play?.();
        this.currentAnimation = animationName;
        return action;
      },
      rotateY(speed) {
        this.rotationSpeed.y = Number.isFinite(Number(speed)) ? Number(speed) : 0;
        root.userData ||= {};
        root.userData.omnicoreRotationSpeed = this.rotationSpeed;
        return this;
      },
      setMaskSortDepth(depth) {
        const value = Number(depth);
        if (!Number.isFinite(value)) throw createOmniError('Dimension3D', '遮罩排序深度必须是数字。');
        this.maskSortDepth = value;
        root.renderOrder = value;
        root.userData ||= {};
        root.userData.omnicoreMaskSortDepth = value;
        return this;
      },
      on(eventName, callback) {
        if (typeof callback !== 'function') {
          throw createOmniError('Dimension3D', '模型事件回调必须是函数。');
        }
        if (!handlers.has(eventName)) handlers.set(eventName, new Set());
        handlers.get(eventName).add(callback);
        return () => this.off(eventName, callback);
      },
      off(eventName, callback) {
        handlers.get(eventName)?.delete(callback);
        return this;
      },
      emit(eventName, payload) {
        for (const callback of handlers.get(eventName) || []) callback(payload);
        return this;
      }
    };

    root.userData ||= {};
    root.userData.omnicoreDimension3DModel = model;
    root.userData.omnicoreRotationSpeed = model.rotationSpeed;
    if (depthMap) root.userData.omnicoreDepthMap = depthMap;
    model.shadow = createModelShadow(model, config.shadowGenerator ?? this.shadowGenerator);
    const instanceGroup = this._registerInstancedModel(model, config);
    if (!instanceGroup) this.scene.add(root);
    this.models.push(model);
    this.modelRoots.set(root, model);
    if (!this.decorativeModel) this.decorativeModel = model;
    delete model.gltf;
    return model;
  }

  createDebugGuides({ layer = null, sprites = [], models = this.models } = {}) {
    if (!this.debug) {
      return {
        enabled: false,
        modelDepthRanges: [],
        spriteProjectionLines: []
      };
    }
    const guideLayer = layer || new PlaneLayer({ debug: true, coordinateBias: this.coordinateBias });
    return guideLayer.createDebugGuides({ sprites, models });
  }

  syncViewport2D({ camera = null, viewport = {}, layers = [] } = {}) {
    const viewTransform = camera?.getViewTransform?.() || camera || {};
    const sync = {
      protocol: 'omnicore-25d-viewport-sync/v1',
      viewport: {
        width: Math.max(0, Number(viewport.width || 0)),
        height: Math.max(0, Number(viewport.height || 0))
      },
      camera: {
        x: Number(viewTransform.x || camera?.x || 0),
        y: Number(viewTransform.y || camera?.y || 0),
        zoom: Number(viewTransform.zoom || camera?.zoomLevel || 1)
      },
      layers: (Array.isArray(layers) ? layers : []).map((layer, index) => ({
        id: layer.id || layer.name || `layer-${index}`,
        x: Number(layer.x || 0),
        y: Number(layer.y || 0),
        factorX: Number(layer.factorX ?? 1),
        factorY: Number(layer.factorY ?? layer.factorX ?? 1),
        offsetX: Number(layer.offsetX || 0),
        offsetY: Number(layer.offsetY || 0)
      }))
    };
    this.viewport2DSync = sync;
    return sync;
  }

  setCoordinateBias(x = 0, y = 0) {
    this.coordinateBias = normalizeCoordinateBias({ x, y });
    return this;
  }

  bindGameTime(time = null) {
    this.gameTime = time;
    return this;
  }

  registerParticleSystem(system) {
    if (system && !this.particleSystems.includes(system)) this.particleSystems.push(system);
    return system;
  }

  startRenderLoop({
    fps = this.renderTargetFps,
    requestAnimationFrame: requestFrame = globalThis.requestAnimationFrame,
    cancelAnimationFrame: cancelFrame = globalThis.cancelAnimationFrame
  } = {}) {
    if (this.renderLoopRunning) return this;
    const frameRequest = typeof requestFrame === 'function'
      ? requestFrame
      : (callback) => setTimeout(() => callback(Date.now()), 16);
    const frameCancel = typeof cancelFrame === 'function'
      ? cancelFrame
      : (id) => clearTimeout(id);
    this.renderTargetFps = Math.max(1, Number(fps) || DECORATIVE_RENDER_FPS);
    this.renderLoopRequestFrame = frameRequest;
    this.renderLoopCancelFrame = frameCancel;
    this.renderLoopRunning = true;
    this.renderLoopLastTimestamp = null;
    this.renderLoopAccumulatorMs = 0;
    const intervalMs = 1000 / this.renderTargetFps;
    const tick = (timestamp = Date.now()) => {
      if (!this.renderLoopRunning) return;
      if (this.renderLoopLastTimestamp === null) {
        this.renderLoopLastTimestamp = timestamp;
      } else {
        const deltaMs = Math.max(0, Number(timestamp) - this.renderLoopLastTimestamp);
        this.renderLoopLastTimestamp = timestamp;
        this.renderLoopAccumulatorMs += deltaMs;
        if (this.renderLoopAccumulatorMs >= intervalMs) {
          const renderDeltaMs = this.renderLoopAccumulatorMs;
          this.renderLoopAccumulatorMs %= intervalMs;
          this.render(renderDeltaMs / 1000);
        }
      }
      this.renderLoopFrame = frameRequest(tick);
    };
    this.renderLoopFrame = frameRequest(tick);
    return this;
  }

  stopRenderLoop() {
    if (this.renderLoopFrame !== null) this.renderLoopCancelFrame?.(this.renderLoopFrame);
    this.renderLoopRunning = false;
    this.renderLoopFrame = null;
    this.renderLoopLastTimestamp = null;
    this.renderLoopAccumulatorMs = 0;
    return this;
  }

  render(deltaSeconds = undefined) {
    const delta = this._resolveDelta(deltaSeconds);
    this._updateModels(delta);
    this._updateParticles(delta);
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

  handlePointerEvent(event = {}) {
    if (!this.raycaster || !this.camera || !this.models.length) return null;
    event.preventDefault?.();
    const pointer = this.normalizedPointer(event);
    this.raycaster.setFromCamera?.(pointer, this.camera);
    const roots = this.models.map((model) => model.root).filter(Boolean);
    const intersections = this.raycaster.intersectObjects?.(roots, true) || [];
    const intersection = intersections[0] || null;
    const model = this._modelFromIntersectedObject(intersection?.object);
    if (!model) return null;
    model.emit('click', {
      model,
      event,
      intersection,
      pointer
    });
    return model;
  }

  normalizedPointer(point = {}) {
    const rect = this.canvas?.getBoundingClientRect?.();
    const width = rect?.width || this.width || DEFAULT_CANVAS_WIDTH;
    const height = rect?.height || this.height || DEFAULT_CANVAS_HEIGHT;
    const left = rect?.left || 0;
    const top = rect?.top || 0;
    const x = Number(point.x ?? point.clientX ?? 0) - left;
    const y = Number(point.y ?? point.clientY ?? 0) - top;
    return {
      x: (x / width) * 2 - 1,
      y: -(y / height) * 2 + 1
    };
  }

  sortModelsForMasking({ zToYScale = 1, startRenderOrder = 0 } = {}) {
    const scale = Number.isFinite(Number(zToYScale)) ? Number(zToYScale) : 1;
    const start = Number.isFinite(Number(startRenderOrder)) ? Number(startRenderOrder) : 0;
    const sorted = [...this.models].sort((left, right) => modelMaskSortDepth(left, scale) - modelMaskSortDepth(right, scale));
    sorted.forEach((model, index) => {
      const depth = modelMaskSortDepth(model, scale);
      model.maskSortDepth = depth;
      model.maskSortIndex = index;
      model.root.renderOrder = start + index;
      model.root.userData ||= {};
      model.root.userData.omnicoreMaskSortDepth = depth;
      model.root.userData.omnicoreMaskSortIndex = index;
    });
    return sorted;
  }

  _updateModels(deltaSeconds) {
    if (typeof deltaSeconds !== 'number' || !Number.isFinite(deltaSeconds)) return;
    for (const model of this.models) {
      const { root, rotationSpeed } = model;
      root.rotation.x += rotationSpeed.x * deltaSeconds;
      root.rotation.y += rotationSpeed.y * deltaSeconds;
      root.rotation.z += rotationSpeed.z * deltaSeconds;
      model.mixer?.update?.(deltaSeconds);
    }
  }

  _updateParticles(deltaSeconds) {
    if (typeof deltaSeconds !== 'number' || !Number.isFinite(deltaSeconds)) return;
    const systems = [
      ...this.particleSystems,
      ...this.models.map((model) => model.particles || model.particleSystem).filter(Boolean)
    ];
    for (const system of systems) system.update?.(deltaSeconds);
  }

  _resolveDelta(deltaSeconds) {
    if (Number.isFinite(Number(deltaSeconds))) return Number(deltaSeconds);
    const value = this.gameTime?.delta ?? this.gameTime?.deltaSeconds ?? 0;
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  setHeightMap(heightMap = null) {
    this.heightMap = normalizeHeightMap(heightMap);
    return this;
  }

  getHeightAt(x = 0, y = 0) {
    const sampled = sampleHeightMap(this.heightMap, x, y);
    if (Number.isFinite(sampled)) return roundProjectionNumber(sampled);
    const modelHeight = sampleModelHeightAt(this.models, x, y);
    return roundProjectionNumber(modelHeight ?? 0);
  }

  destroy() {
    this.stopRenderLoop();
    this.canvas?.removeEventListener?.('click', this.handlePointerEvent);
    for (const model of [...this.models]) this._removeModel(model);
    this.models.length = 0;
    this.pendingModelLoads.length = 0;
    this.modelRoots = new WeakMap();
    this.instanceGroups.clear();
    this.renderer?.dispose?.();
    this.engine = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.decorativeModel = null;
    this.raycaster = null;
    this.gltfLoader = null;
    this.THREE = null;
  }

  _removeDecorativeModel() {
    if (!this.decorativeModel) return;
    this._removeModel(this.decorativeModel);
    this.decorativeModel = null;
  }

  _removeModel(model) {
    if (!model?.root) return;
    this.scene?.remove?.(model.root);
    this._removeFromInstanceGroup(model);
    model.mixer?.stopAllAction?.();
    disposeObject(model.root);
    this.modelRoots.delete?.(model.root);
    if (model.root.userData) {
      delete model.root.userData.omnicoreDimension3DModel;
      delete model.root.userData.omnicoreRotationSpeed;
    }
    model.actions?.clear?.();
    this.models = this.models.filter((item) => item !== model);
    if (this.decorativeModel === model) this.decorativeModel = null;
  }

  _registerInstancedModel(model, config = {}) {
    const InstancedMesh = getOptionalThreeExport(this.THREE, 'InstancedMesh');
    if (!InstancedMesh || config.instanced === false) return null;
    const sourceMesh = findInstanceableMesh(model.root);
    if (!sourceMesh?.geometry || !sourceMesh?.material || model.animations?.length) return null;
    const key = model.glbPath;
    if (!key) return null;
    let group = this.instanceGroups.get(key);
    if (!group) {
      group = {
        key,
        sourceMesh,
        capacity: Math.max(1, Number(config.instanceCapacity || DEFAULT_INSTANCE_CAPACITY)),
        models: [],
        instancedMesh: null
      };
      this.instanceGroups.set(key, group);
    }
    group.models.push(model);
    model.instanceGroup = group;
    if (group.models.length === 1) return null;
    if (!group.instancedMesh) {
      group.instancedMesh = new InstancedMesh(sourceMesh.geometry, sourceMesh.material, Math.max(group.capacity, group.models.length));
      group.instancedMesh.name = `OmniCoreInstanced:${key}`;
      group.instancedMesh.userData ||= {};
      group.instancedMesh.userData.omnicoreInstanceGroup = key;
      this.scene?.remove?.(group.models[0].root);
      this.scene?.add?.(group.instancedMesh);
    }
    updateInstanceGroupMatrices(group);
    return group;
  }

  _removeFromInstanceGroup(model) {
    const group = model?.instanceGroup;
    if (!group) return;
    group.models = group.models.filter((item) => item !== model);
    updateInstanceGroupMatrices(group);
    if (!group.models.length) {
      this.scene?.remove?.(group.instancedMesh);
      this.instanceGroups.delete(group.key);
    }
    model.instanceGroup = null;
  }

  _modelFromIntersectedObject(object) {
    let current = object;
    while (current) {
      const model = this.modelRoots.get(current);
      if (model) return model;
      current = current.parent;
    }
    return this.models.find((model) => model.root === object) || null;
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
    background = null,
    coordinateBias = null
  } = {}) {
    this.canvas = canvas;
    this.parent = parent;
    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    this.cameraConfig = camera;
    this.controlsConfig = normalizeControlsConfig(controls);
    this.background = background;
    this.coordinateBias = normalizeCoordinateBias(coordinateBias);
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

  setCoordinateBias(x = 0, y = 0) {
    this.coordinateBias = normalizeCoordinateBias({ x, y });
    return this;
  }

  worldToScreen(point = {}) {
    const scale = this._coordScale();
    return {
      x: Number(((this.width / 2) + Number(point.x || 0) * scale + this.coordinateBias.x).toFixed(6)),
      y: Number(((this.height / 2) - Number(point.y || 0) * scale + this.coordinateBias.y).toFixed(6)),
      z: Number(point.z || 0)
    };
  }

  screenToWorld(point = {}) {
    const scale = this._coordScale();
    return {
      x: Number(((Number(point.x || 0) - this.width / 2 - this.coordinateBias.x) / scale).toFixed(6)),
      y: Number(((this.height / 2 - (Number(point.y || 0) - this.coordinateBias.y)) / scale).toFixed(6)),
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
    const Raycaster = getOptionalThreeExport(this.THREE, 'Raycaster');
    if (Raycaster && this.camera && this.scene) {
      const raycaster = new Raycaster();
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

  syncViewport2D({ camera = null, viewport = {}, layers = [] } = {}) {
    const cameraTransform = camera?.getViewTransform?.() || camera || {};
    const payload = {
      protocol: 'omnicore-25d-viewport-sync/v1',
      backend: this.backend,
      viewport: {
        width: Number(viewport.width ?? this.width),
        height: Number(viewport.height ?? this.height)
      },
      camera: {
        x: Number(cameraTransform.x || 0),
        y: Number(cameraTransform.y || 0),
        offsetX: Number(cameraTransform.offsetX || 0),
        offsetY: Number(cameraTransform.offsetY || 0),
        zoom: Number(cameraTransform.zoom || cameraTransform.zoomLevel || 1),
        rotation: Number(cameraTransform.rotation || 0)
      },
      layers: Array.isArray(layers)
        ? layers.map((layer) => ({
          id: layer.id,
          x: Number(layer.x || 0),
          y: Number(layer.y || 0),
          factorX: Number(layer.factorX ?? 1),
          factorY: Number(layer.factorY ?? layer.factorX ?? 1)
        }))
        : []
    };
    this.lastViewportSync = payload;
    if (this.camera && typeof this.camera.updateProjectionMatrix === 'function') {
      this.camera.aspect = payload.viewport.width / Math.max(1, payload.viewport.height);
      this.camera.updateProjectionMatrix();
    }
    this.renderer?.setSize?.(payload.viewport.width, payload.viewport.height, false);
    return payload;
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
  constructor({
    zScale = 1,
    baseZ = 0,
    zToYScale = 1,
    baseY = 0,
    debug = false,
    coordinateBias = null,
    perspective = null,
    depthBands = [],
    lodPolicy = null
  } = {}) {
    this.zScale = zScale;
    this.baseZ = baseZ;
    this.zToYScale = zToYScale;
    this.baseY = baseY;
    this.debug = Boolean(debug);
    this.coordinateBias = normalizeCoordinateBias(coordinateBias);
    this.perspective = normalizePerspectiveConfig(perspective);
    this.depthBands = normalizeDepthBands(depthBands);
    this.lodPolicy = normalizeLodPolicy(lodPolicy);
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
      item.object.zIndex = index;
      item.object.omnicorePlaneDepth = item.depth;
      if (item.kind === '3d') item.object.renderOrder = index;
    });
    return this.sorted();
  }

  setCoordinateBias(x = 0, y = 0) {
    this.coordinateBias = normalizeCoordinateBias({ x, y });
    return this.coordinateBias;
  }

  worldToPlane(position = {}) {
    const point = normalizeVector(position, DEFAULT_MODEL_TRANSFORM.position);
    return {
      x: point.x + this.coordinateBias.x,
      y: this.baseY + point.y + point.z * this.zToYScale + this.coordinateBias.y
    };
  }

  scaleAtDepth(depth = 0) {
    const depthValue = Number.isFinite(Number(depth)) ? Number(depth) : 0;
    const rawScale = 1 - depthValue * this.perspective.depthScale;
    return roundProjectionNumber(clampNumber(
      rawScale,
      this.perspective.minScale,
      this.perspective.maxScale
    ));
  }

  parallaxOffset(depth = 0, camera = {}) {
    const depthValue = Number.isFinite(Number(depth)) ? Number(depth) : 0;
    const cameraX = Number.isFinite(Number(camera?.x)) ? Number(camera.x) : 0;
    const cameraY = Number.isFinite(Number(camera?.y)) ? Number(camera.y) : 0;
    return {
      x: roundProjectionNumber(-cameraX * depthValue * this.perspective.parallax.x),
      y: roundProjectionNumber(-cameraY * depthValue * this.perspective.parallax.y)
    };
  }

  resolveDepthBand(y = 0) {
    const targetY = Number.isFinite(Number(y)) ? Number(y) : 0;
    const match = this.depthBands.find((band) => targetY >= band.minY && targetY < band.maxY);
    return match ? { ...match } : createDefaultDepthBand();
  }

  projectModel2D(model = {}, { camera = {}, viewport = null, lodPolicy = null } = {}) {
    const depthMap = normalizeDepthMap(model.depthMap);
    const depth = readModelDepth(model);
    const basePlane = this.worldToPlane(model.position || model);
    const baselineY = Number.isFinite(Number(depthMap?.baselineY))
      ? Number(depthMap.baselineY)
      : basePlane.y;
    const scale = this.scaleAtDepth(depth);
    const parallaxOffset = this.parallaxOffset(depth, camera);
    const center = {
      x: roundProjectionNumber(basePlane.x + parallaxOffset.x),
      y: roundProjectionNumber(baselineY + parallaxOffset.y)
    };
    const bounds = normalizeBounds(model.bounds || model);
    const width = roundProjectionNumber(bounds.width * scale);
    const footprintHeight = roundProjectionNumber((bounds.depth || bounds.height) * scale);
    const manualCollider = depthMap?.collider ? normalizeDepthMapCollider(depthMap.collider) : null;
    const collider = manualCollider
      ? roundProjectedRect(manualCollider)
      : roundProjectedRect({
        x: center.x - width / 2,
        y: center.y - footprintHeight / 2,
        width,
        height: footprintHeight
      });
    const visible = viewport ? this.collidesProjected2D(viewport, collider) : true;
    const screenArea = roundProjectionNumber(collider.width * collider.height);
    const band = this.resolveDepthBand(center.y);
    const policy = lodPolicy || this.lodPolicy;
    const lod = selectModelLod(model, { screenArea, depth, scale, policy });
    const shadow = scaleProjectedShadow(model.shadow, scale);
    const projection = {
      id: model.id || model.name || 'model',
      kind: '3d',
      depth,
      transparent: isTransparentModel(model),
      opacity: readModelOpacity(model),
      position: {
        x: roundProjectionNumber(basePlane.x),
        y: roundProjectionNumber(basePlane.y)
      },
      center,
      scale,
      parallaxOffset,
      band,
      lod,
      visible,
      screenArea,
      collider,
      shadow,
      sortDepth: roundProjectionNumber((band.zIndex || 0) + center.y)
    };
    if (!visible) projection.cullReason = 'outside-viewport';

    if (model && typeof model === 'object') {
      model.omnicore25DProjection = projection;
      model.omnicoreProjectedAabb = collider;
      model.omnicoreDepthBand = band.name;
      model.omnicoreLodLevel = lod?.level || null;
      model.omnicoreOcclusionSkipped = !visible;
    }
    return projection;
  }

  projectSprite2D(sprite = {}, { viewport = null } = {}) {
    const rect = roundProjectedRect(sprite);
    const foot = {
      x: roundProjectionNumber(rect.x + rect.width / 2),
      y: roundProjectionNumber(rect.y + rect.height)
    };
    const band = this.resolveDepthBand(foot.y);
    const visible = viewport ? this.collidesProjected2D(rect, roundProjectedRect(viewport)) : true;
    const projection = {
      id: sprite.id || sprite.name || 'sprite',
      kind: '2d',
      rect,
      foot,
      band,
      visible,
      billboard: Boolean(sprite.billboard || sprite.omnicoreBillboard),
      sortDepth: roundProjectionNumber((band.zIndex || 0) + foot.y)
    };
    if (!visible) projection.cullReason = 'outside-viewport';
    return projection;
  }

  composeScene2D({
    sprites = null,
    models = null,
    viewport = null,
    camera = {},
    lodPolicy = null
  } = {}) {
    const modelSource = Array.isArray(models)
      ? models
      : this.items.filter((item) => item.kind === '3d').map((item) => item.object);
    const spriteSource = Array.isArray(sprites)
      ? sprites
      : this.items.filter((item) => item.kind === '2d').map((item) => item.object);
    const modelProjections = modelSource.map((model, sourceIndex) => ({
      ...this.projectModel2D(model, { camera, viewport, lodPolicy }),
      model,
      sourceIndex
    }));
    const spriteProjections = spriteSource.map((sprite, sourceIndex) => ({
      ...this.projectSprite2D(sprite, { viewport }),
      sprite,
      sourceIndex
    }));
    const visibleModels = modelProjections.filter((item) => item.visible);
    const visibleSprites = spriteProjections.filter((item) => item.visible);
    const visibleTransparentModels = visibleModels.filter((item) => item.transparent);
    const visibleOpaqueModels = visibleModels.filter((item) => !item.transparent);
    const occlusionPairs = [];
    visibleSprites.forEach((spriteProjection) => {
      visibleModels.forEach((modelProjection) => {
        if (!this.collidesProjected2D(spriteProjection.rect, modelProjection.collider)) return;
        occlusionPairs.push({
          spriteId: spriteProjection.id,
          modelId: modelProjection.id,
          sprite: spriteProjection.sprite,
          model: modelProjection.model,
          projected: modelProjection.collider
        });
      });
    });
    const opaqueRenderQueue = [
      ...visibleOpaqueModels.map((projection) => ({
        id: projection.id,
        kind: '3d',
        visible: projection.visible,
        model: projection.model,
        projection,
        band: projection.band,
        lod: projection.lod,
        renderPass: 'opaque',
        depthWrite: true,
        sortDepth: projection.sortDepth,
        sourceIndex: projection.sourceIndex
      })),
      ...visibleSprites.map((projection) => ({
        id: projection.id,
        kind: '2d',
        visible: projection.visible,
        sprite: projection.sprite,
        projection,
        band: projection.band,
        billboard: Boolean(projection.billboard),
        sortDepth: projection.sortDepth,
        sourceIndex: projection.sourceIndex
      }))
    ].sort(compareRenderQueueItem);
    const transparentRenderQueue = visibleTransparentModels.map((projection) => ({
      id: projection.id,
      kind: '3d',
      visible: projection.visible,
      model: projection.model,
      projection,
      band: projection.band,
      lod: projection.lod,
      opacity: projection.opacity,
      renderPass: 'transparent',
      depthWrite: false,
      sortDepth: projection.sortDepth,
      sourceIndex: projection.sourceIndex
    })).sort(compareTransparentRenderQueueItem);
    const renderQueue = [...opaqueRenderQueue, ...transparentRenderQueue];

    return {
      modelProjections,
      spriteProjections,
      occlusionPairs,
      opaqueRenderQueue,
      transparentRenderQueue,
      renderQueue,
      diagnostics: {
        modelCount: modelSource.length,
        spriteCount: spriteSource.length,
        visibleModels: visibleModels.length,
        culledModels: modelSource.length - visibleModels.length,
        transparentModels: visibleTransparentModels.length,
        opaqueModels: visibleOpaqueModels.length,
        visibleSprites: visibleSprites.length,
        culledSprites: spriteSource.length - visibleSprites.length,
        occlusionPairs: occlusionPairs.length,
        renderQueue: renderQueue.length
      }
    };
  }

  projectCollider3D(model = {}) {
    const depthMap = normalizeDepthMap(model.depthMap);
    if (depthMap?.collider) return normalizeDepthMapCollider(depthMap.collider);
    const position = {
      ...this.worldToPlane(model.position || model),
      ...(Number.isFinite(Number(depthMap?.baselineY)) ? { y: Number(depthMap.baselineY) } : {})
    };
    const bounds = normalizeBounds(model.bounds || model);
    const footprintHeight = bounds.depth || bounds.height;
    return {
      x: position.x - bounds.width / 2,
      y: position.y - footprintHeight / 2,
      width: bounds.width,
      height: footprintHeight,
      minX: position.x - bounds.width / 2,
      maxX: position.x + bounds.width / 2,
      minY: position.y - footprintHeight / 2,
      maxY: position.y + footprintHeight / 2
    };
  }

  projectColliders3D(models = null) {
    const source = Array.isArray(models)
      ? models
      : this.items.filter((item) => item.kind === '3d').map((item) => item.object);
    return source.map((model) => ({
      model,
      collider: this.projectCollider3D(model)
    }));
  }

  collides2D(rect = {}, model = {}) {
    const projected = this.projectCollider3D(model);
    return this.collidesProjected2D(rect, projected);
  }

  collidesProjected2D(rect = {}, projected = {}) {
    const left = Number(rect.x ?? rect.left ?? 0);
    const top = Number(rect.y ?? rect.top ?? 0);
    const width = Number(rect.width ?? rect.w ?? 1);
    const height = Number(rect.height ?? rect.h ?? 1);
    const right = left + width;
    const bottom = top + height;
    return left < projected.maxX
      && right > projected.minX
      && top < projected.maxY
      && bottom > projected.minY;
  }

  occlusionCandidates2D(rect = {}, models = null) {
    const source = Array.isArray(models)
      ? models
      : this.items.filter((item) => item.kind === '3d').map((item) => item.object);
    return source.reduce((candidates, model) => {
      const projected = this.projectCollider3D(model);
      model.omnicoreProjectedAabb = projected;
      const overlaps = this.collidesProjected2D(rect, projected);
      model.omnicoreOcclusionSkipped = !overlaps;
      if (overlaps) candidates.push({ model, projected });
      return candidates;
    }, []);
  }

  createDebugGuides({ sprites = [], models = null } = {}) {
    const modelSource = Array.isArray(models)
      ? models
      : this.items.filter((item) => item.kind === '3d').map((item) => item.object);
    const spriteSource = Array.isArray(sprites) && sprites.length
      ? sprites
      : this.items.filter((item) => item.kind === '2d').map((item) => item.object);
    const modelDepthRanges = modelSource.map((model) => {
      const depthMap = normalizeDepthMap(model.depthMap);
      const collider = this.projectCollider3D(model);
      const baselineY = Number.isFinite(Number(depthMap?.baselineY))
        ? Number(depthMap.baselineY)
        : this.worldToPlane(model.position || model).y;
      return {
        id: model.id || model.name || 'model',
        x: collider.x,
        width: collider.width,
        baselineY,
        minY: Number.isFinite(Number(depthMap?.range?.minY)) ? Number(depthMap.range.minY) : collider.minY,
        maxY: Number.isFinite(Number(depthMap?.range?.maxY)) ? Number(depthMap.range.maxY) : collider.maxY,
        color: depthMap?.color || 'rgba(34, 211, 238, 0.55)'
      };
    });
    const targetY = modelDepthRanges[0]?.baselineY ?? 0;
    const spriteProjectionLines = spriteSource.map((sprite) => {
      const width = Number(sprite.width ?? sprite.w ?? 0);
      const height = Number(sprite.height ?? sprite.h ?? 0);
      const foot = {
        x: Number(sprite.x ?? sprite.left ?? 0) + width / 2,
        y: Number(sprite.y ?? sprite.top ?? 0) + height
      };
      return {
        id: sprite.id || sprite.name || 'sprite',
        from: foot,
        to: { x: foot.x, y: targetY },
        color: 'rgba(250, 204, 21, 0.7)'
      };
    });
    return {
      enabled: this.debug,
      coordinateBias: { ...this.coordinateBias },
      depthBands: this.depthBands.map((band) => ({ ...band })),
      modelDepthRanges,
      spriteProjectionLines
    };
  }

  _add(kind, object, options) {
    const item = {
      kind,
      object,
      ...normalizePlaneOptions(object, options, this)
    };
    if (item.depthMap && object && typeof object === 'object') object.depthMap = item.depthMap;
    this.items.push(item);
    return item;
  }
}

function inspectModelComplexity(root, url = null) {
  const complexity = {
    url,
    triangles: 0,
    maxTextureSize: 0,
    overBudget: false
  };

  traverseModel(root, (object) => {
    const geometry = object?.geometry;
    if (geometry) complexity.triangles += geometryTriangleCount(geometry);
    for (const material of normalizeMaterials(object?.material)) {
      complexity.maxTextureSize = Math.max(
        complexity.maxTextureSize,
        inspectMaterialTextureSize(material)
      );
    }
  });

  complexity.overBudget = complexity.triangles > MODEL_COMPLEXITY_LIMITS.triangles
    || complexity.maxTextureSize > MODEL_COMPLEXITY_LIMITS.textureSize;
  return complexity;
}

function warnIfModelOverBudget(complexity = {}) {
  if (!complexity.overBudget) return;
  console.warn(MODEL_COMPLEXITY_WARNING, {
    url: complexity.url,
    triangles: complexity.triangles,
    maxTextureSize: complexity.maxTextureSize,
    limits: MODEL_COMPLEXITY_LIMITS
  });
}

function traverseModel(root, visitor) {
  if (!root || typeof visitor !== 'function') return;
  if (typeof root.traverse === 'function') {
    root.traverse(visitor);
    return;
  }
  visitor(root);
  for (const child of root.children || []) traverseModel(child, visitor);
}

function geometryTriangleCount(geometry = {}) {
  const indexCount = Number(geometry.index?.count);
  if (Number.isFinite(indexCount) && indexCount > 0) return Math.ceil(indexCount / 3);
  const positionCount = Number(geometry.attributes?.position?.count);
  return Number.isFinite(positionCount) && positionCount > 0 ? Math.ceil(positionCount / 3) : 0;
}

function normalizeMaterials(material) {
  if (!material) return [];
  return Array.isArray(material) ? material.filter(Boolean) : [material];
}

function inspectMaterialTextureSize(material = {}) {
  const textureFields = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'];
  return textureFields.reduce((maxSize, field) => {
    const image = material[field]?.image;
    const width = Number(image?.width || 0);
    const height = Number(image?.height || 0);
    return Math.max(maxSize, width, height);
  }, 0);
}

function findInstanceableMesh(root) {
  let mesh = null;
  root?.traverse?.((object) => {
    if (!mesh && object?.geometry && object?.material) mesh = object;
  });
  return mesh;
}

function updateInstanceGroupMatrices(group) {
  if (!group?.instancedMesh) return;
  group.instancedMesh.count = group.models.length;
  group.models.forEach((model, index) => {
    model.root?.updateMatrix?.();
    group.instancedMesh.setMatrixAt?.(index, model.root?.matrix || { model: model.name || model.glbPath });
  });
  if (group.instancedMesh.instanceMatrix) group.instancedMesh.instanceMatrix.needsUpdate = true;
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

function normalizeAddModelConfig(name, glbPath, position, scale, options = {}) {
  if (name && typeof name === 'object') {
    return {
      ...name,
      url: name.glbPath || name.url || name.path
    };
  }
  return {
    ...options,
    name: name || options.name || `model-${Date.now().toString(36)}`,
    url: glbPath || options.glbPath || options.url || options.path,
    position: position ?? options.position ?? DEFAULT_MODEL_TRANSFORM.position,
    scale: scale ?? options.scale ?? DEFAULT_MODEL_TRANSFORM.scale
  };
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

function modelMaskSortDepth(model, zToYScale = 1) {
  if (Number.isFinite(model.maskSortDepth)) return model.maskSortDepth;
  const position = normalizeVector(model.position, DEFAULT_MODEL_TRANSFORM.position);
  return position.y + position.z * zToYScale;
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

function installFadeInState(model, durationMs = 300) {
  const duration = Math.max(0, Number(durationMs) || 0);
  model.fadeIn = {
    durationMs: duration,
    opacity: 0,
    startedAt: Date.now()
  };
  model.root.userData ||= {};
  model.root.userData.omnicoreFadeIn = {
    durationMs: duration,
    opacity: 0
  };
  return model.fadeIn;
}

function createModelShadow(model, config = true) {
  if (!config) return null;
  const options = config === true ? {} : config;
  const bounds = normalizeBounds(model.bounds || {});
  const position = normalizeVector(model.position, DEFAULT_MODEL_TRANSFORM.position);
  return {
    type: 'ellipse',
    x: position.x,
    y: position.y,
    radiusX: Math.max(0.5, bounds.width / 2),
    radiusY: Math.max(0.5, bounds.depth / 2),
    color: options.color || 'rgba(0, 0, 0, 0.35)',
    opacity: Number.isFinite(Number(options.opacity)) ? Number(options.opacity) : 0.28
  };
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

function normalizeCoordinateBias(value = null) {
  if (Array.isArray(value)) {
    return {
      x: Number.isFinite(Number(value[0])) ? Number(value[0]) : 0,
      y: Number.isFinite(Number(value[1])) ? Number(value[1]) : 0
    };
  }
  if (!value || typeof value !== 'object') return { x: 0, y: 0 };
  return {
    x: Number.isFinite(Number(value.x)) ? Number(value.x) : 0,
    y: Number.isFinite(Number(value.y)) ? Number(value.y) : 0
  };
}

function normalizePlaneOptions(object, options, layer) {
  const depthMap = normalizeDepthMap(options.depthMap || object?.depthMap);
  let depth = Number(object?.zIndex ?? 0);
  if (Number.isFinite(Number(object?.y))) depth = Number(object.y);
  if (object?.position && Number.isFinite(Number(object.position.z))) depth = layer.worldToPlane(object.position).y;
  if (Number.isFinite(Number(depthMap?.baselineY))) depth = Number(depthMap.baselineY);
  if (Number.isFinite(Number(options.z))) depth = Number(options.z);
  if (Number.isFinite(Number(options.depth))) depth = Number(options.depth);
  return {
    depth: layer.baseZ + depth * layer.zScale,
    depthMap
  };
}

function normalizeDepthMap(value = null) {
  if (!value || typeof value !== 'object') return null;
  const output = { ...value };
  if (Number.isFinite(Number(value.baselineY))) output.baselineY = Number(value.baselineY);
  if (value.range && typeof value.range === 'object') {
    output.range = {
      minY: Number.isFinite(Number(value.range.minY)) ? Number(value.range.minY) : undefined,
      maxY: Number.isFinite(Number(value.range.maxY)) ? Number(value.range.maxY) : undefined
    };
  }
  if (value.collider) output.collider = normalizeDepthMapCollider(value.collider);
  return output;
}

function normalizeDepthMapCollider(collider = {}) {
  const x = Number(collider.x ?? collider.left ?? collider.minX ?? 0);
  const y = Number(collider.y ?? collider.top ?? collider.minY ?? 0);
  const width = Number(collider.width ?? collider.w ?? ((collider.maxX ?? x) - x) ?? 1);
  const height = Number(collider.height ?? collider.h ?? ((collider.maxY ?? y) - y) ?? 1);
  return {
    x,
    y,
    width,
    height,
    minX: Number(collider.minX ?? x),
    maxX: Number(collider.maxX ?? x + width),
    minY: Number(collider.minY ?? y),
    maxY: Number(collider.maxY ?? y + height)
  };
}

function normalizeBounds(bounds = {}) {
  return {
    width: Number(bounds.width ?? bounds.w ?? 1),
    height: Number(bounds.height ?? bounds.h ?? 1),
    depth: Number(bounds.depth ?? bounds.d ?? 1)
  };
}

function normalizePerspectiveConfig(value = null) {
  const source = value && typeof value === 'object' ? value : {};
  const minScale = Number.isFinite(Number(source.minScale)) ? Number(source.minScale) : 0;
  const maxScale = Number.isFinite(Number(source.maxScale)) ? Number(source.maxScale) : Infinity;
  const parallax = source.parallax && typeof source.parallax === 'object' ? source.parallax : {};
  return {
    depthScale: Number.isFinite(Number(source.depthScale)) ? Number(source.depthScale) : 0,
    minScale: Math.min(minScale, maxScale),
    maxScale: Math.max(minScale, maxScale),
    parallax: {
      x: Number.isFinite(Number(parallax.x)) ? Number(parallax.x) : 0,
      y: Number.isFinite(Number(parallax.y)) ? Number(parallax.y) : 0
    }
  };
}

function normalizeDepthBands(depthBands = []) {
  if (!Array.isArray(depthBands)) return [];
  return depthBands.map((band, index) => {
    const source = band && typeof band === 'object' ? band : {};
    const minY = Number.isFinite(Number(source.minY)) ? Number(source.minY) : -Infinity;
    const maxY = Number.isFinite(Number(source.maxY)) ? Number(source.maxY) : Infinity;
    return {
      name: source.name || `band-${index}`,
      minY: Math.min(minY, maxY),
      maxY: Math.max(minY, maxY),
      zIndex: Number.isFinite(Number(source.zIndex)) ? Number(source.zIndex) : index
    };
  });
}

function normalizeLodPolicy(value = null) {
  if (!value || typeof value !== 'object') return {};
  return {
    forceLevel: value.forceLevel || value.level || null,
    screenAreaScale: Number.isFinite(Number(value.screenAreaScale))
      ? Number(value.screenAreaScale)
      : 1
  };
}

function createDefaultDepthBand() {
  return {
    name: 'default',
    minY: -Infinity,
    maxY: Infinity,
    zIndex: 0
  };
}

function readModelDepth(model = {}) {
  if (Number.isFinite(Number(model?.position?.z))) return Number(model.position.z);
  if (Number.isFinite(Number(model?.z))) return Number(model.z);
  if (Number.isFinite(Number(model?.depth))) return Number(model.depth);
  return 0;
}

function selectModelLod(model = {}, { screenArea = 0, depth = 0, scale = 1, policy = {} } = {}) {
  const lods = Array.isArray(model.lods)
    ? model.lods
    : Array.isArray(model.lod)
      ? model.lod
      : [];
  if (!lods.length) return null;
  const normalizedPolicy = normalizeLodPolicy(policy);
  const forcedLevel = normalizedPolicy.forceLevel || model.lodLevel || null;
  if (forcedLevel) {
    const forced = lods.find((lod) => lod?.level === forcedLevel);
    if (forced) return { ...forced };
  }
  const areaScale = normalizedPolicy.screenAreaScale || 1;
  const targetArea = Number.isFinite(Number(screenArea)) ? Number(screenArea) : 0;
  const targetDepth = Number.isFinite(Number(depth)) ? Number(depth) : 0;
  const targetScale = Number.isFinite(Number(scale)) ? Number(scale) : 1;
  const match = lods.find((lod) => {
    const minScreenArea = Number.isFinite(Number(lod?.minScreenArea))
      ? Number(lod.minScreenArea) * areaScale
      : -Infinity;
    const maxScreenArea = Number.isFinite(Number(lod?.maxScreenArea))
      ? Number(lod.maxScreenArea) * areaScale
      : Infinity;
    const minDepth = Number.isFinite(Number(lod?.minDepth)) ? Number(lod.minDepth) : -Infinity;
    const maxDepth = Number.isFinite(Number(lod?.maxDepth)) ? Number(lod.maxDepth) : Infinity;
    const minScale = Number.isFinite(Number(lod?.minScale)) ? Number(lod.minScale) : -Infinity;
    const maxScale = Number.isFinite(Number(lod?.maxScale)) ? Number(lod.maxScale) : Infinity;
    return targetArea >= minScreenArea
      && targetArea <= maxScreenArea
      && targetDepth >= minDepth
      && targetDepth <= maxDepth
      && targetScale >= minScale
      && targetScale <= maxScale;
  });
  return match ? { ...match } : { ...lods[lods.length - 1] };
}

function scaleProjectedShadow(shadow = null, scale = 1) {
  if (!shadow || typeof shadow !== 'object') return null;
  const output = { ...shadow, scale };
  [
    'radiusX',
    'radiusY',
    'width',
    'height',
    'blur',
    'offsetX',
    'offsetY'
  ].forEach((key) => {
    if (Number.isFinite(Number(output[key]))) {
      output[key] = roundProjectionNumber(Number(output[key]) * scale);
    }
  });
  if (Number.isFinite(Number(output.opacity))) {
    output.opacity = roundProjectionNumber(clampNumber(Number(output.opacity) * scale, 0, 1));
  }
  return output;
}

function roundProjectedRect(rect = {}) {
  const projected = normalizeDepthMapCollider(rect);
  return {
    x: roundProjectionNumber(projected.x),
    y: roundProjectionNumber(projected.y),
    width: roundProjectionNumber(projected.width),
    height: roundProjectionNumber(projected.height),
    minX: roundProjectionNumber(projected.minX),
    maxX: roundProjectionNumber(projected.maxX),
    minY: roundProjectionNumber(projected.minY),
    maxY: roundProjectionNumber(projected.maxY)
  };
}

function compareRenderQueueItem(left, right) {
  const depthDelta = left.sortDepth - right.sortDepth;
  if (depthDelta !== 0) return depthDelta;
  const kindOrder = { '3d': 0, '2d': 1 };
  const kindDelta = (kindOrder[left.kind] ?? 9) - (kindOrder[right.kind] ?? 9);
  if (kindDelta !== 0) return kindDelta;
  return (left.sourceIndex ?? 0) - (right.sourceIndex ?? 0);
}

function compareTransparentRenderQueueItem(left, right) {
  const depthDelta = left.sortDepth - right.sortDepth;
  if (depthDelta !== 0) return depthDelta;
  return (left.sourceIndex ?? 0) - (right.sourceIndex ?? 0);
}

function normalizeHeightMap(heightMap = null) {
  if (!heightMap) return null;
  if (typeof heightMap === 'function') return { type: 'function', sample: heightMap };
  if (Array.isArray(heightMap)) {
    return normalizeHeightMap({ data: heightMap });
  }
  if (typeof heightMap !== 'object') return null;
  const data = Array.isArray(heightMap.data)
    ? heightMap.data.map((row) => (Array.isArray(row) ? row.map(Number) : [Number(row)]))
    : null;
  if (!data?.length) return null;
  const origin = heightMap.origin || {};
  const cellSize = Number(heightMap.cellSize || 1);
  return {
    type: 'grid',
    origin: {
      x: Number(origin.x || heightMap.x || 0),
      y: Number(origin.y || heightMap.y || 0)
    },
    cellWidth: Math.max(0.000001, Number(heightMap.cellWidth || cellSize || 1)),
    cellHeight: Math.max(0.000001, Number(heightMap.cellHeight || cellSize || 1)),
    data
  };
}

function sampleHeightMap(heightMap, x = 0, y = 0) {
  if (!heightMap) return null;
  if (heightMap.type === 'function') return Number(heightMap.sample(Number(x || 0), Number(y || 0)));
  if (heightMap.type !== 'grid') return null;
  const fx = (Number(x || 0) - heightMap.origin.x) / heightMap.cellWidth;
  const fy = (Number(y || 0) - heightMap.origin.y) / heightMap.cellHeight;
  const maxY = heightMap.data.length - 1;
  const maxX = Math.max(0, (heightMap.data[0]?.length || 1) - 1);
  const x0 = clampNumber(Math.floor(fx), 0, maxX);
  const y0 = clampNumber(Math.floor(fy), 0, maxY);
  const x1 = clampNumber(x0 + 1, 0, maxX);
  const y1 = clampNumber(y0 + 1, 0, maxY);
  const tx = clampNumber(fx - Math.floor(fx), 0, 1);
  const ty = clampNumber(fy - Math.floor(fy), 0, 1);
  const h00 = Number(heightMap.data[y0]?.[x0] || 0);
  const h10 = Number(heightMap.data[y0]?.[x1] ?? h00);
  const h01 = Number(heightMap.data[y1]?.[x0] ?? h00);
  const h11 = Number(heightMap.data[y1]?.[x1] ?? h10);
  const top = h00 + (h10 - h00) * tx;
  const bottom = h01 + (h11 - h01) * tx;
  return top + (bottom - top) * ty;
}

function sampleModelHeightAt(models = [], x = 0, y = 0) {
  for (const model of models || []) {
    const depthMap = normalizeDepthMap(model?.depthMap);
    if (!Number.isFinite(Number(depthMap?.height))) continue;
    const collider = normalizeDepthMapCollider(depthMap.collider || model.omnicoreProjectedAabb || model);
    if (
      Number(x) >= collider.minX
      && Number(x) <= collider.maxX
      && Number(y) >= collider.minY
      && Number(y) <= collider.maxY
    ) {
      return Number(depthMap.height);
    }
  }
  return null;
}

function isTransparentModel(model = {}) {
  if (model.transparent === true || model.alphaBlend === true) return true;
  const material = model.material || model.materials;
  if (Array.isArray(material)) return material.some(isTransparentModelMaterial);
  return isTransparentModelMaterial(material);
}

function isTransparentModelMaterial(material = {}) {
  if (!material || typeof material !== 'object') return false;
  return material.transparent === true
    || material.alphaBlend === true
    || Number(material.opacity ?? 1) < 1
    || Number(material.alpha ?? 1) < 1;
}

function readModelOpacity(model = {}) {
  if (Number.isFinite(Number(model.opacity))) return clampNumber(Number(model.opacity), 0, 1);
  const material = Array.isArray(model.material) ? model.material.find(isTransparentModelMaterial) : model.material;
  if (Number.isFinite(Number(material?.opacity))) return clampNumber(Number(material.opacity), 0, 1);
  if (Number.isFinite(Number(material?.alpha))) return clampNumber(Number(material.alpha), 0, 1);
  return isTransparentModel(model) ? 0.5 : 1;
}

function clampNumber(value, min = -Infinity, max = Infinity) {
  return Math.min(Math.max(value, min), max);
}

function roundProjectionNumber(value) {
  if (!Number.isFinite(Number(value))) return value;
  return Number(Number(value).toFixed(6));
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
