#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function createAssetWatchServer({
  source = 'source-assets',
  debounceMs = 100,
  converter = defaultConverter,
  changePlanner = null,
  websocket = null,
  editorSync = null
} = {}) {
  const state = {
    source: path.resolve(source),
    debounceMs,
    converter,
    changePlanner,
    websocket,
    editorSync,
    pending: new Set(),
    timer: null,
    watcher: null
  };

  return {
    get debounceMs() {
      return state.debounceMs;
    },
    recordChange(file) {
      state.pending.add(normalizePath(file));
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(() => this.flushPending(), state.debounceMs);
    },
    async flushPending() {
      if (state.timer) clearTimeout(state.timer);
      state.timer = null;
      const files = [...state.pending];
      state.pending.clear();
      if (!files.length) return { files: [], conversions: [] };
      const conversions = await state.converter(files);
      const changePlan = typeof state.changePlanner === 'function'
        ? await state.changePlanner({ files, conversions, source: state.source })
        : null;
      const payload = {
        type: 'assets:hot-update',
        source: state.source,
        files,
        conversions,
        incremental: true,
        targetMs: 200,
        changedCount: files.length,
        pushedAt: new Date().toISOString()
      };
      if (changePlan) payload.changePlan = changePlan;
      const editorRefresh = createEditorAssetWatchRefresh({
        source: state.source,
        files,
        conversions,
        changePlan,
        pushedAt: payload.pushedAt
      });
      payload.editorRefresh = editorRefresh;
      state.websocket?.send?.(JSON.stringify(payload));
      state.editorSync?.send?.(JSON.stringify(createEditorAssetWatchMessage(editorRefresh)));
      return payload;
    },
    start() {
      fs.mkdirSync(state.source, { recursive: true });
      state.watcher = fs.watch(state.source, { recursive: true }, (_event, file) => {
        if (file) this.recordChange(file);
      });
      return this;
    },
    close() {
      if (state.timer) clearTimeout(state.timer);
      state.watcher?.close?.();
      state.timer = null;
      state.watcher = null;
    }
  };
}

function defaultConverter(files) {
  return files.map((file) => ({
    file,
    output: file
      .replace(/\.(png|jpe?g)$/iu, '.webp')
      .replace(/\.(mp3|wav)$/iu, '.ogg')
      .replace(/\.aseprite$/iu, '.json')
  }));
}

function normalizePath(file) {
  return String(file).replace(/\\/g, '/');
}

function createEditorAssetWatchRefresh({
  source,
  files = [],
  conversions = [],
  changePlan = null,
  pushedAt = new Date().toISOString()
} = {}) {
  const normalizedFiles = uniqueStrings(files.map(normalizePath));
  const plan = changePlan || createFallbackChangePlan(normalizedFiles, source);
  const hmrFiles = collectHmrFiles(plan, normalizedFiles);
  const assetChanges = deriveAssetChanges(plan, normalizedFiles);
  const hmrPayload = {
    type: 'assets:hot-update',
    source,
    files: hmrFiles,
    conversions: conversions.map((conversion) => ({ ...conversion })),
    incremental: true,
    targetMs: 200,
    changedCount: normalizedFiles.length,
    pushedAt,
    changePlan: plan,
    runtimeActions: Array.isArray(plan.runtimeActions) ? plan.runtimeActions.map((action) => ({ ...action })) : [],
    editorEvents: Array.isArray(plan.editorEvents) ? plan.editorEvents.map((event) => ({ ...event })) : []
  };
  return {
    schema: 'omnicore.editor-asset-watch-refresh.v1',
    source,
    files: normalizedFiles,
    conversions: hmrPayload.conversions,
    changedAt: pushedAt,
    assetChanges,
    assetRefresh: {
      schema: 'omnicore.editor-asset-refresh.v1',
      source: plan.summary?.source || 'asset-watch-server',
      changedAt: pushedAt,
      changes: assetChanges,
      plan,
      hmrPayload
    },
    hotReload: {
      ok: true,
      compiledAt: pushedAt,
      changedFiles: hmrFiles,
      hotReloadManifest: hmrPayload,
      hmrPayload
    },
    events: createEditorHotReloadEvents(plan, hmrPayload, pushedAt)
  };
}

function createEditorAssetWatchMessage(editorRefresh) {
  return {
    type: 'editor:asset-watch-refresh',
    payload: editorRefresh,
    meta: {
      sentAt: editorRefresh.changedAt || new Date().toISOString(),
      source: 'omnicore-asset-watch-server'
    }
  };
}

