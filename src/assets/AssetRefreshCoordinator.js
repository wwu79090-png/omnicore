/**
 * Applies dependency-aware asset change plans to runtime resources, editor views, and HMR sockets.
 */
import { createOmniError } from '../core/OmniError.js';

export const ASSET_REFRESH_APPLY_REPORT_SCHEMA = 'omnicore.asset-refresh-apply-report.v1';

export class AssetRefreshCoordinator {
  constructor({
    handlers = {},
    editorBus = null,
    onEditorEvent = null,
    websocket = null,
    logger = null
  } = {}) {
    this.handlers = handlers || {};
    this.editorBus = editorBus;
    this.onEditorEvent = onEditorEvent;
    this.websocket = websocket;
    this.logger = logger;
  }

  static create(config = {}) {
    return new AssetRefreshCoordinator(config);
  }

  static crossEngineProfile() {
    return {
      sources: [
        'Unity AssetPostprocessor',
        'Unreal Asset Registry change notifications',
        'Godot EditorFileSystem scan callbacks',
        'Cocos Creator AssetDB refresh',
        'PixiJS texture cache invalidation'
      ],
      capabilities: [
        'runtime-asset-refresh-dispatch',
        'editor-browser-event-fanout',
        'hmr-change-plan-payload',
        'dependency-aware-refresh-order',
        'handler-failure-diagnostics',
        'editor-panel-refresh-snapshot',
        'replayable-refresh-trace',
        'severity-gated-refresh-report'
      ]
    };
  }

  crossEngineProfile() {
    return AssetRefreshCoordinator.crossEngineProfile();
  }

  async apply(plan, { sendHmr = true } = {}) {
    const normalizedPlan = normalizePlan(plan);
    const runtimeResults = [];
    const editorResults = [];
    const failures = [];
    const trace = [];
    let sequence = 1;
    const nextSequence = () => {
      const value = sequence;
      sequence += 1;
      return value;
    };

    for (const action of normalizedPlan.runtimeActions) {
      const result = await this._applyRuntimeAction(action);
      runtimeResults.push(result);
      trace.push(toRuntimeTraceEvent(result, nextSequence()));
      if (result.status === 'failed') {
        failures.push({
          phase: 'runtime',
          action: clone(action),
          message: result.message
        });
      }
    }

    for (const event of normalizedPlan.editorEvents) {
      const result = await this._emitEditorEvent(event);
      editorResults.push(result);
      trace.push(toEditorTraceEvent(result, nextSequence()));
      if (result.status === 'failed') {
        failures.push({
          phase: 'editor',
          event: clone(event),
          message: result.message
        });
      }
    }

    const hmrPayload = createHmrPayload(normalizedPlan);
    let hmrSent = false;
    if (sendHmr && this.websocket?.send) {
      try {
        await this.websocket.send(JSON.stringify(hmrPayload));
        hmrSent = true;
        trace.push({
          sequence: nextSequence(),
          phase: 'hmr',
          status: 'sent',
          fileCount: hmrPayload.files.length,
          runtimeActionCount: hmrPayload.runtimeActions.length,
          editorEventCount: hmrPayload.editorEvents.length
        });
      } catch (error) {
        const message = errorMessage(error);
        failures.push({
          phase: 'hmr',
          message
        });
        trace.push({
          sequence: nextSequence(),
          phase: 'hmr',
          status: 'failed',
          message
        });
        this.logger?.error?.('AssetRefreshCoordinator HMR send failed', error);
      }
    }

    const runtimeFailedCount = runtimeResults.filter((result) => result.status === 'failed').length;
    const editorFailedCount = editorResults.filter((result) => result.status === 'failed').length;
    const severity = resolveSeverity({
      failures,
      runtimeResults,
      editorResults
    });
    const editorPanel = buildEditorPanelSnapshot({
      plan: normalizedPlan,
      runtimeResults,
      editorResults,
      failures,
      severity
    });
    const replayPacket = createReplayPacket({
      plan: normalizedPlan,
      hmrPayload,
      trace
    });
    const summary = {
      schema: ASSET_REFRESH_APPLY_REPORT_SCHEMA,
      runtimeActionCount: normalizedPlan.runtimeActions.length,
      runtimeAppliedCount: runtimeResults.filter((result) => result.status === 'applied').length,
      runtimeSkippedCount: runtimeResults.filter((result) => result.status === 'skipped').length,
      runtimeFailedCount,
      editorEventCount: normalizedPlan.editorEvents.length,
      editorFailedCount,
      hmrSent,
      severity,
      traceEventCount: trace.length,
      panelRowCount: editorPanel.rows.length
    };

    return {
      schema: ASSET_REFRESH_APPLY_REPORT_SCHEMA,
      ok: runtimeFailedCount === 0 && editorFailedCount === 0 && !failures.some((item) => item.phase === 'hmr'),
      summary,
      runtimeResults,
      editorResults,
      failures,
      hmrPayload,
      editorPanel,
      trace,
      replayPacket,
      crossEngineProfile: this.crossEngineProfile()
    };
  }

