const DEFAULT_MAX_STEPS = 256;

export class AssetRegistry {
  constructor({ assets = [] } = {}) {
    this.assets = assets.map(normalizeAsset);
    this.indices = buildAssetIndices(this.assets);
  }

  static create(config = {}) {
    return new AssetRegistry(config);
  }

  static crossEngineProfile() {
    return {
      sources: [
        'Unreal Asset Registry',
        'Unity AssetDatabase',
        'Godot ResourceLoader',
        'Cocos Creator AssetDB'
      ],
      capabilities: [
        'unloaded-asset-search',
        'stable-uid-resolution',
        'recursive-dependency-query',
        'reverse-reference-query',
        'missing-reference-audit',
        'meta-guid-conflict-audit',
        'move-rename-repair-plan'
      ]
    };
  }

  crossEngineProfile() {
    return AssetRegistry.crossEngineProfile();
  }

  resolve(reference) {
    const match = this.#resolveDetailed(reference);
    return match ? clone(match.asset) : null;
  }

  query({
    type = null,
    labels = [],
    tags = {},
    pathPrefix = '',
    bundle = null,
    packageName = null,
    unloadedOnly = false,
    loaded = null
  } = {}) {
    const normalizedLabels = normalizeArray(labels).map(normalizeRef);
    const normalizedTags = normalizeTags(tags);
    const normalizedType = type ? normalizeType(type) : null;
    const normalizedBundle = bundle ? normalizeRef(bundle) : null;
    const normalizedPackage = packageName ? normalizeRef(packageName) : null;
    const normalizedPathPrefix = normalizePath(pathPrefix);
    return this.assets
      .filter((asset) => {
        if (normalizedType && normalizeType(asset.type) !== normalizedType) return false;
        if (normalizedBundle && asset.bundle !== normalizedBundle) return false;
        if (normalizedPackage && asset.packageName !== normalizedPackage) return false;
        if (unloadedOnly && asset.loaded) return false;
        if (loaded != null && asset.loaded !== Boolean(loaded)) return false;
        if (normalizedPathPrefix && !asset.path.startsWith(normalizedPathPrefix)) return false;
        if (normalizedLabels.length && !normalizedLabels.every((label) => asset.labels.includes(label))) return false;
        return Object.entries(normalizedTags).every(([key, value]) => asset.tags[key] === value);
      })
      .map(clone);
  }

  getDependencies(reference, { recursive = false, includeMissing = false } = {}) {
    const root = this.#resolveDetailed(reference);
    if (!root) {
      return includeMissing ? [{ asset: normalizeRef(reference), missing: true, depth: 0, via: null }] : [];
    }
    const result = [];
    const visitedAssets = new Set();
    const visitedMissing = new Set();
    const walk = (asset, depth) => {
      for (const dependencyRef of asset.dependencies) {
        const resolved = this.#resolveDetailed(dependencyRef);
        if (!resolved) {
          if (includeMissing) {
            const missingKey = `${asset.key}:${dependencyRef}`;
            if (!visitedMissing.has(missingKey)) {
              visitedMissing.add(missingKey);
              result.push({ asset: dependencyRef, missing: true, depth: depth + 1, via: asset.key });
            }
          }
          continue;
        }
        const dependency = resolved.asset;
        if (visitedAssets.has(dependency.key)) continue;
        visitedAssets.add(dependency.key);
        result.push({
          asset: dependency.key,
          reference: dependencyRef,
          resolvedBy: resolved.resolvedBy,
          missing: false,
          depth: depth + 1,
          via: asset.key
        });
        if (recursive) walk(dependency, depth + 1);
      }
    };
    walk(root.asset, 0);
    return result.map(clone);
  }

  getReferencers(reference, { recursive = false } = {}) {
    const target = this.#resolveDetailed(reference);
    if (!target) return [];
    const reverse = this.#reverseDependencyMap();
    const result = [];
    const visited = new Set();
    const walk = (asset, depth) => {
      for (const referencer of reverse.get(asset.key) || []) {
        if (visited.has(referencer.source.key)) continue;
        visited.add(referencer.source.key);
        result.push({
          asset: referencer.source.key,
          reference: referencer.reference,
          depth: depth + 1,
          via: asset.key
        });
        if (recursive) walk(referencer.source, depth + 1);
      }
    };
    walk(target.asset, 0);
    return result.map(clone);
  }

  planMove(reference, nextPath) {
    const resolved = this.#resolveDetailed(reference);
    if (!resolved) return null;
    const { asset } = resolved;
    const stableUid = asset.uid || normalizeRef(reference);
    const affected = this.getReferencers(asset.key, { recursive: false });
    return {
      asset: asset.key,
      from: asset.path,
      to: normalizePath(nextPath),
      stableUid,
      affectedAssets: affected.map((edge) => edge.asset).sort(),
      rewriteActions: affected.map((edge) => ({
        type: 'rewriteDependency',
        source: edge.asset,
        from: edge.reference,
        to: stableUid
      }))
    };
  }

