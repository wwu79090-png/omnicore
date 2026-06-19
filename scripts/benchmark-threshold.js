#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultBaselinePath = path.join(root, 'tests', 'benchmark', 'fixtures', 'baseline.json');
const defaultCurrentPath = path.join(root, 'docs', 'release-notes', 'benchmark-current.json');
const defaultReportPath = path.join(root, 'docs', 'release-notes', 'performance-regression-report.md');

const metricDefinitions = [
  { key: 'particles1000AvgFps', label: '1000 粒子平均 FPS', direction: 'higher' },
  { key: 'canvas1000SpriteFps', label: 'Canvas 1000 Sprite FPS', direction: 'higher' },
  { key: 'pixi1000SpriteFps', label: 'Pixi 1000 Sprite FPS', direction: 'higher' },
  { key: 'entitySync500AvgMs', label: '500 实体同步耗时', direction: 'lower', absoluteTolerance: 1 },
  { key: 'backendSwitchAvgMs', label: '后端切换耗时', direction: 'lower', absoluteTolerance: 3 },
  { key: 'particles1000DrawCalls', label: '1000 粒子 Draw Calls/帧', direction: 'lower' },
  { key: 'canvasDrawCalls', label: 'Canvas Draw Calls/帧', direction: 'lower' },
  { key: 'pixiDrawCalls', label: 'Pixi Draw Calls/帧', direction: 'lower' },
  { key: 'complexScene1200Fps', label: '复杂场景 1200 实体 FPS', direction: 'higher' },
  { key: 'complexSceneBenchmarkFps', label: '独立复杂场景 Benchmark FPS', direction: 'higher' },
  { key: 'complexScene1200DrawCalls', label: '复杂场景 Draw Calls/帧', direction: 'lower' },
  { key: 'complexScene1200CollisionPairs', label: '复杂场景碰撞对总量', direction: 'higher' },
  { key: 'complexScene1200MaterialSwitches', label: '复杂场景动态材质切换量', direction: 'higher' }
];

export function normalizeBenchmarkResult(result) {
  const summary = result.summary || result.metrics || {};
  const builtInRuns = Array.isArray(result.builtInRuns) ? result.builtInRuns : [];
  const engineCanvas = result.engineCanvas || {};
  const enginePixi = result.enginePixi || {};
  const complexStress = result.complexStress || {};
  const complexSceneBenchmark = result.metrics?.['complex-scene-benchmark'] || result.complexSceneBenchmark || {};

  const metrics = {
    particles1000AvgFps: numberOrAverage(summary.particles1000AvgFps, builtInRuns.map((item) => item.particles1000?.fps)),
    canvas1000SpriteFps: numberOrNull(summary.canvas1000SpriteFps ?? engineCanvas.fps),
    pixi1000SpriteFps: numberOrNull(summary.pixi1000SpriteFps ?? enginePixi.fps),
    entitySync500AvgMs: numberOrAverage(summary.entitySync500AvgMs, builtInRuns.map((item) => item.entitySync500?.ms)),
    backendSwitchAvgMs: numberOrAverage(summary.backendSwitchAvgMs, builtInRuns.map((item) => item.backendSwitch?.ms)),
    particles1000DrawCalls: numberOrAverage(
      summary.particles1000DrawCalls,
      builtInRuns.map((item) => drawCallsPerFrame(item.particles1000))
    ),
    canvasDrawCalls: numberOrNull(summary.canvasDrawCalls ?? drawCallsPerFrame(engineCanvas)),
    pixiDrawCalls: numberOrNull(summary.pixiDrawCalls ?? drawCallsPerFrame(enginePixi)),
    complexScene1200Fps: numberOrNull(summary.complexScene1200Fps ?? complexStress.fps),
    complexSceneBenchmarkFps: numberOrNull(summary.complexSceneBenchmarkFps ?? complexSceneBenchmark.fps),
    complexScene1200DrawCalls: numberOrNull(summary.complexScene1200DrawCalls ?? drawCallsPerFrame(complexStress)),
    complexScene1200CollisionPairs: numberOrNull(summary.complexScene1200CollisionPairs ?? complexStress.collisionPairs),
    complexScene1200MaterialSwitches: numberOrNull(summary.complexScene1200MaterialSwitches ?? complexStress.materialSwitches)
  };

  return {
    generatedAt: result.generatedAt || null,
    metrics: Object.fromEntries(Object.entries(metrics).filter(([, value]) => Number.isFinite(value)))
  };
}

export function compareBenchmarkResults({ baseline, current, threshold = 0.05 } = {}) {
  const normalizedBaseline = normalizeBenchmarkResult(baseline);
  const normalizedCurrent = normalizeBenchmarkResult(current);
  const metrics = metricDefinitions
    .map((definition) => compareMetric(definition, normalizedBaseline.metrics, normalizedCurrent.metrics, threshold))
    .filter(Boolean);
  const regressions = metrics.filter((metric) => metric.regressed);

  return {
    generatedAt: new Date().toISOString(),
    threshold,
    passed: regressions.length === 0,
    baseline: normalizedBaseline.metrics,
    current: normalizedCurrent.metrics,
    metrics,
    regressions
  };
}

