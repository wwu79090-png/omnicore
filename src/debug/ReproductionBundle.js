/**
 * Reproduction bundle exporter for crash reports, scene state, assets, inputs, and render order.
 */
import {
  collectSceneDependencies,
  normalizeSceneDocument
} from '../scene/SceneDocument.js';
import {
  createDeterministicRenderQueue,
  snapshotRenderQueue
} from '../renderer/DeterministicRenderQueue.js';

export const REPRODUCTION_BUNDLE_SCHEMA = 'omnicore.reproduction-bundle.v1';

export function createReproductionBundle({
  crash = null,
  scene = null,
  assetManifest = {},
  inputs = [],
  renderQueue = null,
  store = null,
  metrics = null,
  generatedAt = new Date().toISOString()
} = {}) {
  const sceneDocument = normalizeSceneDocument(scene || {});
  const queueSource = Array.isArray(renderQueue) ? renderQueue : sceneDocument.children;
  const renderSnapshot = snapshotRenderQueue(createDeterministicRenderQueue(queueSource));

  return {
    schema: REPRODUCTION_BUNDLE_SCHEMA,
    generatedAt,
    crash: safeClone(crash || {}),
    sceneDocument,
    dependencies: collectSceneDependencies(sceneDocument),
    assetManifest: safeClone(assetManifest || {}),
    inputs: safeClone(inputs || []),
    renderSnapshot,
    store: safeClone(store ?? crash?.store ?? {}),
    metrics: safeClone(metrics ?? crash?.metrics ?? {}),
    runtime: safeClone(crash?.runtime || {})
  };
}

function safeClone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { serializationError: true };
  }
}

export default createReproductionBundle;