  audit({ entrypoints = [] } = {}) {
    const missingReferences = this.assets.flatMap((asset) => asset.dependencies
      .filter((reference) => !this.#resolveDetailed(reference))
      .map((reference) => ({
        asset: reference,
        reference,
        source: asset.key,
        via: asset.key,
        missing: true,
        severity: 'error'
      })));
    const duplicateUids = [...this.indices.byUid.entries()]
      .filter(([uid, assets]) => uid && assets.length > 1)
      .map(([uid, assets]) => ({ uid, assets: assets.map((asset) => asset.key).sort(), severity: 'error' }));
    const reachable = this.#reachableAssets(entrypoints);
    const orphanAssets = this.assets
      .filter((asset) => reachable.size > 0 && !reachable.has(asset.key))
      .map((asset) => asset.key)
      .sort();
    const cycles = this.#detectCycles();
    return {
      schema: 'omnicore.asset-registry-audit.v1',
      summary: {
        assetCount: this.assets.length,
        missingReferenceCount: missingReferences.length,
        duplicateUidCount: duplicateUids.length,
        orphanAssetCount: orphanAssets.length,
        cycleCount: cycles.length,
        ready: missingReferences.length === 0 && duplicateUids.length === 0 && cycles.length === 0
      },
      missingReferences,
      duplicateUids,
      orphanAssets,
      cycles,
      crossEngineProfile: this.crossEngineProfile()
    };
  }

  snapshot() {
    return {
      schema: 'omnicore.asset-registry-snapshot.v1',
      assets: this.assets.map(clone),
      dependencies: Object.fromEntries(
        this.assets.map((asset) => [asset.key, this.getDependencies(asset.key, { includeMissing: true })])
      ),
      referencers: Object.fromEntries(
        this.assets.map((asset) => [asset.key, this.getReferencers(asset.key)])
      )
    };
  }

  #resolveDetailed(reference) {
    const key = normalizeRef(reference);
    const lookups = [
      ['uid', this.indices.byUid],
      ['primaryId', this.indices.byPrimaryId],
      ['address', this.indices.byAddress],
      ['path', this.indices.byPath],
      ['id', this.indices.byId],
      ['key', this.indices.byKey]
    ];
    for (const [resolvedBy, index] of lookups) {
      const assets = index.get(key);
      if (assets?.length) return { asset: assets[0], resolvedBy };
    }
    return null;
  }

