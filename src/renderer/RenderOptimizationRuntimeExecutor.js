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

  previewPlan(plan = {}, options = {}) {
    const runtimeActions = normalizeActions(plan.runtimeActions);
    const maxUploadsPerFrame = resolveMaxUploadsPerFrame(plan, runtimeActions, options);
    const textureUploadBatches = batchTextureUploads(
      runtimeActions.filter((action) => action.type === 'scheduleTextureUpload'),
      maxUploadsPerFrame
    );
    const renderQueue = shouldOptimizeRenderQueue(runtimeActions, options)
      ? optimizeRenderQueueForBatching(this.renderQueue)
      : null;
    const rollbackActions = buildRollbackActions(runtimeActions);
    return {
      schema: 'omnicore.render-optimization-preview.v1',
      sourcePlanId: sourcePlanId(plan),
      dryRun: true,
      textureUploadBatches,
      renderQueue,
      rollbackActions,
      auditTrail: runtimeActions.map((action, index) => auditEntry('preview', action, { index, dryRun: true })),
      summary: {
        actionCount: runtimeActions.length,
        wouldApplyCount: runtimeActions.length,
        textureUploadBatchCount: textureUploadBatches.length,
        rollbackActionCount: rollbackActions.length,
        savedDrawCalls: renderQueue?.savedDrawCalls || 0
      },
      crossEngineProfile: runtimeExecutionCrossEngineProfile()
    };
  }

  applyPlan(plan = {}, options = {}) {
    const runtimeActions = normalizeActions(plan.runtimeActions);
    const textureUploadActions = runtimeActions.filter((action) => action.type === 'scheduleTextureUpload');
    const maxUploadsPerFrame = resolveMaxUploadsPerFrame(plan, runtimeActions, options);
    const textureUploadBatches = batchTextureUploads(textureUploadActions, maxUploadsPerFrame);
    const applied = [];
    const skipped = [];
    const auditTrail = [];
    const dryRun = Boolean(options.dryRun);
    const rollbackActions = buildRollbackActions(runtimeActions);

    for (const action of runtimeActions) {
      if (action.type === 'scheduleTextureUpload') continue;
      if (action.type === 'sortRenderQueueGroup') continue;
      const result = dryRun
        ? dryRunActionResult(action)
        : this.#applyAction(action);
      if (result.applied) applied.push(result.record);
      else skipped.push(result.record);
      auditTrail.push(auditEntry(dryRun ? 'dry-run' : 'apply', action, result.record));
    }

    for (const batch of textureUploadBatches) {
      for (const upload of batch.uploads) {
        const result = dryRun
          ? { called: true, method: 'dryRun', value: null }
          : callAdapter(this.textureManager, ['scheduleUpload', 'queueUpload', 'preloadTexture'], upload, {
            frameOffset: batch.frameOffset,
            maxUploadsPerFrame,
            plan
          });
        const record = {
          type: 'scheduleTextureUpload',
          id: upload.id,
          frameOffset: batch.frameOffset,
          dryRun,
          adapter: result.method || null,
          result: result.value ?? null
        };
        if (result.called) applied.push(record);
        else skipped.push({ ...record, reason: 'texture-manager-missing-scheduleUpload' });
        auditTrail.push(auditEntry(dryRun ? 'dry-run' : 'apply', upload, record));
      }
    }

    const renderQueue = shouldOptimizeRenderQueue(runtimeActions, options)
      ? optimizeRenderQueueForBatching(this.renderQueue)
      : null;
    if (renderQueue) {
      const record = {
        type: 'sortRenderQueueGroup',
        dryRun,
        beforeDrawCalls: renderQueue.beforeDrawCalls,
        afterDrawCalls: renderQueue.afterDrawCalls,
        savedDrawCalls: renderQueue.savedDrawCalls
      };
      applied.push(record);
      auditTrail.push(auditEntry(dryRun ? 'dry-run' : 'apply', { type: 'sortRenderQueueGroup' }, record));
    }

    return {
      schema: 'omnicore.render-optimization-apply-report.v1',
      sourcePlanId: sourcePlanId(plan),
      dryRun,
      applied,
      skipped,
      textureUploadBatches,
      renderQueue,
      rollbackActions,
      auditTrail,
      summary: {
        actionCount: runtimeActions.length,
        appliedCount: applied.length,
        skippedCount: skipped.length,
        dryRun,
        textureUploadBatchCount: textureUploadBatches.length,
        rollbackActionCount: rollbackActions.length,
        savedDrawCalls: renderQueue?.savedDrawCalls || 0
      },
      crossEngineProfile: runtimeExecutionCrossEngineProfile()
    };
  }

  rollback(report = {}) {
    const rollbackActions = Array.isArray(report.rollbackActions) ? report.rollbackActions : [];
    const restored = [];
    const failed = [];
    const auditTrail = [];

    for (const action of rollbackActions) {
      const result = this.#rollbackAction(action);
      const record = {
        type: action.type,
        id: action.id || null,
        key: action.key || null,
        adapter: result.method || null,
        result: result.value ?? null
      };
      if (result.called) restored.push(record);
      else failed.push({ ...record, reason: result.reason || 'rollback-adapter-missing' });
      auditTrail.push(auditEntry('rollback', action, result.called ? record : failed[failed.length - 1]));
    }

    return {
      schema: 'omnicore.render-optimization-rollback-report.v1',
      sourcePlanId: report.sourcePlanId || null,
      restored,
      failed,
      auditTrail,
      summary: {
        rollbackCount: rollbackActions.length,
        restoredCount: restored.length,
        failedCount: failed.length
      },
      crossEngineProfile: runtimeExecutionCrossEngineProfile()
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

  #rollbackAction(action) {
    if (action.type === 'destroyAtlas') {
      return callRollbackAdapter(this.renderer, ['destroyAtlas', 'deleteAtlas', 'removeAtlas'], action);
    }
    if (action.type === 'cancelTextureUpload') {
      return callRollbackAdapter(this.textureManager, ['cancelUpload', 'cancelTextureUpload', 'removeUpload'], action);
    }
    if (action.type === 'restoreFilter') {
      return callRollbackAdapter(this.filterPipeline, ['restoreFilter', 'unflattenFilter', 'restoreFilterPasses'], action);
    }
    if (action.type === 'restoreBackend') {
      return callRollbackAdapter(this.backendManager || this.renderer, ['restoreBackend', 'useBackend', 'setBackend'], action);
    }
    if (action.type === 'mergeDynamicSpriteBatch') {
      return callRollbackAdapter(this.renderer, ['mergeDynamicSpriteBatch', 'mergeDynamicSprite', 'restoreDynamicBatch'], action);
    }
    return { called: false, method: null, value: null, reason: 'unsupported-rollback-action' };
  }
}

