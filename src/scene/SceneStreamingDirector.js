/**
 * High-level scene streaming planner for world partition cells, additive scenes, threaded assets, and bundles.
 */
export const SCENE_STREAMING_DIRECTOR_REPORT_SCHEMA = 'omnicore.scene-streaming-director-report.v1';

export class SceneStreamingDirector {
  constructor({ cellSize = 256, scenes = [] } = {}) {
    this.cellSize = Math.max(1, Number(cellSize) || 256);
    this.scenes = normalizeArray(scenes).map((scene, index) => normalizeScene(scene, index));
    this.sceneMap = new Map(this.scenes.map((scene) => [scene.id, scene]));
  }

  static create(config = {}) {
    return new SceneStreamingDirector(config);
  }

  static crossEngineProfile() {
    return {
      sources: [
        'Unreal World Partition',
        'Unity Additive Scene Loading',
        'Godot ResourceLoader threaded loading',
        'Cocos Creator Asset Bundle'
      ],
      capabilities: [
        'runtime-streaming-sources',
        'additive-scene-load-unload',
        'threaded-resource-prefetch',
        'bundle-preload-and-release',
        'layer-aware-world-partition',
        'deterministic-streaming-action-plan'
      ]
    };
  }

  crossEngineProfile() {
    return SceneStreamingDirector.crossEngineProfile();
  }

  plan({
    sources = [],
    activeLayers = [],
    loadedScenes = [],
    residentBundles = [],
    residentAssets = []
  } = {}) {
    const sourceList = normalizeArray(sources).map(normalizeSource);
    const activeLayerSet = new Set(normalizeArray(activeLayers).map(String));
    const loadedSceneSet = new Set(normalizeArray(loadedScenes).map(String));
    const residentBundleSet = new Set(normalizeArray(residentBundles).map(String));
    const residentAssetSet = new Set(normalizeArray(residentAssets).map(String));

    const active = [];
    const preload = [];
    for (const scene of this.scenes) {
      const state = this._classify(scene, sourceList, activeLayerSet);
      if (state === 'active') active.push(scene);
      else if (state === 'preload') preload.push(scene);
    }

    const activeScenes = sortScenes(active);
    const preloadScenes = sortScenes(preload.filter((scene) => !activeScenes.includes(scene)));
    const activeSet = new Set(activeScenes.map((scene) => scene.id));
    const preloadSet = new Set(preloadScenes.map((scene) => scene.id));
    const unloadScenes = normalizeArray(loadedScenes)
      .map(String)
      .map((id) => this.sceneMap.get(id))
      .filter((scene) => scene && !scene.persistent && !activeSet.has(scene.id) && !preloadSet.has(scene.id))
      .sort(compareScene);

    const actions = [
      ...this._loadActiveSceneActions(activeScenes, { loadedSceneSet, residentBundleSet, residentAssetSet }),
      ...this._preloadSceneActions(preloadScenes, { loadedSceneSet, residentBundleSet, residentAssetSet }),
      ...this._unloadSceneActions(unloadScenes, { retainedScenes: [...activeScenes, ...preloadScenes] })
    ];

    return {
      schema: SCENE_STREAMING_DIRECTOR_REPORT_SCHEMA,
      summary: {
        sceneCount: this.scenes.length,
        activeSceneCount: activeScenes.length,
        preloadSceneCount: preloadScenes.length,
        unloadSceneCount: unloadScenes.length,
        actionCount: actions.length,
        ready: true
      },
      activeScenes: activeScenes.map((scene) => scene.id),
      preloadScenes: preloadScenes.map((scene) => scene.id),
      unloadScenes: unloadScenes.map((scene) => scene.id),
      cells: {
        active: cellsFor(activeScenes, this.cellSize),
        preload: cellsFor(preloadScenes, this.cellSize)
      },
      actions,
      crossEngineProfile: this.crossEngineProfile()
    };
  }

  _classify(scene, sources, activeLayerSet) {
    if (scene.persistent) return 'active';
    if (!matchesLayer(scene, activeLayerSet)) return 'inactive';
    if (scene.spatial === false) return 'active';

    let shouldPreload = false;
    for (const source of sources) {
      const distance = distanceToScene(scene, source);
      const activeRadius = Number.isFinite(scene.radius) ? scene.radius : source.radius;
      const preloadRadius = Number.isFinite(scene.preloadRadius) ? scene.preloadRadius : source.preloadRadius;
      if (distance <= activeRadius) return 'active';
      if (distance <= preloadRadius) shouldPreload = true;
    }
    return shouldPreload ? 'preload' : 'inactive';
  }

