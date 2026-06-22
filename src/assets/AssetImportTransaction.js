import { createOmniError } from '../core/OmniError.js';

export const ASSET_IMPORT_TRANSACTION_REPORT_SCHEMA = 'omnicore.asset-import-transaction-report.v1';

export class AssetImportTransaction {
  constructor({
    importer = null,
    writer = null,
    metadataStore = null,
    editorBus = null,
    onEditorEvent = null,
    rollback = null,
    logger = null
  } = {}) {
    this.importer = importer;
    this.writer = writer;
    this.metadataStore = metadataStore;
    this.editorBus = editorBus;
    this.onEditorEvent = onEditorEvent;
    this.rollback = rollback;
    this.logger = logger;
  }

  static create(config = {}) {
    return new AssetImportTransaction(config);
  }

  static crossEngineProfile() {
    return {
      sources: [
        'Unity AssetDatabase atomic refresh',
        'Unreal Interchange pipeline execution',
        'Godot import sidecar generation',
        'Cocos Creator asset preset apply',
        'PixiJS texture cache upload lifecycle'
      ],
      capabilities: [
        'transactional-import-apply',
        'dry-run-step-execution',
        'rollback-on-import-failure',
        'editor-import-events',
        'metadata-sidecar-write',
        'blocked-conflict-enforcement'
      ]
    };
  }

  crossEngineProfile() {
    return AssetImportTransaction.crossEngineProfile();
  }

  async apply(previewReport, {
    allowBlocked = false,
    allowPreviewErrors = false,
    rollbackOnFailure = true
  } = {}) {
    const preview = normalizePreviewReport(previewReport);
    const entryBySource = new Map(preview.entries.map((entry) => [entry.source, entry]));
    const results = [];
    const metadataResults = [];
    const editorEvents = [];
    const rollbackResults = [];
    const failures = [];
    const applied = [];
    const preflightFailures = allowPreviewErrors ? [] : createPreflightFailures(preview);
    const preflightBlocked = preflightFailures.length > 0;

    failures.push(...preflightFailures);

    for (const rawStep of preview.steps) {
      const step = normalizeStep(rawStep, entryBySource);

      if (step.type === 'skip') {
        results.push(skippedResult(step));
        continue;
      }

      if (step.type === 'blocked' && !allowBlocked) {
        const failure = blockedStepFailure(step);
        results.push(blockedResult(step, failure.reason));
        failures.push(failure);
        continue;
      }

      if (preflightBlocked && step.type === 'import') {
        const failure = blockedStepFailure({
          ...step,
          type: 'blocked',
          reason: 'preview-error'
        });
        results.push(blockedResult(step, 'preview-error'));
        failures.push(failure);
        continue;
      }

      const importStep = step.type === 'blocked' ? importStepFromBlocked(step, entryBySource) : step;
      const result = await this._applyImportStep(importStep, entryBySource.get(importStep.source) || null);
      results.push(result.result);

      if (result.metadata) metadataResults.push(result.metadata);
      if (result.editorEvent) editorEvents.push(result.editorEvent);
      if (result.applied.length > 0) applied.push(...result.applied);

      if (result.failure) {
        failures.push(result.failure);
        if (rollbackOnFailure && applied.length > 0) {
          const rollbackBatch = await this._rollbackApplied(applied, result.failure);
          rollbackResults.push(...rollbackBatch.results);
          failures.push(...rollbackBatch.failures);
        }
        break;
      }
    }

    const summary = summarize({ preview, results, failures, metadataResults, editorEvents, rollbackResults });

    return {
      schema: ASSET_IMPORT_TRANSACTION_REPORT_SCHEMA,
      ok: summary.ok,
      summary,
      results,
      metadataResults,
      editorEvents,
      rollbackResults,
      failures,
      diagnostics: preview.diagnostics.map(clone),
      crossEngineProfile: this.crossEngineProfile()
    };
  }

