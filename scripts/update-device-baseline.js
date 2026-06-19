#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const DEFAULT_BASELINE = 'docs/performance/device-baselines.json';
const DEFAULT_TREND = 'docs/performance/device-trend.svg';

export function updateDeviceBaseline({
  baselinePath = DEFAULT_BASELINE,
  samplePath = null,
  trendPath = DEFAULT_TREND,
  title = 'OmniCore Device FPS Trend',
  now = new Date().toISOString()
} = {}) {
  const baseline = readJsonIfExists(baselinePath, {
    metrics: ['fps', 'p95FrameMs', 'memoryMb'],
    devices: [],
    history: []
  });
  const samples = normalizeSamples(samplePath ? readJsonIfExists(samplePath, []) : []);
  for (const sample of samples) {
    appendSample(baseline, sample, now);
  }
  baseline.metrics = baseline.metrics?.length ? baseline.metrics : ['fps', 'p95FrameMs', 'memoryMb'];
  baseline.devices = dedupeDevices(baseline.devices);
  baseline.history = (baseline.history || []).sort((left, right) => String(left.recordedAt).localeCompare(String(right.recordedAt)));
  baseline.latest = createLatestByDevice(baseline.history);
  baseline.trends = createTrendSummary(baseline.history);
  writeJson(baselinePath, baseline);
  writeText(trendPath, createTrendSvg(baseline, { title }));
  return baseline;
}

function appendSample(baseline, sample, now) {
  const deviceId = sample.deviceId || sample.id;
  if (!deviceId) return;
  const label = sample.label || sample.device || deviceId;
  const device = {
    id: deviceId,
    label,
    tier: sample.tier || 'unknown',
    os: sample.os || sample.platform || 'unknown',
    gpu: sample.gpu || 'unknown'
  };
  baseline.devices = dedupeDevices([...(baseline.devices || []), device]);
  baseline.history = [
    ...(baseline.history || []),
    {
      recordedAt: sample.recordedAt || now,
      deviceId,
      label,
      scenario: sample.scenario || 'complex-scene-benchmark',
      commit: sample.commit || 'local',
      fps: Number(sample.fps || 0),
      p95FrameMs: Number(sample.p95FrameMs || sample.frameP95Ms || 0),
      memoryMb: Number(sample.memoryMb || sample.heapMb || 0),
      notes: sample.notes || ''
    }
  ];
}

function normalizeSamples(input) {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.samples)) return input.samples;
  if (Array.isArray(input.history)) return input.history;
  return [input];
}

function dedupeDevices(devices = []) {
  const map = new Map();
  for (const device of devices) {
    if (!device?.id) continue;
    map.set(device.id, { ...map.get(device.id), ...device });
  }
  return [...map.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function createLatestByDevice(history = []) {
  const latest = {};
  for (const sample of history) latest[sample.deviceId] = { ...sample };
  return latest;
}

function createTrendSummary(history = []) {
  const byDevice = new Map();
  for (const sample of history) {
    const list = byDevice.get(sample.deviceId) || [];
    list.push(sample);
    byDevice.set(sample.deviceId, list);
  }
  const trends = {};
  for (const [deviceId, samples] of byDevice) {
    const fpsValues = samples.map((sample) => Number(sample.fps || 0));
    trends[deviceId] = {
      samples: samples.length,
      minFps: Math.min(...fpsValues),
      maxFps: Math.max(...fpsValues),
      latestFps: fpsValues[fpsValues.length - 1],
      deltaFps: Number((fpsValues[fpsValues.length - 1] - fpsValues[0]).toFixed(2))
    };
  }
  return trends;
}

export function createTrendSvg(baseline = {}, { title = 'OmniCore Device FPS Trend' } = {}) {
  const devices = baseline.devices || [];
  const history = baseline.history || [];
  const width = 760;
  const rowHeight = 54;
  const height = 72 + Math.max(1, devices.length) * rowHeight;
  const maxFps = Math.max(60, ...history.map((sample) => Number(sample.fps || 0)));
  const rows = devices.map((device, index) => {
    const samples = history.filter((sample) => sample.deviceId === device.id);
    const latest = samples[samples.length - 1] || {};
    const barWidth = Math.max(2, Math.round((Number(latest.fps || 0) / maxFps) * 420));
    const y = 58 + index * rowHeight;
    const line = createSparkline(samples, 285, y + 28, 180, 24, maxFps);
    return `
      <text x="28" y="${y}" class="label">${escapeXml(device.label || device.id)}</text>
      <rect x="180" y="${y - 15}" width="${barWidth}" height="16" rx="3" class="bar"></rect>
      <text x="${190 + barWidth}" y="${y - 3}" class="value">${Number(latest.fps || 0).toFixed(1)} FPS</text>
      ${line}
    `;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}">
  <style>
    .bg { fill: #0f172a; }
    .title { fill: #e5e7eb; font: 700 18px system-ui, sans-serif; }
    .label { fill: #cbd5e1; font: 12px system-ui, sans-serif; }
    .value { fill: #94a3b8; font: 12px system-ui, sans-serif; }
    .bar { fill: #22c55e; }
    .spark { fill: none; stroke: #38bdf8; stroke-width: 2; }
  </style>
  <rect class="bg" width="${width}" height="${height}"></rect>
  <text x="28" y="32" class="title">${escapeXml(title)}</text>
  ${rows}
</svg>
`;
}

function createSparkline(samples, x, y, width, height, maxFps) {
  if (samples.length < 2) return '';
  const points = samples.map((sample, index) => {
    const px = x + (index / Math.max(1, samples.length - 1)) * width;
    const py = y - (Number(sample.fps || 0) / maxFps) * height;
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(' ');
  return `<polyline class="spark" points="${points}"></polyline>`;
}

function readJsonIfExists(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function writeText(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseArgs(argv) {
  const options = {};
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--baseline') {
      options.baselinePath = next;
      index += 1;
    } else if (arg === '--sample') {
      options.samplePath = next;
      index += 1;
    } else if (arg === '--trend') {
      options.trendPath = next;
      index += 1;
    }
  }
  return options;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = updateDeviceBaseline(parseArgs(process.argv));
  process.stdout.write(JSON.stringify({
    devices: result.devices.length,
    samples: result.history.length,
    trend: true
  }, null, 2));
}
