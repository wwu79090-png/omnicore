import { createOmniError } from '../core/OmniError.js';
import AssetDependencyTracker from './AssetDependencyTracker.js';
import AssetImportPreview from './AssetImportPreview.js';
import AssetImportTransaction from './AssetImportTransaction.js';
import AssetRegistryChangeSet from './AssetRegistryChangeSet.js';

export const ASSET_IMPORT_SESSION_REPORT_SCHEMA = 'omnicore.asset-import-session-report.v1';

export class AssetImportSession {
  constructor({
    profile = null,
    current = [],
    registry = null,
    importer = null,
    writer = null,
    metadataStore = null,
    editorBus = null,
    onEditorEvent = null,
    rollback = null,
    transaction = null,
    dependencyTracker = null,
    refreshCoordinator = null,
    logger = null
  } = {}) {
    this.profile = profile;
    this.current = normalizeArray(current).map(clone);
    this.registry = registry;
    this.importer = importer;
    this.writer = writer;
    this.metadataStore = metadataStore;
    this.editorBus = editorBus;
    this.onEditorEvent = onEditorEvent;
    this.rollback = rollback;
    this.transaction = transaction;
    this.dependencyTracker = dependencyTracker;
    this.refreshCoordinator = refreshCoordinator;
    this.logger = logger;
  }

  static create(config = {}) {
    return new AssetImportSession(config);
  }

  static crossEngineProfile() {
    return {
      sources: [
        'Unity AssetDatabase refresh sessions',
        'Godot EditorFileSystem import loop',
        'Unreal Interchange pipeline import sessions',
        'Cocos Creator AssetDB refresh',
        'PixiJS texture upload refresh'
      ],
      capabilities: [
        'import-session-orchestration',
        'one-click-reimport-refresh',
        'dependency-refresh-plan',
        'editor-runtime-refresh-bridge',
        'dry-run-import-plan',
        'failure-propagation-with-rollback'
      ]
    };
  }

  crossEngineProfile() {
    return AssetImportSession.crossEngineProfile();
  }

  async run(assets = [], {
    apply = true,
    refresh = true,
    current = this.current,
    transactionOptions = {},
    trackDependencies = false,
    dependencyChanges = null,
    dependencyOptions = {},
    refreshOptions = {},
    ...previewOptions
  } = {}) {
    if (!this.profile) {
      throw createOmniError('AssetImportSession', 'AssetImportSession requires an import profile.');
    }

    const preview = new AssetImportPreview({
      profile: this.profile,
      current
    }).preview(assets, previewOptions);

    if (!apply) {
      return this._report({
        preview,
        transaction: null,
        changePlan: null,
        refreshReport: null,
        failures: [],
        dryRun: true
      });
    }

    const transaction = await this._transaction().apply(preview, transactionOptions);
    let changePlan = null;
    let dependencyReport = null;
    let refreshReport = null;
    const failures = [...normalizeArray(transaction.failures).map(clone)];

    if (transaction.ok) {
      changePlan = this._buildChangePlan(preview, transaction);
      if (trackDependencies) {
        dependencyReport = this._analyzeDependencies({
          preview,
          dependencyChanges,
          dependencyOptions
        });
      }
      if (refresh && this.refreshCoordinator && shouldRefresh(changePlan)) {
        const refreshResult = await this._applyRefresh(changePlan, refreshOptions);
        refreshReport = refreshResult.report;
        failures.push(...refreshResult.failures);
      }
    }

    return this._report({
      preview,
      transaction,
      changePlan,
      dependencyReport,
      refreshReport,
      failures,
      dryRun: false
    });
  }

  _transaction() {
    if (this.transaction) return this.transaction;
    return new AssetImportTransaction({
      importer: this.importer,
      writer: this.writer,
      metadataStore: this.metadataStore,
      editorBus: this.editorBus,
      onEditorEvent: this.onEditorEvent,
      rollback: this.rollback,
      logger: this.logger
    });
  }

  _buildChangePlan(preview, transaction) {
    const entryBySource = new Map(preview.entries.map((entry) => [entry.source, entry]));
    const changeSet = new AssetRegistryChangeSet({
      registry: this.registry,
      source: 'asset-import-session'
    });

    for (const result of transaction.results || []) {
      if (result.status !== 'imported') continue;
      const entry = entryBySource.get(result.source) || {};
      const reference = registryReferenceFor(entry, result);
      const kind = result.action === 'update' || this.registry?.resolve?.(reference) ? 'modified' : 'imported';

      if (kind === 'modified') {
        changeSet.record({ kind, reference });
      } else {
        changeSet.record({
          kind,
          asset: importedAssetFor(entry, result, reference)
        });
      }
    }

    return changeSet.plan();
  }

  _analyzeDependencies({
    preview,
    dependencyChanges,
    dependencyOptions
  }) {
    const importerVersions = Object.fromEntries(
      preview.entries.map((entry) => [
        entry.importer,
        entry.reimport?.inputs?.importerVersion
      ]).filter(([, version]) => version)
    );
    const platform = preview.entries.find((entry) => entry.platform)?.platform || null;
    const changes = dependencyChanges || preview.entries.map((entry) => ({ path: entry.source }));
    const tracker = this.dependencyTracker || new AssetDependencyTracker({
      registry: this.registry,
      imports: this.current,
      knownInputs: knownInputsForSession(this.current, changes)
    });
    if (!tracker?.analyze) return null;

    return tracker.analyze(changes, {
      platform,
      ...dependencyOptions,
      importerVersions: {
        ...importerVersions,
        ...(dependencyOptions.importerVersions || {})
      }
    });
  }