  #reverseDependencyMap() {
    const reverse = new Map();
    for (const asset of this.assets) {
      for (const reference of asset.dependencies) {
        const resolved = this.#resolveDetailed(reference);
        if (!resolved) continue;
        if (!reverse.has(resolved.asset.key)) reverse.set(resolved.asset.key, []);
        reverse.get(resolved.asset.key).push({ source: asset, reference });
      }
    }
    return reverse;
  }

  #reachableAssets(entrypoints = []) {
    const seeds = normalizeArray(entrypoints)
      .map((entrypoint) => this.#resolveDetailed(entrypoint)?.asset)
      .filter(Boolean);
    const reachable = new Set();
    const walk = (asset) => {
      if (!asset || reachable.has(asset.key)) return;
      reachable.add(asset.key);
      this.getDependencies(asset.key).forEach((edge) => walk(this.#resolveDetailed(edge.asset)?.asset));
    };
    seeds.forEach(walk);
    return reachable;
  }

  #detectCycles() {
    const cycles = [];
    const visiting = new Set();
    const visited = new Set();
    const walk = (asset, stack = []) => {
      if (!asset || visited.has(asset.key)) return;
      if (visiting.has(asset.key)) {
        const start = stack.indexOf(asset.key);
        cycles.push({ path: [...stack.slice(Math.max(0, start)), asset.key], severity: 'warning' });
        return;
      }
      visiting.add(asset.key);
      for (const edge of this.getDependencies(asset.key)) walk(this.#resolveDetailed(edge.asset)?.asset, [...stack, asset.key]);
      visiting.delete(asset.key);
      visited.add(asset.key);
    };
    this.assets.forEach((asset) => walk(asset));
    return cycles;
  }
}

export class AssetRegistryChangeSet {
  constructor({ registry, source = 'asset-change-session', changes = [] } = {}) {
    this.registry = registry;
    this.source = String(source || 'asset-change-session');
    this.changes = [];
    changes.forEach((change) => this.record(change));
  }

  static create(config = {}) {
    return new AssetRegistryChangeSet(config);
  }

  static crossEngineProfile() {
    return {
      sources: [
        'Unity AssetPostprocessor',
        'Unreal Asset Registry',
        'Godot EditorFileSystem',
        'Cocos Creator AssetDB'
      ],
      capabilities: [
        'asset-import-finished-session',
        'filesystem-change-signal',
        'dependency-aware-refresh',
        'reverse-reference-invalidation',
        'rename-repair-actions',
        'editor-browser-events'
      ]
    };
  }

  crossEngineProfile() {
    return AssetRegistryChangeSet.crossEngineProfile();
  }

  record(change = {}) {
    const normalized = normalizeAssetChange(change, this.registry);
    this.changes.push(normalized);
    return normalized;
  }

  clear() {
    this.changes = [];
  }

  plan() {
    const directAssets = new Set();
    const affectedAssets = new Set();
    const directRuntimeActions = [];
    const dependencyRuntimeActions = [];
    const repairActions = [];
    const brokenReferences = [];
    const editorEvents = [];
    for (const change of this.changes) {
      if (change.asset) directAssets.add(change.asset);
      editorEvents.push(toEditorEvent(change));
      const directAction = toRuntimeAction(change);
      if (directAction) directRuntimeActions.push(directAction);
      if (change.kind === 'modified') {
        for (const edge of this.#referencers(change.asset, { recursive: true })) {
          affectedAssets.add(edge.asset);
          dependencyRuntimeActions.push({ type: 'refreshAsset', asset: edge.asset, reason: `depends-on:${change.asset}` });
        }
      }
      if (change.kind === 'moved') {
        const movePlan = this.registry?.planMove?.(change.asset, change.to) || null;
        for (const action of movePlan?.rewriteActions || []) repairActions.push(action);
        for (const edge of this.#referencers(change.asset)) {
          affectedAssets.add(edge.asset);
          dependencyRuntimeActions.push({ type: 'refreshAsset', asset: edge.asset, reason: `depends-on:${change.asset}` });
        }
      }
      if (change.kind === 'deleted') {
        for (const edge of this.#referencers(change.asset, { recursive: true })) {
          brokenReferences.push({ source: edge.asset, missingAsset: change.asset, reason: 'deleted' });
        }
      }
    }
    const affected = [...affectedAssets].sort();
    return {
      schema: 'omnicore.asset-registry-change-plan.v1',
      summary: {
        source: this.source,
        changeCount: this.changes.length,
        directAssetCount: directAssets.size,
        affectedAssetCount: affected.length,
        runtimeActionCount: dedupeObjects([...directRuntimeActions, ...dependencyRuntimeActions]).length,
        repairActionCount: dedupeObjects(repairActions).length,
        brokenReferenceCount: dedupeObjects(brokenReferences).length,
        requiresSceneRefresh: affected.some((asset) => this.#assetType(asset) === 'Scene')
      },
      directAssets: [...directAssets].sort(),
      affectedAssets: affected,
      runtimeActions: dedupeObjects([...directRuntimeActions, ...dependencyRuntimeActions]),
      repairActions: dedupeObjects(repairActions),
      brokenReferences: dedupeObjects(brokenReferences),
      editorEvents: dedupeObjects(editorEvents),
      crossEngineProfile: this.crossEngineProfile()
    };
  }

  #referencers(asset, options) {
    if (!asset || !this.registry?.getReferencers) return [];
    return this.registry.getReferencers(asset, options);
  }

  #assetType(asset) {
    return this.registry?.resolve?.(asset)?.type || null;
  }
}

export class BatchAtlasDiagnostics {
  constructor({
    frameBudgetMs = 16.67,
    drawCallBudget = 256,
    textureUploadBudget = 8,
    textureUploadByteBudget = Number.POSITIVE_INFINITY,
    filterPassBudget = 6
  } = {}) {
    this.frameBudgetMs = positiveNumber(frameBudgetMs, 16.67);
    this.drawCallBudget = positiveNumber(drawCallBudget, 256);
    this.textureUploadBudget = positiveNumber(textureUploadBudget, 8);
    this.textureUploadByteBudget = positiveNumber(textureUploadByteBudget, Number.POSITIVE_INFINITY);
    this.filterPassBudget = positiveNumber(filterPassBudget, 6);
  }