function resolveMaxUploadsPerFrame(plan = {}, runtimeActions = [], options = {}) {
  const textureUploadActions = runtimeActions.filter((action) => action.type === 'scheduleTextureUpload');
  return Math.max(1, Number(
    options.maxUploadsPerFrame
    || plan.scheduler?.textureUploads?.maxUploadsPerFrame
    || textureUploadActions[0]?.maxUploadsPerFrame
    || 1
  ));
}

function shouldOptimizeRenderQueue(runtimeActions = [], options = {}) {
  return runtimeActions.some((action) => action.type === 'sortRenderQueueGroup') || Boolean(options.optimizeRenderQueue);
}

function sourcePlanId(plan = {}) {
  return plan.sourcePlanId || plan.sourcePlan?.id || null;
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

function dryRunActionResult(action = {}) {
  return {
    applied: true,
    record: {
      type: action.type,
      id: action.id || null,
      key: action.key || null,
      dryRun: true,
      adapter: 'dryRun',
      result: null
    }
  };
}

function buildRollbackActions(actions = []) {
  return normalizeActions(actions).flatMap((action) => {
    if (action.type === 'buildAtlas') {
      return [{
        type: 'destroyAtlas',
        key: action.key || null,
        textures: Array.isArray(action.textures) ? [...action.textures] : []
      }];
    }
    if (action.type === 'scheduleTextureUpload') {
      return [{
        type: 'cancelTextureUpload',
        id: action.id || null,
        bytes: Number(action.bytes || 0)
      }];
    }
    if (action.type === 'flattenFilter') {
      return [{
        type: 'restoreFilter',
        id: action.id || null,
        passes: Number(action.passes || 1),
        targetPasses: Number(action.targetPasses || 1)
      }];
    }
    if (action.type === 'preferBackend') {
      return [{
        type: 'restoreBackend',
        previousBackend: action.selected || action.previousBackend || null,
        preferredBackend: action.backend || null
      }];
    }
    if (action.type === 'splitDynamicSpriteBatch') {
      return [{
        type: 'mergeDynamicSpriteBatch',
        id: action.id || null,
        texture: action.texture || null
      }];
    }
    return [];
  });
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

function callRollbackAdapter(target, methods = [], action = {}) {
  const result = callAdapter(target, methods, action);
  if (result.called) return result;
  return {
    ...result,
    reason: 'rollback-adapter-missing'
  };
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

function auditEntry(phase, action = {}, record = {}) {
  return {
    phase,
    type: action.type || record.type || 'unknown',
    id: action.id || record.id || null,
    key: action.key || record.key || null,
    dryRun: Boolean(record.dryRun)
  };
}

function runtimeExecutionCrossEngineProfile() {
  return {
    sources: [
      { engine: 'PixiJS', advantage: 'texture upload work should be scheduled rather than spiked in a single frame' },
      { engine: 'Unity', advantage: 'frame inspection findings can be translated into runtime render configuration' },
      { engine: 'Unreal', advantage: 'GPU pass diagnostics should map to pass-reduction actions' },
      { engine: 'Three.js', advantage: 'renderer backend and resource lifecycle stay explicit and portable' }
    ],
    capabilities: [
      'runtime-plan-application',
      'runtime-plan-preview',
      'runtime-plan-rollback',
      'texture-upload-frame-splitting',
      'filter-pass-runtime-flattening',
      'backend-fallback-application',
      'batch-aware-render-queue-application',
      'runtime-optimization-audit-trail'
    ]
  };
}

export default RenderOptimizationRuntimeExecutor;
