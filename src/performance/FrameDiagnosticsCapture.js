export const FRAME_DIAGNOSTICS_LANES = ['render', 'script', 'physics', 'gpu'];

export const FRAME_DIAGNOSTICS_CAPTURE_SCHEMA = {
  version: 1,
  lanes: FRAME_DIAGNOSTICS_LANES,
  traceFormat: 'chrome-json'
};

export class FrameDiagnosticsCapture {
  constructor({ frameBudgetMs = 1000 / 60, budgets = {}, processId = 1 } = {}) {
    this.frameBudgetMs = positiveNumber(frameBudgetMs, 1000 / 60);
    this.budgets = { ...budgets };
    this.processId = Math.max(1, Math.floor(Number(processId) || 1));
    this.frames = [];
  }

  clear() {
    this.frames = [];
    return this;
  }

  recordFrame(sample = {}) {
    const frame = normalizeFrame(sample, this.frames.length);
    this.frames.push(frame);
    return frame;
  }

  analyze({ topN = 5 } = {}) {
    const frameCount = this.frames.length;
    const issues = buildIssues(this.frames, this.budgets, this.frameBudgetMs);
    const summary = buildSummary(this.frames, this.frameBudgetMs);
    return {
      schema: FRAME_DIAGNOSTICS_CAPTURE_SCHEMA,
      summary: {
        ...summary,
        ready: issues.length === 0
      },
      lanes: buildLaneSummary(this.frames),
      topMarkers: collectMarkers(this.frames)
        .sort((left, right) => right.durationMs - left.durationMs || left.name.localeCompare(right.name))
        .slice(0, Math.max(0, Math.floor(Number(topN) || 0))),
      issues,
      recommendations: buildRecommendations(issues),
      traceEvents: this.toTraceEvents(),
      crossEngineProfile: {
        sources: [
          'Unity Profiler',
          'Unreal Insights',
          'Godot Profiler',
          'Chrome Performance trace'
        ],
        frameBudgetMs: this.frameBudgetMs,
        sampleCount: frameCount,
        lanes: FRAME_DIAGNOSTICS_LANES
      }
    };
  }

  toTraceEvents() {
    return collectMarkers(this.frames).map((marker) => {
      const tid = FRAME_DIAGNOSTICS_LANES.indexOf(marker.lane) + 1 || FRAME_DIAGNOSTICS_LANES.length + 1;
      return {
        name: marker.name,
        cat: marker.lane,
        ph: 'X',
        ts: Math.round(((marker.frame * this.frameBudgetMs) + marker.startMs) * 1000),
        dur: Math.round(marker.durationMs * 1000),
        pid: this.processId,
        tid,
        args: {
          frame: marker.frame,
          lane: marker.lane
        }
      };
    });
  }
}

function normalizeFrame(sample, index) {
  const frame = Number.isFinite(Number(sample.frame)) ? Number(sample.frame) : index;
  const lanes = Object.fromEntries(FRAME_DIAGNOSTICS_LANES.map((lane) => [lane, metricNumber(sample[`${lane}Ms`])]));
  return {
    frame,
    deltaMs: metricNumber(sample.deltaMs ?? sample.frameMs ?? estimateFrameMs(lanes)),
    renderMs: lanes.render,
    scriptMs: lanes.script,
    physicsMs: lanes.physics,
    gpuMs: lanes.gpu,
    memoryMB: optionalMetricNumber(sample.memoryMB),
    drawCalls: optionalMetricNumber(sample.drawCalls),
    warnings: normalizeList(sample.warnings),
    markers: normalizeMarkers(sample.markers, frame)
  };
}

function estimateFrameMs(lanes) {
  return Math.max(lanes.render + lanes.script + lanes.physics, lanes.gpu);
}

function buildSummary(frames, frameBudgetMs) {
  const frameTimes = frames.map((frame) => frame.deltaMs);
  const worst = frames.reduce((best, frame) => (frame.deltaMs > (best?.deltaMs ?? -1) ? frame : best), null);
  const overBudgetFrames = frames
    .filter((frame) => frame.deltaMs > frameBudgetMs)
    .map((frame) => frame.frame);
  return {
    frameCount: frames.length,
    averageFrameMs: round(average(frameTimes)),
    p95FrameMs: percentile(frameTimes, 0.95),
    worstFrame: worst?.frame ?? null,
    worstFrameMs: round(worst?.deltaMs ?? 0),
    overBudgetFrames,
    ready: overBudgetFrames.length === 0
  };
}