  analyze(draws = []) {
    const normalized = normalizeArray(draws).map(normalizeRenderDraw);
    const batchBreaks = [];

    for (let index = 1; index < normalized.length; index += 1) {
      const previous = normalized[index - 1];
      const current = normalized[index];
      const reason = detectRenderBatchBreak(previous, current);
      if (reason) {
        batchBreaks.push({
          from: previous.id,
          to: current.id,
          reason
        });
      }
    }
    for (const draw of normalized.filter((entry) => entry.dynamic)) {
      batchBreaks.push({ from: draw.id, to: draw.id, reason: 'dynamic-sprite' });
    }

    const atlasCandidates = buildRenderAtlasCandidates(normalized);
    const predictedDrawCallsAfter = Math.max(1, normalized.length - Math.min(1, atlasCandidates.length));
    return {
      drawCallsBefore: normalized.length,
      predictedDrawCallsAfter,
      materialSwitches: batchBreaks.length,
      batchBreaks,
      atlasCandidates,
      recommendations: buildRenderBatchRecommendations({ atlasCandidates, materialSwitches: batchBreaks.length, normalized })
    };
  }

  createFrameBudgetReport({
    frame = {},
    backend = {},
    draws = [],
    textureUploads = [],
    filterPasses = []
  } = {}) {
    const batch = this.analyze(draws);
    const normalizedFrame = normalizeRenderFrame(frame);
    const uploads = normalizeRenderTextureUploads(textureUploads);
    const filters = normalizeRenderFilterPasses(filterPasses);
    const backendReport = normalizeRenderBackendReport(backend);
    const issues = buildRenderFrameBudgetIssues({
      frame: normalizedFrame,
      batch,
      uploads,
      filters,
      backend: backendReport,
      budgets: this
    });
    const recommendations = buildRenderFrameBudgetRecommendations({
      batch,
      issues,
      backend: backendReport
    });
    const severity = summarizeRenderSeverity(issues);
    return {
      schema: 'omnicore.render-frame-budget-report.v1',
      summary: {
        frameIndex: normalizedFrame.index,
        fps: normalizedFrame.fps,
        cpuMs: normalizedFrame.cpuMs,
        gpuMs: normalizedFrame.gpuMs,
        frameBudgetMs: this.frameBudgetMs,
        overBudget: severity !== 'ok',
        severity,
        drawCallsBefore: batch.drawCallsBefore,
        predictedDrawCallsAfter: batch.predictedDrawCallsAfter,
        textureUploadCount: uploads.length,
        textureUploadBytes: uploads.reduce((sum, upload) => sum + upload.bytes, 0),
        filterPassCount: filters.reduce((sum, filter) => sum + filter.passes, 0),
        filterMs: roundMetric(filters.reduce((sum, filter) => sum + filter.estimatedMs, 0)),
        backend: backendReport.selected
      },
      batch,
      textureUploads: uploads,
      filterPasses: filters,
      backend: backendReport,
      issues,
      recommendations,
      editorPanels: [
        'frame-budget',
        'batch-breaks',
        'texture-uploads',
        'filter-costs',
        'backend-fallback'
      ],
      crossEngineProfile: createRenderFrameBudgetCrossEngineProfile()
    };
  }
}

export class VisualScriptGraphRuntime {
  constructor({
    graph = {},
    actions = {},
    signals = null,
    maxSteps = DEFAULT_MAX_STEPS
  } = {}) {
    this.graph = normalizeGraph(graph);
    this.actions = { ...actions };
    this.signals = signals;
    this.maxSteps = Number.isFinite(maxSteps) ? maxSteps : DEFAULT_MAX_STEPS;
    this.variables = clone(graph.variables || {});
    this.nodes = new Map(this.graph.nodes.map((node) => [node.id, node]));
    this.edges = [...this.graph.edges];
  }

  static crossEngineProfile() {
    return {
      sources: [
        { engine: 'Unreal Blueprint', advantage: 'event-entry execution graphs, branch pins, and debug traces' },
        { engine: 'Unity Visual Scripting', advantage: 'runtime variables and custom action units' },
        { engine: 'Godot Signals', advantage: 'signal-first decoupled gameplay flow' },
        { engine: 'Construct / GDevelop Event Sheets', advantage: 'beginner-friendly condition/action authoring diagnostics' }
      ],
      localCapabilities: [
        'event-entry-nodes',
        'branch-pins',
        'runtime-variables',
        'custom-action-bindings',
        'signal-emission',
        'authoring-diagnostics',
        'execution-trace'
      ]
    };
  }

  validate() {
    const issues = [];
    const ids = new Set();
    const duplicated = new Set();
    for (const node of this.graph.nodes) {
      if (ids.has(node.id)) duplicated.add(node.id);
      ids.add(node.id);
      if (node.type === 'event' && !node.event) issues.push(issue('missing-event-name', node.id, 'Event entry node is missing an event name.'));
      if (node.type === 'call' && !this.actions[node.action || node.name]) issues.push(issue('missing-action', node.id, `Missing action: ${node.action || node.name || 'unknown'}`));
    }
    for (const id of duplicated) issues.push(issue('duplicate-node', id, `Duplicate node id: ${id}`));
    for (const edge of this.graph.edges) {
      if (!ids.has(edge.from)) issues.push(issue('missing-node', edge.from, `Missing edge source: ${edge.from}`));
      if (!ids.has(edge.to)) issues.push(issue('missing-node', edge.to, `Missing edge target: ${edge.to}`));
    }
    const orderedIssues = issues.sort(compareIssues);
    return {
      ok: orderedIssues.length === 0,
      summary: {
        nodeCount: this.graph.nodes.length,
        edgeCount: this.graph.edges.length,
        eventCount: this.graph.nodes.filter((node) => node.type === 'event').length,
        issueCount: orderedIssues.length
      },
      issues: orderedIssues
    };
  }