  async _applyImportStep(step, entry) {
    const payload = importPayloadFor(step, entry);
    const importFn = resolveFunction(this.importer, 'import');
    if (!importFn) {
      return failedImportResult(step, 'import', 'AssetImportTransaction requires an importer function.');
    }

    let imported;
    try {
      imported = await importFn(payload);
    } catch (error) {
      return failedImportResult(step, 'import', errorMessage(error));
    }

    const writeBatch = await this._writeOutputs(payload, imported);
    if (writeBatch.failure) {
      return {
        result: {
          ...failedResultBase(step, writeBatch.failure.phase),
          writes: writeBatch.results
        },
        failure: writeBatch.failure,
        applied: writeBatch.applied,
        metadata: null,
        editorEvent: null
      };
    }

    const metadata = await this._saveMetadata(payload, imported);
    if (metadata.failure) {
      return {
        result: {
          ...failedResultBase(step, 'metadata'),
          writes: writeBatch.results
        },
        failure: metadata.failure,
        applied: writeBatch.applied,
        metadata: null,
        editorEvent: null
      };
    }

    const editorEvent = await this._emitEditorEvent(payload, imported, metadata.result);
    if (editorEvent.failure) {
      return {
        result: {
          ...failedResultBase(step, 'editor'),
          writes: writeBatch.results,
          metadata: metadata.result
        },
        failure: editorEvent.failure,
        applied: writeBatch.applied,
        metadata: metadata.result,
        editorEvent: null
      };
    }

    return {
      result: {
        status: 'imported',
        source: payload.source,
        action: payload.action,
        output: payload.output,
        step: clone(step),
        writes: writeBatch.results,
        metadata: metadata.result,
        editorEvent: editorEvent.result
      },
      failure: null,
      applied: writeBatch.applied,
      metadata: metadata.result,
      editorEvent: editorEvent.result
    };
  }

  async _writeOutputs(payload, imported) {
    const writeFn = resolveFunction(this.writer, 'write');
    const outputs = outputsForImported(payload, imported);
    const results = [];
    const applied = [];

    if (!writeFn) {
      return {
        results,
        applied,
        failure: null
      };
    }

    for (const output of outputs) {
      const writePayload = {
        path: output.path,
        value: output.value,
        source: payload.source,
        output: output.path,
        action: payload.action,
        step: clone(payload.step),
        entry: clone(payload.entry),
        imported
      };

      try {
        const value = await writeFn(writePayload);
        const result = {
          status: 'written',
          source: payload.source,
          output: output.path,
          value: clone(value)
        };
        results.push(result);
        applied.push({
          source: payload.source,
          action: payload.action,
          output: output.path,
          step: clone(payload.step),
          entry: clone(payload.entry),
          writeResult: result
        });
      } catch (error) {
        return {
          results,
          applied,
          failure: failureForStep(payload.step, 'write', errorMessage(error))
        };
      }
    }

    return {
      results,
      applied,
      failure: null
    };
  }

  async _saveMetadata(payload, imported) {
    const saveFn = resolveFunction(this.metadataStore, 'save');
    if (!saveFn) {
      return {
        result: null,
        failure: null
      };
    }

    const metadataPayload = metadataPayloadFor(payload, imported);
    try {
      const value = await saveFn(metadataPayload);
      return {
        result: {
          status: 'saved',
          source: payload.source,
          output: payload.output,
          value: clone(value),
          ...metadataPayload
        },
        failure: null
      };
    } catch (error) {
      return {
        result: null,
        failure: failureForStep(payload.step, 'metadata', errorMessage(error))
      };
    }
  }

  async _emitEditorEvent(payload, imported, metadata) {
    const type = eventTypeForAction(payload.action);
    const event = {
      type,
      source: payload.source,
      action: payload.action,
      output: payload.output,
      entry: clone(payload.entry),
      imported: importedSummary(imported),
      metadata: clone(metadata)
    };

    try {
      await this.editorBus?.emit?.(type, event);
      await this.onEditorEvent?.(clone(event));
      return {
        result: event,
        failure: null
      };
    } catch (error) {
      return {
        result: null,
        failure: failureForStep(payload.step, 'editor', errorMessage(error))
      };
    }
  }