function buildLaneSummary(frames) {
  return Object.fromEntries(FRAME_DIAGNOSTICS_LANES.map((lane) => {
    const metric = `${lane}Ms`;
    const values = frames.map((frame) => frame[metric]);
    const worst = frames.reduce((best, frame) => (frame[metric] > (best?.[metric] ?? -1) ? frame : best), null);
    return [lane, {
      totalMs: round(values.reduce((sum, value) => sum + value, 0)),
      averageMs: round(average(values)),
      worstFrame: worst?.frame ?? null,
      worstMs: round(worst?.[metric] ?? 0)
    }];
  }));
}

function buildIssues(frames, budgets, frameBudgetMs) {
  const issues = [];
  for (const frame of frames) {
    if (frame.deltaMs > frameBudgetMs) {
      issues.push({
        code: 'frame-budget-exceeded',
        frame: frame.frame,
        value: frame.deltaMs,
        budget: frameBudgetMs,
        severity: severity(frame.deltaMs, frameBudgetMs)
      });
    }
  }

  for (const lane of FRAME_DIAGNOSTICS_LANES) {
    const metric = `${lane}Ms`;
    const budget = optionalMetricNumber(budgets[metric]);
    if (budget == null) continue;
    const worst = frames.reduce((best, frame) => (frame[metric] > (best?.[metric] ?? -1) ? frame : best), null);
    if (worst && worst[metric] > budget) {
      issues.push({
        code: 'lane-budget-exceeded',
        lane,
        metric,
        frame: worst.frame,
        value: worst[metric],
        budget,
        severity: severity(worst[metric], budget)
      });
    }
  }

  pushMaxMetricIssue(issues, frames, budgets, 'memoryMB', 'memory-budget-exceeded');
  pushMaxMetricIssue(issues, frames, budgets, 'drawCalls', 'draw-call-budget-exceeded');

  for (const frame of frames) {
    for (const warning of frame.warnings) {
      issues.push({
        code: 'runtime-warning',
        frame: frame.frame,
        warning,
        severity: 'notice'
      });
    }
  }
  return issues;
}

function pushMaxMetricIssue(issues, frames, budgets, metric, code) {
  const budget = optionalMetricNumber(budgets[metric]);
  if (budget == null) return;
  const worst = frames.reduce((best, frame) => {
    const value = frame[metric];
    if (value == null) return best;
    return value > (best?.[metric] ?? -1) ? frame : best;
  }, null);
  if (worst && worst[metric] > budget) {
    issues.push({
      code,
      metric,
      frame: worst.frame,
      value: worst[metric],
      budget,
      severity: severity(worst[metric], budget)
    });
  }
}

function buildRecommendations(issues) {
  const actions = [];
  for (const issue of issues) {
    if (issue.code === 'lane-budget-exceeded' && issue.lane === 'render') actions.push('captureRenderDocOrPixiBatchDiagnostics');
    if (issue.code === 'lane-budget-exceeded' && issue.lane === 'script') actions.push('splitLongScriptTasks');
    if (issue.code === 'lane-budget-exceeded' && issue.lane === 'gpu') actions.push('reduceGpuOverdrawOrShaderCost');
    if (issue.code === 'memory-budget-exceeded') actions.push('runTextureMemoryAudit');
    if (issue.code === 'draw-call-budget-exceeded') actions.push('enableBatchingOrInstanceStaticGeometry');
    if (issue.code === 'runtime-warning' && String(issue.warning).includes('texture-upload')) {
      actions.push('moveTextureUploadsOffGameplayFrames');
    } else if (issue.code === 'runtime-warning') {
      actions.push('inspectRuntimeWarnings');
    }
  }
  return [...new Set(actions)];
}

function collectMarkers(frames) {
  return frames.flatMap((frame) => frame.markers);
}

function normalizeMarkers(markers, frame) {
  if (!Array.isArray(markers)) return [];
  return markers
    .map((marker) => ({
      frame,
      lane: normalizeLane(marker.lane),
      name: String(marker.name || 'marker'),
      startMs: metricNumber(marker.startMs),
      durationMs: metricNumber(marker.durationMs ?? marker.ms)
    }))
    .filter((marker) => marker.durationMs > 0);
}

function normalizeLane(lane) {
  const value = String(lane || 'script');
  return FRAME_DIAGNOSTICS_LANES.includes(value) ? value : 'script';
}

function normalizeList(values) {
  if (!Array.isArray(values)) return [];
  return values.map((value) => String(value)).filter(Boolean);
}

function metricNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function optionalMetricNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return round(sorted[index]);
}

function severity(value, budget) {
  const ratio = value / Math.max(0.001, budget);
  if (ratio >= 1.5) return 'critical';
  if (ratio >= 1.15) return 'warning';
  return 'notice';
}

function round(value) {
  return Number(value.toFixed(2));
}

export default FrameDiagnosticsCapture;
