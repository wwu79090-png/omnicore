#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_DEVICES = [
  {
    id: 'windows-low-end-igpu',
    label: 'Windows low-end integrated GPU',
    metrics: { fps: 60, p95FrameMs: 18, memoryMb: 180, drawCalls: 8, gcEvents: 1, packageBytes: 933213 }
  },
  {
    id: 'android-mid-range-webview',
    label: 'Android mid-range WebView',
    metrics: { fps: 55, p95FrameMs: 22, memoryMb: 220, drawCalls: 9, gcEvents: 2, packageBytes: 933213 }
  },
  {
    id: 'wechat-devtools',
    label: 'WeChat DevTools',
    metrics: { fps: 58, p95FrameMs: 20, memoryMb: 210, drawCalls: 9, gcEvents: 2, packageBytes: 4 * 1024 * 1024 }
  },
  {
    id: 'chrome-webgpu',
    label: 'Chrome WebGPU',
    metrics: { fps: 144, p95FrameMs: 8, memoryMb: 190, drawCalls: 4, gcEvents: 1, packageBytes: 933213 }
  }
];

export function createDevicePerformanceBaseline({
  generatedAt = new Date().toISOString(),
  devices = DEFAULT_DEVICES
} = {}) {
  return {
    format: 'OmniCore.DevicePerformanceBaseline',
    version: 1,
    generatedAt,
    devices: devices.map((device) => ({
      id: device.id,
      label: device.label,
      metrics: normalizeMetrics(device.metrics),
      capture: [
        'Record FPS, P95 frame time, memory, draw calls, GC events, package bytes.',
        'console error/warn',
        'Attach screenshot or video plus console error/warn status.',
        'If a metric is synthetic, replace it after running on target hardware.'
      ],
      thresholds: {
        minFps: device.id === 'chrome-webgpu' ? 120 : 50,
        maxP95FrameMs: device.id === 'chrome-webgpu' ? 10 : 24,
        maxConsoleErrors: 0,
        maxConsoleWarnings: 0
      }
    }))
  };
}

function normalizeMetrics(metrics = {}) {
  return {
    fps: number(metrics.fps),
    p95FrameMs: number(metrics.p95FrameMs),
    memoryMb: number(metrics.memoryMb),
    drawCalls: number(metrics.drawCalls),
    gcEvents: number(metrics.gcEvents),
    packageBytes: number(metrics.packageBytes)
  };
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  const report = createDevicePerformanceBaseline();
  if (options.out) {
    const target = path.resolve(options.out);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

export default createDevicePerformanceBaseline;