  async _applyRefresh(changePlan, refreshOptions) {
    try {
      const report = await this.refreshCoordinator.apply(changePlan, refreshOptions);
      const failures = report?.ok === false
        ? normalizeArray(report.failures).map((failure) => ({
          phase: 'refresh',
          message: failure.message || 'Asset refresh failed.',
          failure: clone(failure)
        }))
        : [];
      return { report: clone(report), failures };
    } catch (error) {
      const message = errorMessage(error);
      this.logger?.error?.('AssetImportSession refresh failed', error);
      return {
        report: {
          ok: false,
          failures: [{ phase: 'refresh', message }]
        },
        failures: [{ phase: 'refresh', message }]
      };
    }
  }

  _report({
    preview,
    transaction,
    changePlan,
    dependencyReport,
    refreshReport,
    failures,
    dryRun
  }) {
    const summary = summarize({
      preview,
      transaction,
      changePlan,
      dependencyReport,
      refreshReport,
      failures,
      dryRun
    });

    return {
      schema: ASSET_IMPORT_SESSION_REPORT_SCHEMA,
      ok: summary.ok,
      summary,
      preview,
      transaction,
      changePlan,
      dependencyReport,
      refreshReport,
      failures,
      crossEngineProfile: this.crossEngineProfile()
    };
  }
}

function summarize({
  preview,
  transaction,
  changePlan,
  dependencyReport,
  refreshReport,
  failures,
  dryRun
}) {
  const transactionSummary = transaction?.summary || {};
  const refreshOk = refreshReport ? Boolean(refreshReport.ok) : null;
  const dependencyOk = dependencyReport ? Boolean(dependencyReport.ok) : null;
  const ok = dryRun
    ? Boolean(preview.summary?.ok)
    : Boolean(transaction?.ok) && (dependencyOk !== false) && (refreshOk !== false) && failures.length === 0;

  return {
    ok,
    dryRun,
    assetCount: Number(preview.summary?.assetCount || 0),
    previewOk: Boolean(preview.summary?.ok),
    transactionOk: transaction ? Boolean(transaction.ok) : null,
    refreshOk,
    plannedImportCount: preview.steps.filter((step) => step.type === 'import').length,
    importedCount: Number(transactionSummary.importedCount || 0),
    skippedCount: Number(transactionSummary.skippedCount || 0),
    blockedCount: Number(transactionSummary.blockedCount || 0),
    failedCount: failures.length,
    runtimeActionCount: Number(changePlan?.runtimeActions?.length || 0),
    editorEventCount: Number(changePlan?.editorEvents?.length || 0),
    dependencyStaleCount: Number(dependencyReport?.summary?.staleImportCount || 0),
    dependencyMissingCount: Number(dependencyReport?.summary?.missingDependencyCount || 0)
  };
}

function registryReferenceFor(entry, result) {
  return normalizeRef(
    entry.current?.registryReference
    || entry.current?.address
    || entry.current?.primaryId
    || entry.current?.asset
    || entry.registryReference
    || entry.address
    || result.output
    || entry.output?.path
    || result.source
  );
}

function importedAssetFor(entry, result, reference) {
  const output = normalizePath(result.output || entry.output?.path || result.source);
  return {
    uid: entry.current?.uid || entry.uid || `uid://imported/${normalizePath(result.source)}`,
    primaryId: entry.current?.primaryId || entry.primaryId || null,
    address: reference,
    path: output,
    type: typeForImporter(entry.importer || result.importer || output),
    bundle: entry.output?.bundle || entry.current?.bundle || 'default',
    dependencies: normalizeArray(entry.reimport?.inputs?.dependencies || entry.current?.dependencies).map(normalizeRef)
  };
}

function knownInputsForSession(current, changes) {
  const inputs = [];
  for (const record of normalizeArray(current)) {
    inputs.push(record.source, record.path);
    inputs.push(...normalizeArray(record.reimport?.inputs?.dependencies));
    inputs.push(...normalizeArray(record.reimport?.inputs?.dynamicDependencies));
    inputs.push(...normalizeArray(record.dynamicDependencies));
    inputs.push(...normalizeArray(record.dependencies));
  }
  for (const change of normalizeArray(changes)) {
    inputs.push(typeof change === 'string' ? change : change.path || change.source || change.asset);
  }
  return inputs.filter(Boolean).map(normalizeRef);
}

function shouldRefresh(changePlan) {
  return Boolean(
    changePlan
    && (
      normalizeArray(changePlan.runtimeActions).length > 0
      || normalizeArray(changePlan.editorEvents).length > 0
    )
  );
}

function typeForImporter(value) {
  const text = normalizeRef(value);
  if (text === 'texture' || /\.(png|jpg|jpeg|webp|gif|svg)$/iu.test(text)) return 'Texture';
  if (text === 'audio' || /\.(mp3|ogg|wav|m4a)$/iu.test(text)) return 'Audio';
  if (text === 'model' || /\.(glb|gltf|fbx|obj|blend)$/iu.test(text)) return 'Model';
  if (text === 'data' || /\.(json|csv|tmx|xml)$/iu.test(text)) return 'Data';
  if (text === 'font' || /\.(ttf|otf|woff|woff2)$/iu.test(text)) return 'Font';
  return 'Asset';
}

function errorMessage(error) {
  return error?.message ? String(error.message) : String(error);
}

function normalizePath(value) {
  return String(value || '')
    .trim()
    .replace(/\\/gu, '/')
    .replace(/\/+/gu, '/')
    .toLowerCase();
}

function normalizeRef(value) {
  return normalizePath(value).replace(/^\/+/u, '');
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

export default AssetImportSession;
