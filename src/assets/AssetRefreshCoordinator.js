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
        'handler-failure-diagnostics'
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

    for (const action of normalizedPlan.runtimeActions) {
      const result = await this._applyRuntimeAction(action);
      runtimeResults.push(result);
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
      } catch (error) {
        const message = errorMessage(error);
        failures.push({
          phase: 'hmr',
          message
        });
        this.logger?.error?.('AssetRefreshCoordinator HMR send failed', error);
      }
    }

    const runtimeFailedCount = runtimeResults.filter((result) => result.status === 'failed').length;
    const editorFailedCount = editorResults.filter((result) => result.status === 'failed').length;
    const summary = {
      schema: ASSET_REFRESH_APPLY_REPORT_SCHEMA,
      runtimeActionCount: normalizedPlan.runtimeActions.length,
      runtimeAppliedCount: runtimeResults.filter((result) => result.status === 'applied').length,
      runtimeSkippedCount: runtimeResults.filter((result) => result.status === 'skipped').length,
      runtimeFailedCount,
      editorEventCount: normalizedPlan.editorEvents.length,
      editorFailedCount,
      hmrSent
    };

    return {
      schema: ASSET_REFRESH_APPLY_REPORT_SCHEMA,
      ok: runtimeFailedCount === 0 && editorFailedCount === 0 && !failures.some((item) => item.phase === 'hmr'),
      summary,
      runtimeResults,
      editorResults,
      failures,
      hmrPayload,
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

function collectDirectAssets(plan) {
  if (Array.isArray(plan.directAssets) && plan.directAssets.length > 0) return [...plan.directAssets];
  return [...new Set(plan.runtimeActions.map((action) => action.asset).filter(Boolean))];
}

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function errorMessage(error) {
  return error?.message ? String(error.message) : String(error);
}

export default AssetRefreshCoordinator;