  async _rollbackApplied(applied, cause) {
    const rollbackFn = resolveFunction(this.rollback, 'rollback') || resolveFunction(this.writer, 'rollback');
    const results = [];
    const failures = [];

    for (const record of [...applied].reverse()) {
      const payload = {
        source: record.source,
        action: record.action,
        output: record.output,
        step: clone(record.step),
        entry: clone(record.entry),
        cause: clone(cause)
      };

      if (!rollbackFn) {
        const failure = {
          phase: 'rollback',
          source: record.source,
          output: record.output,
          message: 'No rollback handler is configured.',
          cause: clone(cause)
        };
        failures.push(failure);
        results.push({
          status: 'missing-handler',
          source: record.source,
          output: record.output
        });
        continue;
      }

      try {
        await rollbackFn(payload);
        results.push({
          status: 'rolled-back',
          source: record.source,
          output: record.output
        });
      } catch (error) {
        const message = errorMessage(error);
        this.logger?.error?.('AssetImportTransaction rollback failed', {
          record,
          error
        });
        const failure = {
          phase: 'rollback',
          source: record.source,
          output: record.output,
          message,
          cause: clone(cause)
        };
        failures.push(failure);
        results.push({
          status: 'failed',
          source: record.source,
          output: record.output,
          message
        });
      }
    }

    return { results, failures };
  }
}

function normalizePreviewReport(report) {
  if (!report || typeof report !== 'object') {
    throw createOmniError(
      'AssetImportTransaction',
      'AssetImportTransaction.apply requires an asset import preview report.'
    );
  }

  return {
    schema: report.schema || '',
    summary: clone(report.summary || {}),
    entries: normalizeArray(report.entries).map((entry) => ({
      ...clone(entry),
      source: normalizePath(entry.source),
      output: clone(entry.output || {})
    })),
    diagnostics: normalizeArray(report.diagnostics).map(clone),
    steps: normalizeArray(report.steps).map(clone)
  };
}

function normalizeStep(step, entryBySource) {
  const source = normalizePath(step.source);
  const entry = entryBySource.get(source) || {};
  const output = normalizePath(step.output || entry.output?.path || '');
  return {
    ...clone(step),
    source,
    action: step.action || entry.action || (step.type === 'skip' ? 'unchanged' : 'create'),
    output
  };
}

function importStepFromBlocked(step, entryBySource) {
  const entry = entryBySource.get(step.source) || {};
  return {
    type: 'import',
    action: entry.action || 'update',
    source: step.source,
    output: normalizePath(entry.output?.path || step.output || ''),
    blockedReason: step.reason
  };
}

function createPreflightFailures(preview) {
  const blockedSources = new Set(preview.steps
    .filter((step) => step.type === 'blocked')
    .map((step) => normalizePath(step.source)));

  return preview.diagnostics
    .filter((diagnostic) => diagnostic.severity === 'error')
    .filter((diagnostic) => !diagnosticCoveredByBlockedStep(diagnostic, blockedSources))
    .map((diagnostic) => ({
      phase: 'preflight',
      code: diagnostic.code,
      message: `Preview contains blocking diagnostic: ${diagnostic.code}`,
      diagnostic: clone(diagnostic)
    }));
}

function diagnosticCoveredByBlockedStep(diagnostic, blockedSources) {
  if (diagnostic.source) return blockedSources.has(normalizePath(diagnostic.source));
  if (Array.isArray(diagnostic.sources) && diagnostic.sources.length > 0) {
    return diagnostic.sources.every((source) => blockedSources.has(normalizePath(source)));
  }
  return false;
}