  trigger(eventName, payload = {}, options = {}) {
    const trace = [];
    const events = [];
    const startNodes = this.graph.nodes.filter((node) => node.type === 'event' && node.event === eventName);
    const context = { payload, events, trace, options };
    for (const node of startNodes) this.#executeFrom(node.id, context);
    return {
      event: eventName,
      payload,
      variables: clone(this.variables),
      events,
      trace
    };
  }

  get(path) {
    return getPath(this.#state(), path);
  }

  set(path, value) {
    setPath(this.#state(), path, value);
    return value;
  }

  #executeFrom(startNodeId, context) {
    const queue = [{ nodeId: startNodeId, fromPin: null }];
    let steps = 0;
    while (queue.length) {
      steps += 1;
      if (steps > this.maxSteps) {
        context.trace.push({ nodeId: startNodeId, type: 'guard', skipped: true, reason: 'max-steps-exceeded' });
        return;
      }
      const { nodeId } = queue.shift();
      const node = this.nodes.get(nodeId);
      if (!node) {
        context.trace.push({ nodeId, type: 'missing', skipped: true });
        continue;
      }
      const nextPins = this.#executeNode(node, context);
      for (const edge of this.edges.filter((item) => item.from === node.id)) {
        if (shouldFollowEdge(edge, nextPins)) queue.push({ nodeId: edge.to, fromPin: edge.pin || null });
      }
    }
  }

  #executeNode(node, context) {
    switch (node.type) {
      case 'event':
        context.trace.push({ nodeId: node.id, type: node.type, event: node.event });
        return ['out'];
      case 'branch':
      case 'condition': {
        const passed = this.#evaluateCondition(node.condition || node.data || node, context);
        context.trace.push({ nodeId: node.id, type: 'branch', result: passed });
        return [String(Boolean(passed))];
      }
      case 'set': {
        const value = this.#resolve(node.value, context);
        this.set(node.target, value);
        context.trace.push({ nodeId: node.id, type: node.type, target: node.target, value });
        return ['out'];
      }
      case 'call': {
        const actionName = node.action || node.name;
        const action = this.actions[actionName];
        const args = this.#resolve(node.args || {}, context);
        const result = action?.({
          runtime: this,
          node,
          args,
          payload: context.payload,
          variables: this.variables,
          options: context.options
        });
        context.trace.push({ nodeId: node.id, type: node.type, action: actionName, args, result });
        return ['out'];
      }
      case 'emit': {
        const payload = this.#resolve(node.payload || {}, context);
        const entry = { event: node.event, payload };
        context.events.push(entry);
        this.#emit(node.event, payload);
        context.trace.push({ nodeId: node.id, type: node.type, event: node.event, payload });
        return ['out'];
      }
      default:
        context.trace.push({ nodeId: node.id, type: node.type || 'unknown', skipped: true, reason: 'unsupported-node-type' });
        return [];
    }
  }

  #evaluateCondition(condition, context) {
    const normalizedCondition = condition || {};
    const left = this.#resolve(normalizedCondition.left, context);
    const right = this.#resolve(normalizedCondition.right, context);
    switch (normalizedCondition.op) {
      case 'equals':
      case '==':
      case '===':
        return left === right;
      case 'notEquals':
      case '!=':
      case '!==':
        return left !== right;
      case '>':
      case 'gt':
        return left > right;
      case '>=':
      case 'gte':
        return left >= right;
      case '<':
      case 'lt':
        return left < right;
      case '<=':
      case 'lte':
        return left <= right;
      case 'truthy':
        return Boolean(left);
      case 'falsy':
        return !left;
      default:
        return Boolean(left);
    }
  }

  #resolve(value, context) {
    if (typeof value === 'string' && value.startsWith('$')) {
      return getPath({ variables: this.variables, payload: context.payload, options: context.options }, value.slice(1));
    }
    if (Array.isArray(value)) return value.map((item) => this.#resolve(item, context));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, this.#resolve(child, context)]));
    }
    return value;
  }

  #emit(event, payload) {
    if (!event) return;
    if (typeof this.signals?.emit === 'function') {
      this.signals.emit(event, payload);
      return;
    }
    if (typeof this.signals?.signal === 'function') this.signals.signal(event).emit(payload);
  }

  #state() {
    return { variables: this.variables };
  }
}

