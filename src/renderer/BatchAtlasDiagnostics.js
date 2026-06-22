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
    const normalized = draws.map(normalizeDraw);
    const batchBreaks = [];

    for (let index = 1; index < normalized.length; index += 1) {
      const previous = normalized[index - 1];
      const current = normalized[index];
      const reason = breakReason(previous, current);
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

    const atlasCandidates = buildAtlasCandidates(normalized);
    const predictedDrawCallsAfter = Math.max(1, normalized.length - Math.min(1, atlasCandidates.length));
    return {
      drawCallsBefore: normalized.length,
      predictedDrawCallsAfter,
      materialSwitches: batchBreaks.length,
      batchBreaks,
      atlasCandidates,
      recommendations: buildRecommendations({ atlasCandidates, materialSwitches: batchBreaks.length, normalized })
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
    const normalizedFrame = normalizeFrame(frame);
    const uploads = normalizeTextureUploads(textureUploads);
    const filters = normalizeFilterPasses(filterPasses);
    const backendReport = normalizeBackendReport(backend);
    const issues = buildFrameBudgetIssues({
      frame: normalizedFrame,
      batch,
      uploads,
      filters,
      backend: backendReport,
      budgets: this
    });
    const recommendations = buildFrameBudgetRecommendations({
      batch,
      issues,
      backend: backendReport
    });
    const severity = summarizeSeverity(issues);
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
      crossEngineProfile: createFrameBudgetCrossEngineProfile()
    };
  }
}

function normalizeDraw(draw, index) {
  const item = draw || {};
  return {
    id: String(item.id || item.name || `draw-${index}`),
    texture: String(item.texture || item.textureKey || item.sprite || 'texture'),
    material: String(item.material || item.shader || 'default'),
    blendMode: String(item.blendMode || 'normal'),
    dynamic: Boolean(item.dynamic || item.animated || item.video)
  };
}

function breakReason(previous, current) {
  if (current.dynamic) return null;
  if (previous.material !== current.material || previous.blendMode !== current.blendMode) return 'material-switch';
  if (previous.texture !== current.texture) return 'texture-switch';
  return null;
}

function buildAtlasCandidates(draws) {
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

function buildRecommendations({ atlasCandidates, materialSwitches, normalized }) {
  const recommendations = [];
  for (const group of atlasCandidates) recommendations.push(`createAtlas:${group.key}`);
  if (materialSwitches > 0) recommendations.push('sortByMaterialTexture');
  if (normalized.some((draw) => draw.dynamic)) recommendations.push('keepDynamicSpritesOutOfStaticBatches');
  return recommendations;
}

function normalizeFrame(frame = {}) {
  return {
    index: numberOr(frame.index, frame.frame, frame.frameIndex, 0),
    cpuMs: roundMetric(numberOr(frame.cpuMs, frame.mainThreadMs, frame.ms, 0)),
    gpuMs: roundMetric(numberOr(frame.gpuMs, frame.renderMs, 0)),
    fps: roundMetric(numberOr(frame.fps, 0))
  };
}

function normalizeTextureUploads(textureUploads = []) {
  return normalizeArray(textureUploads).map((upload, index) => ({
    id: String(upload.id || upload.texture || upload.path || `upload-${index + 1}`),
    bytes: Math.max(0, numberOr(upload.bytes, upload.byteLength, upload.sizeBytes, 0)),
    reason: upload.reason || 'frame-upload'
  }));
}

function normalizeFilterPasses(filterPasses = []) {
  return normalizeArray(filterPasses).map((filter, index) => ({
    id: String(filter.id || filter.name || filter.type || `filter-${index + 1}`),
    passes: Math.max(1, numberOr(filter.passes, filter.passCount, 1)),
    estimatedMs: roundMetric(numberOr(filter.estimatedMs, filter.ms, filter.costMs, 0))
  }));
}

function normalizeBackendReport(backend = {}) {
  return {
    selected: backend.selected || backend.id || null,
    fallbackChain: normalizeArray(backend.fallbackChain).map(String),
    rejected: normalizeArray(backend.rejected).map((entry) => ({
      id: String(entry.id || entry.backend || 'backend'),
      reason: String(entry.reason || 'unavailable')
    }))
  };
}

function buildFrameBudgetIssues({
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

function buildFrameBudgetRecommendations({ batch, issues, backend }) {
  const recommendations = [...batch.recommendations];
  if (issues.some((issue) => issue.type === 'cpu-budget-exceeded')) recommendations.push('profileCpuFrame');
  if (issues.some((issue) => issue.type === 'gpu-budget-exceeded')) recommendations.push('profileGpuPasses');
  if (issues.some((issue) => issue.type === 'texture-upload-spike' || issue.type === 'texture-upload-bytes-exceeded')) recommendations.push('deferTextureUploads');
  if (issues.some((issue) => issue.type === 'filter-pass-budget-exceeded')) recommendations.push('flattenFilterChain');
  if (backend.rejected.some((entry) => entry.id === 'webgpu')) recommendations.push('preferWebGPUWhenAvailable');
  if (backend.rejected.length && !backend.rejected.some((entry) => entry.id === 'webgpu')) recommendations.push('reviewBackendFallback');
  return unique(recommendations);
}

function createFrameBudgetCrossEngineProfile() {
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

function summarizeSeverity(issues = []) {
  if (issues.some((issue) => issue.severity === 'error')) return 'error';
  if (issues.some((issue) => issue.severity === 'warning')) return 'warning';
  return 'ok';
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

function unique(values) {
  return [...new Set(values)];
}

export default BatchAtlasDiagnostics;