function createFallbackChangePlan(files = [], source = 'asset-watch-server') {
  const editorEvents = files.map((asset) => ({
    type: 'asset:changed',
    asset,
    kind: 'modified'
  }));
  return {
    schema: 'omnicore.asset-registry-change-plan.v1',
    summary: {
      source: 'asset-watch-server',
      watchRoot: source,
      changeCount: files.length,
      directAssetCount: files.length,
      affectedAssetCount: 0,
      runtimeActionCount: files.length,
      repairActionCount: 0,
      brokenReferenceCount: 0,
      requiresSceneRefresh: false
    },
    directAssets: [...files].sort(),
    affectedAssets: [],
    runtimeActions: files.map((asset) => ({ type: 'reloadAsset', asset, reason: 'modified' })),
    repairActions: [],
    brokenReferences: [],
    editorEvents,
    crossEngineProfile: {
      sources: ['OmniCore Asset Watch Server'],
      capabilities: ['editor-resource-panel-refresh', 'hot-reload-event-stream']
    }
  };
}

function collectHmrFiles(plan = {}, files = []) {
  return uniqueStrings([
    ...files,
    ...(Array.isArray(plan.directAssets) ? plan.directAssets : []),
    ...(Array.isArray(plan.runtimeActions) ? plan.runtimeActions.map((action) => action.asset) : [])
  ]).sort();
}

function deriveAssetChanges(plan = {}, files = []) {
  const changes = [];
  const seen = new Set();
  for (const event of plan.editorEvents || []) {
    const asset = normalizePath(event.asset || event.to || event.from || '');
    if (!asset || seen.has(asset)) continue;
    seen.add(asset);
    const kind = event.type === 'asset:imported'
      ? 'imported'
      : event.type === 'asset:moved'
        ? 'moved'
        : event.type === 'asset:deleted'
          ? 'deleted'
          : 'modified';
    changes.push({
      kind,
      asset,
      reference: asset,
      from: event.from || null,
      to: event.to || null,
      rawAsset: kind === 'imported'
        ? { path: asset, type: inferAssetType(asset), imported: true }
        : null
    });
  }
  for (const file of files) {
    const asset = normalizePath(file);
    if (!asset || seen.has(asset)) continue;
    seen.add(asset);
    changes.push({
      kind: 'modified',
      asset,
      reference: asset,
      from: null,
      to: null,
      rawAsset: null
    });
  }
  return changes;
}

function createEditorHotReloadEvents(plan = {}, hmrPayload = {}, pushedAt = new Date().toISOString()) {
  const at = Date.parse(pushedAt);
  const source = plan.summary?.source || 'asset-watch-server';
  const editorEvents = (plan.editorEvents || []).map((event, index) => ({
    id: index + 1,
    source,
    at,
    incremental: true,
    ...event
  }));
  return [
    ...editorEvents,
    {
      id: editorEvents.length + 1,
      source,
      at,
      type: 'assets:hot-update',
      incremental: true,
      files: [...hmrPayload.files],
      runtimeActions: hmrPayload.runtimeActions.map((action) => ({ ...action })),
      editorEvents: hmrPayload.editorEvents.map((event) => ({ ...event })),
      changePlan: hmrPayload.changePlan
    }
  ];
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function inferAssetType(file = '') {
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/iu.test(file)) return 'image';
  if (/\.(mp3|wav|ogg|m4a)$/iu.test(file)) return 'audio';
  if (/\.(glb|gltf|fbx|obj)$/iu.test(file)) return 'model';
  if (/(^|\/)prefabs\/.+\.json$/iu.test(file)) return 'prefab';
  if (/(^|\/)scenes\/.+\.json$/iu.test(file) || /\.scene\.json$/iu.test(file)) return 'scene';
  if (/\.json$/iu.test(file)) return 'json';
  return 'file';
}

function parseArgs(argv) {
  const options = {
    source: 'source-assets',
    debounceMs: 100,
    once: false,
    files: [],
    out: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source') {
      index += 1;
      options.source = argv[index];
    } else if (arg === '--debounce') {
      index += 1;
      options.debounceMs = Number(argv[index]);
    } else if (arg === '--once') {
      options.once = true;
    } else if (arg === '--file') {
      index += 1;
      options.files.push(argv[index]);
    } else if (arg === '--out') {
      index += 1;
      options.out = argv[index];
    }
  }
  return options;
}

function writeReport(file, payload) {
  if (!file) return;
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const options = parseArgs(process.argv.slice(2));
  const server = createAssetWatchServer({
    source: options.source,
    debounceMs: Number.isFinite(options.debounceMs) && options.debounceMs >= 0 ? options.debounceMs : 100
  });

  if (options.once) {
    for (const file of options.files) server.recordChange(file);
    const report = await server.flushPending();
    writeReport(options.out, report);
    console.log(JSON.stringify(report, null, 2));
    server.close();
  } else {
    server.start();
    console.log(`[OmniCore] watching ${path.resolve(options.source)} for source asset changes`);
    const close = () => {
      server.close();
      process.exit(0);
    };
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
  }
}

export default createAssetWatchServer;