function normalizeRenderDraw(draw, index) {
  const item = draw || {};
  return {
    id: String(item.id || item.name || `draw-${index}`),
    texture: String(item.texture || item.textureKey || item.sprite || 'texture'),
    material: String(item.material || item.shader || 'default'),
    blendMode: String(item.blendMode || 'normal'),
    dynamic: Boolean(item.dynamic || item.animated || item.video)
  };
}

function detectRenderBatchBreak(previous, current) {
  if (current.dynamic) return null;
  if (previous.material !== current.material || previous.blendMode !== current.blendMode) return 'material-switch';
  if (previous.texture !== current.texture) return 'texture-switch';
  return null;
}

function buildRenderAtlasCandidates(draws) {
  const groups = new Map();
  for (const draw of draws.filter((entry) => !entry.dynamic)) {
    const key = `${draw.material}|${draw.blendMode}`;
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key).add(draw.texture);
  }
  return [...groups.entries()]
    .map(([key, textures]) => ({
      key,
      textures: [...textures].sort(),
      spriteCount: [...textures].length
    }))
    .filter((group) => group.spriteCount >= 3)
    .sort((left, right) => right.spriteCount - left.spriteCount || left.key.localeCompare(right.key));
}

function buildRenderBatchRecommendations({ atlasCandidates, materialSwitches, normalized }) {
  const recommendations = [];
  for (const group of atlasCandidates) recommendations.push(`createAtlas:${group.key}`);
  if (materialSwitches > 0) recommendations.push('sortByMaterialTexture');
  if (normalized.some((draw) => draw.dynamic)) recommendations.push('keepDynamicSpritesOutOfStaticBatches');
  return recommendations;
}

function normalizeRenderFrame(frame = {}) {
  return {
    index: numberOr(frame.index, frame.frame, frame.frameIndex, 0),
    cpuMs: roundMetric(numberOr(frame.cpuMs, frame.mainThreadMs, frame.ms, 0)),
    gpuMs: roundMetric(numberOr(frame.gpuMs, frame.renderMs, 0)),
    fps: roundMetric(numberOr(frame.fps, 0))
  };
}

function normalizeRenderTextureUploads(textureUploads = []) {
  return normalizeArray(textureUploads).map((upload, index) => ({
    id: String(upload.id || upload.texture || upload.path || `upload-${index + 1}`),
    bytes: Math.max(0, numberOr(upload.bytes, upload.byteLength, upload.sizeBytes, 0)),
    reason: upload.reason || 'frame-upload'
  }));
}

function normalizeRenderFilterPasses(filterPasses = []) {
  return normalizeArray(filterPasses).map((filter, index) => ({
    id: String(filter.id || filter.name || filter.type || `filter-${index + 1}`),
    passes: Math.max(1, numberOr(filter.passes, filter.passCount, 1)),
    estimatedMs: roundMetric(numberOr(filter.estimatedMs, filter.ms, filter.costMs, 0))
  }));
}

function normalizeRenderBackendReport(backend = {}) {
  return {
    selected: backend.selected || backend.id || null,
    fallbackChain: normalizeArray(backend.fallbackChain).map(String),
    rejected: normalizeArray(backend.rejected).map((entry) => ({
      id: String(entry.id || entry.backend || 'backend'),
      reason: String(entry.reason || 'unavailable')
    }))
  };
}

function buildRenderFrameBudgetIssues({
  frame,
  batch,
  uploads,
  filters,
  backend,
  budgets
}) {
  const issues = [];
  if (frame.cpuMs > budgets.frameBudgetMs) {
    issues.push({ type: 'cpu-budget-exceeded', severity: 'warning', value: frame.cpuMs, budget: budgets.frameBudgetMs });
  }
  if (frame.gpuMs > budgets.frameBudgetMs) {
    issues.push({ type: 'gpu-budget-exceeded', severity: 'warning', value: frame.gpuMs, budget: budgets.frameBudgetMs });
  }
  if (batch.predictedDrawCallsAfter > budgets.drawCallBudget) {
    issues.push({ type: 'draw-call-budget-exceeded', severity: 'warning', value: batch.predictedDrawCallsAfter, budget: budgets.drawCallBudget });
  }
  if (uploads.length > budgets.textureUploadBudget) {
    issues.push({ type: 'texture-upload-spike', severity: 'warning', value: uploads.length, budget: budgets.textureUploadBudget });
  }
  const uploadBytes = uploads.reduce((sum, upload) => sum + upload.bytes, 0);
  if (uploadBytes > budgets.textureUploadByteBudget) {
    issues.push({ type: 'texture-upload-bytes-exceeded', severity: 'warning', value: uploadBytes, budget: budgets.textureUploadByteBudget });
  }
  const filterPassCount = filters.reduce((sum, filter) => sum + filter.passes, 0);
  if (filterPassCount > budgets.filterPassBudget) {
    issues.push({ type: 'filter-pass-budget-exceeded', severity: 'warning', value: filterPassCount, budget: budgets.filterPassBudget });
  }
  if (backend.rejected.length) {
    const rejected = backend.rejected[0];
    issues.push({ type: 'backend-fallback', severity: 'info', value: rejected.id, reason: rejected.reason });
  }
  return issues;
}

