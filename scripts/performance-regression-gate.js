#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_THRESHOLDS = {
  fpsDropPercent: 0.1,
  frameMsIncreasePercent: 0.15,
  packageIncreasePercent: 0.1
};

export function comparePerformanceRegression({
  baseline = {},
  current = {},
  thresholds = DEFAULT_THRESHOLDS,
  generatedAt = new Date().toISOString()
} = {}) {
  const normalizedThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const comparisons = [
    compareHigherIsBetter('fps', baseline.fps, current.fps, normalizedThresholds.fpsDropPercent),
    compareLowerIsBetter('p95FrameMs', baseline.p95FrameMs, current.p95FrameMs, normalizedThresholds.frameMsIncreasePercent),
    compareLowerIsBetter('packageBytes', baseline.packageBytes, current.packageBytes, normalizedThresholds.packageIncreasePercent)
  ].filter(Boolean);
  const regressions = comparisons.filter((item) => item.regressed);
  return {
    format: 'OmniCore.PerformanceRegressionGate',
    version: 1,
    generatedAt,
    passed: regressions.length === 0,
    thresholds: normalizedThresholds,
    comparisons,
    regressions
  };
}

function compareHigherIsBetter(metric, baseline, current, threshold) {
  const base = Number(baseline);
  const now = Number(current);
  if (!Number.isFinite(base) || !Number.isFinite(now) || base === 0) return null;
  const changePercent = (base - now) / Math.abs(base);
  return {
    metric,
    baseline: base,
    current: now,
    changePercent: round(changePercent),
    threshold,
    regressed: changePercent > threshold
  };
}

function compareLowerIsBetter(metric, baseline, current, threshold) {
  const base = Number(baseline);
  const now = Number(current);
  if (!Number.isFinite(base) || !Number.isFinite(now) || base === 0) return null;
  const changePercent = (now - base) / Math.abs(base);
  return {
    metric,
    baseline: base,
    current: now,
    changePercent: round(changePercent),
    threshold,
    regressed: changePercent > threshold
  };
}

function round(value) {
  return Number(value.toFixed(6));
}

function readJson(file) {
  return JSON.parse(readFileSync(path.resolve(file), 'utf8'));
}

function parseArgs(argv = []) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) options[key] = true;
    else {
      options[key] = value;
      index += 1;
    }
  }
  return options;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const options = parseArgs(process.argv.slice(2));
  const baseline = options.baseline ? readJson(options.baseline) : {};
  const current = options.current ? readJson(options.current) : {};
  const report = comparePerformanceRegression({ baseline, current });
  if (options.out) {
    const target = path.resolve(options.out);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}

export default comparePerformanceRegression;
