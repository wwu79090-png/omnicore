import { optimizeRenderQueueForBatching } from './RenderQueueOptimizer.js';

/**
 * Applies editor-exported render optimization runtime plans to renderer adapters.
 */
export class RenderOptimizationRuntimeExecutor {
  constructor({
    renderer = null,
    textureManager = null,
    filterPipeline = null,
    backendManager = null,
    renderQueue = []
  } = {}) {
    this.renderer = renderer;
    this.textureManager = textureManager;
    this.filterPipeline = filterPipeline;
    this.backendManager = backendManager;
    this.renderQueue = Array.isArray(renderQueue) ? renderQueue : [];
  }

  applyPlan(plan = {}, options = {}) {
    const runtimeActions = normalizeActions(plan.runtimeActions);
    const textureUploadActions = runtimeActions.filter((action) => action.type === 'scheduleTextureUpload');
    const maxUploadsPerFrame = Math.max(1, Number(
      options.maxUploadsPerFrame
      || plan.scheduler?.textureUploads?.maxUploadsPerFrame
      || textureUploadActions[0]?.maxUploadsPerFrame
      || 1
    ));
    const textureUploadBatches = batchTextureUploads(textureUploadActions, maxUploadsPerFrame);
    const applied = [];
    const skipped = [];

    for (const action of runtimeActions) {
      if (action.type === 'scheduleTextureUpload') continue;
      if (action.type === 'sortRenderQueueGroup') continue;
      const result = this.#applyAction(action);
      if (result.applied) applied.push(result.record);
      else skipped.push(result.record);
    }

    for (const batch of textureUploadBatches) {
      for (const upload of batch.uploads) {
        const result = callAdapter(this.textureManager, ['scheduleUpload', 'queueUpload', 'preloadTexture'], upload, {
          frameOffset: batch.frameOffset,
          maxUploadsPerFrame,
          plan
        });
        const record = {
          type: 'scheduleTextureUpload',
          id: upload.id,
          frameOffset: batch.frameOffset,
          adapter: result.method || null,
          result: result.value ?? null
        };
        if (result.called) applied.push(record);
        else skipped.push({ ...record, reason: 'texture-manager-missing-scheduleUpload' });
      }
    }

    const renderQueue = runtimeActions.some((action) => action.type === 'sortRenderQueueGroup') || options.optimizeRenderQueue
      ? optimizeRenderQueueForBatching(this.renderQueue)
      : null;
    if (renderQueue) {
      applied.push({
        type: 'sortRenderQueueGroup',
        beforeDrawCalls: renderQueue.beforeDrawCalls,
        afterDrawCalls: renderQueue.afterDrawCalls,
        savedDrawCalls: renderQueue.savedDrawCalls
      });
    }

    return {
      schema: 'omnicore.render-optimization-apply-report.v1',
      sourcePlanId: plan.sourcePlanId || plan.sourcePlan?.id || null,
      applied,
      skipped,
      textureUploadBatches,
      renderQueue,
      summary: {
        actionCount: runtimeActions.length,
        appliedCount: applied.length,
        skippedCount: skipped.length,
        textureUploadBatchCount: textureUploadBatches.length,
        savedDrawCalls: renderQueue?.savedDrawCalls || 0
      },
      crossEngineProfile: {
        sources: [
          { engine: 'PixiJS', advantage: 'texture upload work should be scheduled rather than spiked in a single frame' },
          { engine: 'Unity', advantage: 'frame inspection findings can be translated into runtime render configuration' },
          { engine: 'Unreal', advantage: 'GPU pass diagnostics should map to pass-reduction actions' },
          { engine: 'Three.js', advantage: 'renderer backend and resource lifecycle stay explicit and portable' }
        ],
        capabilities: [
          'runtime-plan-application',
          'texture-upload-frame-splitting',
          'filter-pass-runtime-flattening',
          'backend-fallback-application',
          'batch-aware-render-queue-application'
        ]
      }
    };
  }

  #applyAction(action) {
    if (action.type === 'buildAtlas') {
      const result = callAdapter(this.renderer, ['buildAtlas', 'createAtlas', 'registerAtlas'], action);
      return actionRecord(action, result, 'renderer-missing-buildAtlas');
    }
    if (action.type === 'flattenFilter') {
      const result = callAdapter(this.filterPipeline, ['flattenFilter', 'flatten', 'mergeFilterPasses'], action);
      return actionRecord(action, result, 'filter-pipeline-missing-flattenFilter');
    }
    if (action.type === 'preferBackend') {
      const result = callAdapter(this.backendManager || this.renderer, ['preferBackend', 'useBackend', 'setPreferredBackend', 'setBackend'], action);
      return actionRecord(action, result, 'backend-manager-missing-preferBackend');
    }
    if (action.type === 'splitDynamicSpriteBatch') {
      const result = callAdapter(this.renderer, ['splitDynamicSpriteBatch', 'splitDynamicSprite', 'splitDynamicBatch'], action);
      return actionRecord(action, result, 'renderer-missing-splitDynamicSpriteBatch');
    }
    return {
      applied: false,
      record: {
        type: action.type || 'unknown',
        id: action.id || null,
        reason: 'unsupported-render-optimization-action'
      }
    };
  }
}

function normalizeActions(actions = []) {
  return (Array.isArray(actions) ? actions : [])
    .filter((action) => action && typeof action === 'object')
    .map((action) => ({ ...action, type: String(action.type || '') }))
    .filter((action) => action.type);
}

function batchTextureUploads(actions = [], maxUploadsPerFrame = 1) {
  const batches = [];
  for (let index = 0; index < actions.length; index += maxUploadsPerFrame) {
    batches.push({
      frameOffset: batches.length,
      uploads: actions.slice(index, index + maxUploadsPerFrame)
    });
  }
  return batches;
}

function callAdapter(target, methods = [], ...args) {
  if (!target) return { called: false, method: null, value: null };
  for (const method of methods) {
    if (typeof target[method] !== 'function') continue;
    return {
      called: true,
      method,
      value: target[method](...args)
    };
  }
  return { called: false, method: null, value: null };
}

function actionRecord(action, adapterResult, missingReason) {
  const record = {
    type: action.type,
    id: action.id || null,
    key: action.key || null,
    adapter: adapterResult.method || null,
    result: adapterResult.value ?? null
  };
  if (adapterResult.called) return { applied: true, record };
  return {
    applied: false,
    record: {
      ...record,
      reason: missingReason
    }
  };
}

export default RenderOptimizationRuntimeExecutor;