function buildRenderFrameBudgetRecommendations({ batch, issues, backend }) {
  const recommendations = [...batch.recommendations];
  if (issues.some((entry) => entry.type === 'cpu-budget-exceeded')) recommendations.push('profileCpuFrame');
  if (issues.some((entry) => entry.type === 'gpu-budget-exceeded')) recommendations.push('profileGpuPasses');
  if (issues.some((entry) => entry.type === 'texture-upload-spike' || entry.type === 'texture-upload-bytes-exceeded')) recommendations.push('deferTextureUploads');
  if (issues.some((entry) => entry.type === 'filter-pass-budget-exceeded')) recommendations.push('flattenFilterChain');
  if (backend.rejected.some((entry) => entry.id === 'webgpu')) recommendations.push('preferWebGPUWhenAvailable');
  if (backend.rejected.length && !backend.rejected.some((entry) => entry.id === 'webgpu')) recommendations.push('reviewBackendFallback');
  return uniqueStrings(recommendations);
}

function createRenderFrameBudgetCrossEngineProfile() {
  return {
    sources: [
      'PixiJS texture lifecycle and batch rendering',
      'Unity Frame Debugger',
      'Unreal GPU Visualizer',
      'Godot RenderingServer frame profiler'
    ],
    capabilities: [
      'frame-budget-overlay',
      'draw-call-breakdown',
      'texture-upload-spike-detection',
      'filter-pass-cost-audit',
      'backend-fallback-audit',
      'editor-render-diagnostics-panel'
    ]
  };
}

function summarizeRenderSeverity(issues = []) {
  if (issues.some((entry) => entry.severity === 'error')) return 'error';
  if (issues.some((entry) => entry.severity === 'warning')) return 'warning';
  return 'ok';
}

function normalizeAsset(asset = {}) {
  const source = typeof asset === 'string' ? { path: asset } : { ...asset };
  const path = normalizePath(source.path || source.url || source.name || '');
  const id = normalizeRef(source.id || source.name || path);
  const key = assetKey({ ...source, path, id });
  return {
    ...source,
    id,
    key,
    uid: source.uid ? normalizeRef(source.uid) : null,
    primaryId: normalizeRef(source.primaryId || source.primaryAssetId || key),
    address: source.address ? normalizeRef(source.address) : null,
    path,
    type: source.type || inferAssetType(path),
    bundle: source.bundle ? normalizeRef(source.bundle) : null,
    packageName: source.packageName ? normalizeRef(source.packageName) : null,
    loaded: source.loaded == null ? false : Boolean(source.loaded),
    labels: normalizeArray(source.labels).map(normalizeRef).filter(Boolean),
    tags: normalizeTags(source.tags),
    dependencies: normalizeArray(source.dependencies || source.deps).map(normalizeRef).filter(Boolean).sort()
  };
}

function buildAssetIndices(assets = []) {
  const indices = {
    byKey: new Map(),
    byUid: new Map(),
    byPrimaryId: new Map(),
    byAddress: new Map(),
    byPath: new Map(),
    byId: new Map()
  };
  for (const asset of assets) {
    addIndex(indices.byKey, asset.key, asset);
    addIndex(indices.byUid, asset.uid, asset);
    addIndex(indices.byPrimaryId, asset.primaryId, asset);
    addIndex(indices.byAddress, asset.address, asset);
    addIndex(indices.byPath, asset.path, asset);
    addIndex(indices.byId, asset.id, asset);
  }
  return indices;
}

function addIndex(index, key, asset) {
  if (!key) return;
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(asset);
}

function normalizeAssetChange(change, registry) {
  const kind = normalizeChangeKind(change.kind || change.type || 'modified');
  const asset = resolveAssetKey(change, registry);
  return {
    kind,
    asset,
    reference: normalizeRef(change.reference || change.asset?.address || change.asset?.primaryId || change.asset?.uid || asset),
    from: change.from ? normalizePath(change.from) : null,
    to: change.to ? normalizePath(change.to) : null,
    rawAsset: change.asset ? clone(change.asset) : null
  };
}