export function formatRegressionReport(comparison) {
  const thresholdPercent = formatPercent(comparison.threshold);
  const status = comparison.passed ? '通过' : '阻断合并';
  const lines = [
    '# 性能下降报告',
    '',
    `结果：${status}`,
    `阈值：超过 ${thresholdPercent} 的性能下降会阻断 CI。`,
    `生成时间：${comparison.generatedAt}`,
    '',
    '| 指标 | 基线 | 当前 | 变化 | 判定 |',
    '| --- | ---: | ---: | ---: | --- |'
  ];

  for (const metric of comparison.metrics) {
    lines.push(`| \`${metric.key}\` | ${formatNumber(metric.baseline)} | ${formatNumber(metric.current)} | ${formatPercent(metric.regressionRatio)} | ${metric.regressed ? '失败' : '通过'} |`);
  }

  if (comparison.regressions.length) {
    lines.push('', '## 阻断项');
    for (const metric of comparison.regressions) {
      lines.push(`- \`${metric.key}\`：${metric.label} 从 ${formatNumber(metric.baseline)} 变为 ${formatNumber(metric.current)}，下降 ${formatPercent(metric.regressionRatio)}。`);
    }
  } else {
    lines.push('', '未发现超过阈值的性能下降。');
  }

  return `${lines.join('\n')}\n`;
}

export function parseJsonPayload(output) {
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Benchmark did not print a JSON payload.');
  return JSON.parse(output.slice(start, end + 1));
}

function compareMetric(definition, baseline, current, threshold) {
  const baselineValue = baseline[definition.key];
  const currentValue = current[definition.key];
  if (!Number.isFinite(baselineValue) || !Number.isFinite(currentValue)) return null;
  const denominator = Math.abs(baselineValue);
  const regressionRatio = denominator === 0
    ? zeroBaselineRegression(definition.direction, baselineValue, currentValue)
    : definition.direction === 'higher'
      ? (baselineValue - currentValue) / denominator
      : (currentValue - baselineValue) / denominator;
  const regressionAmount = definition.direction === 'higher'
    ? baselineValue - currentValue
    : currentValue - baselineValue;
  const withinAbsoluteTolerance = Number.isFinite(definition.absoluteTolerance)
    && regressionAmount <= definition.absoluteTolerance;

  return {
    ...definition,
    baseline: baselineValue,
    current: currentValue,
    delta: currentValue - baselineValue,
    regressionRatio: Number(regressionRatio.toFixed(6)),
    regressed: !withinAbsoluteTolerance && regressionRatio > threshold + Number.EPSILON
  };
}

function zeroBaselineRegression(direction, baseline, current) {
  if (direction === 'lower' && current > baseline) return Number.POSITIVE_INFINITY;
  if (direction === 'higher' && current < baseline) return Number.POSITIVE_INFINITY;
  return 0;
}

function drawCallsPerFrame(result = {}) {
  if (Number.isFinite(result.drawCallsPerFrame)) return result.drawCallsPerFrame;
  if (Number.isFinite(result.logicalDrawCallsPerFrame)) return result.logicalDrawCallsPerFrame;
  if (Number.isFinite(result.drawCalls)) return result.drawCalls;
  if (Number.isFinite(result.totalDrawCalls) && Number.isFinite(result.frames) && result.frames > 0) {
    return Number((result.totalDrawCalls / result.frames).toFixed(2));
  }
  return null;
}

function numberOrAverage(value, values) {
  const numeric = numberOrNull(value);
  return Number.isFinite(numeric) ? numeric : average(values);
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function average(values) {
  const numericValues = values.map(numberOrNull).filter((value) => Number.isFinite(value));
  if (!numericValues.length) return null;
  return Number((numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length).toFixed(2));
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return 'n/a';
  return Number(value.toFixed(3)).toString();
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '∞';
  return `${Number((value * 100).toFixed(2))}%`;
}

function parseArgs(argv) {
  const options = {
    baseline: defaultBaselinePath,
    current: null,
    currentOutput: defaultCurrentPath,
    output: defaultReportPath,
    threshold: 0.05,
    updateBaseline: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--baseline') {
      index += 1;
      options.baseline = path.resolve(argv[index]);
    } else if (arg === '--current') {
      index += 1;
      options.current = path.resolve(argv[index]);
    } else if (arg === '--current-output') {
      index += 1;
      options.currentOutput = path.resolve(argv[index]);
    } else if (arg === '--output') {
      index += 1;
      options.output = path.resolve(argv[index]);
    } else if (arg === '--threshold') {
      index += 1;
      options.threshold = Number(argv[index]);
    } else if (arg === '--update-baseline') options.updateBaseline = true;
  }

  return options;
}

function loadBenchmarkPayload(filePath) {
  return parseJsonPayload(readFileSync(filePath, 'utf8'));
}

function runBenchmark() {
  const result = spawnSync(process.execPath, ['scripts/benchmark.js'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Benchmark command failed.');
  }

  return parseJsonPayload(result.stdout);
}

function writeJson(filePath, payload) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeText(filePath, text) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, text);
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const current = options.current ? loadBenchmarkPayload(options.current) : runBenchmark();
    if (!options.current) writeJson(options.currentOutput, current);

    if (options.updateBaseline) {
      writeJson(options.baseline, current);
      console.log(`[OmniCore] benchmark baseline updated: ${path.relative(root, options.baseline)}`);
      process.exit(0);
    }

    const baseline = loadBenchmarkPayload(options.baseline);
    const comparison = compareBenchmarkResults({ baseline, current, threshold: options.threshold });
    const report = formatRegressionReport(comparison);
    writeText(options.output, report);
    console.log(report);
    process.exit(comparison.passed ? 0 : 1);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