  async _applyRuntimeAction(action) {
    const handler = this.handlers?.[action.type];
    if (typeof handler !== 'function') {
      return {
        status: 'skipped',
        action: clone(action),
        reason: `missing-handler:${action.type}`
      };
    }

    try {
      const value = await handler(action);
      return {
        status: 'applied',
        action: clone(action),
        value: clone(value)
      };
    } catch (error) {
      const message = errorMessage(error);
      this.logger?.error?.('AssetRefreshCoordinator runtime handler failed', {
        action,
        error
      });
      return {
        status: 'failed',
        action: clone(action),
        message
      };
    }
  }

  async _emitEditorEvent(event) {
    try {
      await this.editorBus?.emit?.(event.type, clone(event));
      await this.onEditorEvent?.(clone(event));
      return {
        status: 'emitted',
        event: clone(event)
      };
    } catch (error) {
      const message = errorMessage(error);
      this.logger?.error?.('AssetRefreshCoordinator editor event failed', {
        event,
        error
      });
      return {
        status: 'failed',
        event: clone(event),
        message
      };
    }
  }
}

function normalizePlan(plan) {
  if (!plan || typeof plan !== 'object') {
    throw createOmniError(
      'AssetRefreshCoordinator',
      'AssetRefreshCoordinator.apply requires an asset change plan object.'
    );
  }
  return {
    ...clone(plan),
    runtimeActions: Array.isArray(plan.runtimeActions) ? plan.runtimeActions.map(clone) : [],
    editorEvents: Array.isArray(plan.editorEvents) ? plan.editorEvents.map(clone) : []
  };
}

function createHmrPayload(plan) {
  return {
    type: 'assets:hot-update',
    incremental: true,
    files: collectDirectAssets(plan),
    changePlan: clone(plan),
    runtimeActions: plan.runtimeActions.map(clone),
    editorEvents: plan.editorEvents.map(clone)
  };
}

function createReplayPacket({ plan, hmrPayload, trace }) {
  return {
    schema: 'omnicore.asset-refresh-replay.v1',
    source: plan.summary?.source || null,
    planSchema: plan.schema || null,
    directAssets: normalizeStringList(plan.directAssets),
    affectedAssets: normalizeStringList(plan.affectedAssets),
    runtimeActions: plan.runtimeActions.map(clone),
    editorEvents: plan.editorEvents.map(clone),
    hmrPayload: clone(hmrPayload),
    trace: trace.map(clone)
  };
}