function resolveAssetKey(change, registry) {
  if (change.asset && typeof change.asset === 'object') return assetKey(change.asset);
  const reference = change.reference || change.asset || change.path || change.from || change.to;
  const resolved = registry?.resolve?.(reference);
  return resolved ? assetKey(resolved) : normalizeRef(reference);
}

function toRuntimeAction(change) {
  if (!change.asset) return null;
  if (change.kind === 'modified') return { type: 'reloadAsset', asset: change.asset, reason: 'modified' };
  if (change.kind === 'moved') return { type: 'reloadAsset', asset: change.asset, reason: 'moved' };
  if (change.kind === 'deleted') return { type: 'unloadAsset', asset: change.asset, reason: 'deleted' };
  if (change.kind === 'imported') return { type: 'preloadAsset', asset: change.asset, reason: 'imported' };
  return null;
}

function toEditorEvent(change) {
  if (change.kind === 'moved') return { type: 'asset:moved', asset: change.asset, from: change.from, to: change.to };
  if (change.kind === 'deleted') return { type: 'asset:deleted', asset: change.asset };
  if (change.kind === 'imported') return { type: 'asset:imported', asset: change.asset };
  return { type: 'asset:changed', asset: change.asset, kind: change.kind };
}

function normalizeChangeKind(kind) {
  const normalized = String(kind || 'modified').toLowerCase();
  if (['changed', 'updated', 'reimported'].includes(normalized)) return 'modified';
  if (['added', 'created'].includes(normalized)) return 'imported';
  if (['removed', 'missing'].includes(normalized)) return 'deleted';
  if (normalized === 'renamed') return 'moved';
  return normalized;
}

function normalizeGraph(graph = {}) {
  return {
    variables: clone(graph.variables || {}),
    nodes: normalizeArray(graph.nodes).map((node, index) => ({
      ...node,
      id: String(node.id || `node-${index + 1}`),
      type: String(node.type || 'call')
    })),
    edges: normalizeArray(graph.edges).map((edge) => ({
      ...edge,
      from: String(edge.from),
      to: String(edge.to),
      pin: edge.pin == null ? null : String(edge.pin)
    }))
  };
}

function shouldFollowEdge(edge, pins) {
  if (!edge.pin) return true;
  return pins.includes(String(edge.pin));
}

function issue(code, nodeId, message) {
  return { code, nodeId, message };
}

function compareIssues(left, right) {
  const priority = {
    'missing-node': 0,
    'duplicate-node': 1,
    'missing-event-name': 2,
    'missing-action': 3
  };
  return (priority[left.code] ?? 99) - (priority[right.code] ?? 99)
    || String(left.nodeId).localeCompare(String(right.nodeId))
    || String(left.message).localeCompare(String(right.message));
}

function assetKey(asset = {}) {
  return normalizeRef(asset.address || asset.primaryId || asset.primaryAssetId || asset.path || asset.uid || asset.id || asset.key);
}

function normalizePath(value) {
  return String(value || '').trim().replace(/\\/gu, '/').replace(/^\/+/u, '');
}

function normalizeRef(value) {
  return normalizePath(value);
}

function normalizeType(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeTags(tags = {}) {
  if (!tags || typeof tags !== 'object' || Array.isArray(tags)) return {};
  return Object.fromEntries(Object.entries(tags).map(([key, value]) => [normalizeRef(key), normalizeRef(value)]));
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) return number;
  return fallback;
}

function numberOr(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function roundMetric(value) {
  return Math.round(value * 1000) / 1000;
}

function uniqueStrings(values) {
  return [...new Set(values)];
}

function inferAssetType(path = '') {
  if (/(^|\/)prefabs\/.+\.json$/iu.test(path)) return 'prefab';
  if (/(^|\/)scenes\/.+\.json$/iu.test(path) || /\.scene\.json$/iu.test(path)) return 'scene';
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/iu.test(path)) return 'image';
  if (/\.(js|mjs|cjs|ts|tsx)$/iu.test(path)) return 'script';
  if (/\.(glb|gltf|fbx|obj)$/iu.test(path)) return 'model';
  if (/\.(mp3|wav|ogg|flac)$/iu.test(path)) return 'audio';
  if (/\.(json|tmj|tmx)$/iu.test(path)) return 'data';
  return 'asset';
}

function dedupeObjects(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function getPath(source = {}, path = '') {
  return String(path).split('.').reduce((value, key) => (value == null ? undefined : value[key]), source);
}

function setPath(target, path, value) {
  const parts = String(path).split('.');
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default {
  AssetRegistry,
  AssetRegistryChangeSet,
  BatchAtlasDiagnostics,
  VisualScriptGraphRuntime
};