function importPayloadFor(step, entry) {
  const normalizedEntry = entry ? clone(entry) : {};
  const output = normalizePath(step.output || normalizedEntry.output?.path || '');
  return {
    source: step.source,
    action: step.action,
    output,
    importer: normalizedEntry.importer || '',
    preset: normalizedEntry.preset || null,
    settings: clone(normalizedEntry.settings || {}),
    reimport: clone(normalizedEntry.reimport || {}),
    step: clone(step),
    entry: normalizedEntry
  };
}

function outputsForImported(payload, imported) {
  if (Array.isArray(imported?.outputs)) {
    return imported.outputs.map((output) => ({
      path: normalizePath(output.path || output.output || payload.output),
      value: output.value ?? output.bytes ?? output.data ?? output.asset ?? imported
    }));
  }
  return [
    {
      path: payload.output,
      value: imported?.value ?? imported?.bytes ?? imported?.data ?? imported?.asset ?? imported
    }
  ];
}

function metadataPayloadFor(payload, imported) {
  return {
    source: payload.source,
    output: payload.output,
    action: payload.action,
    importer: payload.importer,
    preset: payload.preset,
    settings: clone(payload.settings),
    reimport: clone(payload.reimport),
    metadata: clone(imported?.metadata || {})
  };
}

function skippedResult(step) {
  return {
    status: 'skipped',
    source: step.source,
    action: 'unchanged',
    reason: step.reason || 'unchanged',
    step: clone(step)
  };
}

function blockedResult(step, reason) {
  return {
    status: 'blocked',
    source: step.source,
    action: step.action,
    output: step.output,
    reason,
    step: clone(step)
  };
}

function blockedStepFailure(step) {
  return {
    phase: 'blocked',
    source: step.source,
    reason: step.reason,
    message: `Blocked import step: ${step.reason}`,
    step: clone({
      type: 'blocked',
      source: step.source,
      reason: step.reason
    })
  };
}

function failedImportResult(step, phase, message) {
  const failure = failureForStep(step, phase, message);
  return {
    result: failedResultBase(step, phase),
    failure,
    applied: [],
    metadata: null,
    editorEvent: null
  };
}

function failedResultBase(step, phase) {
  return {
    status: 'failed',
    source: step.source,
    action: step.action,
    output: step.output,
    phase,
    step: clone(step)
  };
}

function failureForStep(step, phase, message) {
  return {
    phase,
    source: step.source,
    output: step.output,
    action: step.action,
    message,
    step: clone(step)
  };
}

function summarize({
  preview,
  results,
  failures,
  metadataResults,
  editorEvents,
  rollbackResults
}) {
  const failedCount = failures.length;
  return {
    ok: failedCount === 0,
    stepCount: preview.steps.length,
    importedCount: results.filter((result) => result.status === 'imported').length,
    skippedCount: results.filter((result) => result.status === 'skipped').length,
    blockedCount: results.filter((result) => result.status === 'blocked').length,
    failedCount,
    metadataCount: metadataResults.filter(Boolean).length,
    eventCount: editorEvents.filter(Boolean).length,
    rolledBack: rollbackResults.some((result) => result.status === 'rolled-back'),
    rollbackCount: rollbackResults.filter((result) => result.status === 'rolled-back').length
  };
}

function eventTypeForAction(action) {
  if (action === 'update') return 'asset:updated';
  return 'asset:imported';
}

function importedSummary(imported) {
  return {
    outputCount: Array.isArray(imported?.outputs) ? imported.outputs.length : 1,
    metadata: clone(imported?.metadata || {})
  };
}

function resolveFunction(target, methodName) {
  if (typeof target === 'function') return target;
  if (typeof target?.[methodName] === 'function') return target[methodName].bind(target);
  return null;
}

function errorMessage(error) {
  return error?.message ? String(error.message) : String(error);
}

function normalizePath(value) {
  return String(value || '').replace(/\\/gu, '/').replace(/\/+/gu, '/').toLowerCase();
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

export default AssetImportTransaction;