  _loadActiveSceneActions(scenes, { loadedSceneSet, residentBundleSet, residentAssetSet }) {
    const actions = [];
    for (const [bundle, bundledScenes] of groupByBundle(scenes.filter((scene) => !loadedSceneSet.has(scene.id)))) {
      if (!residentBundleSet.has(bundle)) {
        actions.push({
          type: 'loadBundle',
          bundle,
          scenes: bundledScenes.map((scene) => scene.id),
          enginePattern: 'Cocos Creator Asset Bundle'
        });
      }

      for (const scene of bundledScenes) {
        for (const asset of scene.assets) {
          if (residentAssetSet.has(asset)) continue;
          actions.push({
            type: 'requestThreadedLoad',
            asset,
            scene: scene.id,
            preload: false,
            enginePattern: 'Godot ResourceLoader'
          });
        }
        actions.push({
          type: scene.mode === 'single' ? 'loadSceneSingle' : 'loadSceneAdditive',
          scene: scene.id,
          mode: scene.mode,
          enginePattern: scene.mode === 'single' ? 'Unity SceneManager.LoadScene' : 'Unity LoadSceneMode.Additive'
        });
      }
    }
    return actions;
  }

  _preloadSceneActions(scenes, { loadedSceneSet, residentBundleSet, residentAssetSet }) {
    const candidates = scenes.filter((scene) => !loadedSceneSet.has(scene.id));
    const actions = [];
    for (const [bundle, bundledScenes] of groupByBundle(candidates)) {
      if (!residentBundleSet.has(bundle)) {
        actions.push({
          type: 'preloadBundle',
          bundle,
          scenes: bundledScenes.map((scene) => scene.id),
          enginePattern: 'Cocos Creator Asset Bundle'
        });
      }
      for (const scene of bundledScenes) {
        for (const asset of scene.assets) {
          if (residentAssetSet.has(asset)) continue;
          actions.push({
            type: 'requestThreadedLoad',
            asset,
            scene: scene.id,
            preload: true,
            enginePattern: 'Godot ResourceLoader'
          });
        }
      }
    }
    return actions;
  }

  _unloadSceneActions(scenes, { retainedScenes }) {
    const retainedBundles = new Set(retainedScenes.map((scene) => scene.bundle).filter(Boolean));
    const actions = [];
    for (const scene of scenes) {
      actions.push({
        type: scene.mode === 'single' ? 'deactivateScene' : 'unloadSceneAdditive',
        scene: scene.id,
        enginePattern: scene.mode === 'single' ? 'Unity SceneManager.SetActiveScene' : 'Unity SceneManager.UnloadSceneAsync'
      });
      if (scene.bundle && !retainedBundles.has(scene.bundle)) {
        actions.push({
          type: 'releaseBundle',
          bundle: scene.bundle,
          scene: scene.id,
          enginePattern: 'Cocos Creator Asset Manager'
        });
      }
    }
    return actions;
  }
}

function normalizeScene(scene = {}, index = 0) {
  const id = String(scene.id || scene.name || `scene-${index}`);
  const spatial = scene.spatial !== false;
  return {
    id,
    x: Number(scene.x || scene.position?.x || 0),
    y: Number(scene.y || scene.position?.y || 0),
    radius: optionalNumber(scene.radius || scene.loadRadius),
    preloadRadius: optionalNumber(scene.preloadRadius),
    spatial,
    persistent: Boolean(scene.persistent),
    mode: scene.mode === 'single' ? 'single' : 'additive',
    layers: normalizeArray(scene.layers).map(String).sort(),
    bundle: scene.bundle ? String(scene.bundle) : id,
    assets: unique(normalizeArray(scene.assets || scene.assetRefs).flatMap(normalizeAssetRef)),
    priority: Number(scene.priority || 0)
  };
}

function normalizeSource(source = {}) {
  return {
    id: String(source.id || 'source'),
    x: Number(source.x || source.position?.x || 0),
    y: Number(source.y || source.position?.y || 0),
    radius: Math.max(0, Number(source.radius || 0)),
    preloadRadius: Math.max(0, Number(source.preloadRadius ?? source.radius ?? 0))
  };
}

function normalizeAssetRef(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(normalizeAssetRef);
  if (typeof value === 'object') return Object.values(value).flatMap(normalizeAssetRef);
  return [String(value)];
}

function matchesLayer(scene, activeLayerSet) {
  if (!scene.layers.length) return true;
  if (!activeLayerSet.size) return false;
  return scene.layers.some((layer) => activeLayerSet.has(layer));
}

function distanceToScene(scene, source) {
  return Math.hypot(scene.x - source.x, scene.y - source.y);
}

function groupByBundle(scenes) {
  const groups = new Map();
  for (const scene of scenes) {
    if (!groups.has(scene.bundle)) groups.set(scene.bundle, []);
    groups.get(scene.bundle).push(scene);
  }
  return [...groups.entries()]
    .map(([bundle, entries]) => [bundle, sortScenes(entries)])
    .sort(([left], [right]) => left.localeCompare(right));
}

function cellsFor(scenes, cellSize) {
  return unique(scenes
    .filter((scene) => scene.spatial !== false)
    .map((scene) => `${Math.floor(scene.x / cellSize)},${Math.floor(scene.y / cellSize)}`))
    .sort();
}

function sortScenes(scenes) {
  return [...scenes].sort(compareScene);
}

function compareScene(left, right) {
  if (left.persistent !== right.persistent) return left.persistent ? -1 : 1;
  if (left.priority !== right.priority) return right.priority - left.priority;
  return left.id.localeCompare(right.id);
}

function optionalNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : null;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function unique(values = []) {
  return [...new Set(values.filter((value) => value != null && value !== '').map(String))];
}

export default SceneStreamingDirector;