function buildEditorPanelSnapshot({
  plan,
  runtimeResults,
  editorResults,
  failures,
  severity
}) {
  const directAssets = new Set(normalizeStringList(plan.directAssets));
  const affectedAssets = new Set(normalizeStringList(plan.affectedAssets));
  const assets = new Set([...directAssets, ...affectedAssets]);
  for (const action of plan.runtimeActions) if (action.asset) assets.add(action.asset);
  for (const event of plan.editorEvents) if (event.asset) assets.add(event.asset);

  const runtimeByAsset = groupByAsset(runtimeResults, (result) => result.action?.asset);
  const editorByAsset = groupByAsset(editorResults, (result) => result.event?.asset);
  const rows = [...assets]
    .sort()
    .map((asset) => {
      const runtimeItems = runtimeByAsset.get(asset) || [];
      const editorItems = editorByAsset.get(asset) || [];
      return {
        asset,
        role: directAssets.has(asset) ? 'direct' : 'affected',
        changeKind: changeKindFor(asset, plan),
        runtimeActionTypes: unique(runtimeItems.map((item) => item.action?.type).filter(Boolean)),
        editorEventTypes: unique(editorItems.map((item) => item.event?.type).filter(Boolean)),
        runtimeStatus: aggregateStatus(runtimeItems),
        editorStatus: aggregateStatus(editorItems),
        reasons: unique(runtimeItems.map((item) => item.action?.reason).filter(Boolean)),
        failureMessages: failures
          .filter((failure) => failure.action?.asset === asset || failure.event?.asset === asset)
          .map((failure) => failure.message)
          .filter(Boolean)
      };
    });

  return {
    schema: 'omnicore.asset-refresh-editor-panel.v1',
    source: plan.summary?.source || null,
    generatedAt: new Date().toISOString(),
    severity,
    counters: {
      directAssetCount: directAssets.size,
      affectedAssetCount: affectedAssets.size,
      runtimeActionCount: plan.runtimeActions.length,
      editorEventCount: plan.editorEvents.length,
      brokenReferenceCount: normalizeArray(plan.brokenReferences).length,
      repairActionCount: normalizeArray(plan.repairActions).length,
      failureCount: failures.length
    },
    rows,
    brokenReferences: normalizeArray(plan.brokenReferences).map(clone),
    repairActions: normalizeArray(plan.repairActions).map(clone)
  };
}

function toRuntimeTraceEvent(result, sequence) {
  return {
    sequence,
    phase: 'runtime',
    status: result.status,
    actionType: result.action?.type || null,
    asset: result.action?.asset || null,
    reason: result.action?.reason || result.reason || null,
    message: result.message || null
  };
}

function toEditorTraceEvent(result, sequence) {
  return {
    sequence,
    phase: 'editor',
    status: result.status,
    eventType: result.event?.type || null,
    asset: result.event?.asset || null,
    message: result.message || null
  };
}

function resolveSeverity({ failures, runtimeResults, editorResults }) {
  if (failures.length > 0) return 'error';
  if (
    runtimeResults.some((result) => result.status === 'skipped')
    || editorResults.some((result) => result.status === 'skipped')
  ) return 'warning';
  return 'ok';
}

function groupByAsset(items, selector) {
  const map = new Map();
  for (const item of items) {
    const asset = selector(item);
    if (!asset) continue;
    if (!map.has(asset)) map.set(asset, []);
    map.get(asset).push(item);
  }
  return map;
}

function changeKindFor(asset, plan) {
  const event = plan.editorEvents.find((candidate) => candidate.asset === asset);
  if (!event) return null;
  if (event.type === 'asset:imported') return 'imported';
  if (event.type === 'asset:moved') return 'moved';
  if (event.type === 'asset:deleted') return 'deleted';
  return event.kind || 'modified';
}

function aggregateStatus(items) {
  if (!items.length) return null;
  if (items.some((item) => item.status === 'failed')) return 'failed';
  if (items.some((item) => item.status === 'skipped')) return 'skipped';
  if (items.every((item) => item.status === 'emitted')) return 'emitted';
  if (items.every((item) => item.status === 'applied')) return 'applied';
  return items.at(-1)?.status || null;
}

function collectDirectAssets(plan) {
  if (Array.isArray(plan.directAssets) && plan.directAssets.length > 0) return [...plan.directAssets];
  return [...new Set(plan.runtimeActions.map((action) => action.asset).filter(Boolean))];
}

function normalizeStringList(value) {
  return normalizeArray(value).filter(Boolean).map(String);
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function unique(values = []) {
  return [...new Set(values)];
}

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function errorMessage(error) {
  return error?.message ? String(error.message) : String(error);
}

export default AssetRefreshCoordinator;
