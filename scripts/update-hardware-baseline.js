#!/usr/bin/env node
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { updateDeviceBaseline } from './update-device-baseline.js';

function parseArgs(argv) {
  const options = {
    baselinePath: 'docs/hardware-baseline/hardware-baseline.json',
    trendPath: 'docs/hardware-baseline/real-device-fps-trend.svg',
    title: 'OmniCore Real Device FPS Trend'
  };
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

export function updateHardwareBaseline(options = {}) {
  const baseline = updateDeviceBaseline({
    title: 'OmniCore Real Device FPS Trend',
    ...options
  });
  baseline.command = baseline.command || 'npm run benchmark:mobile';
  return baseline;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = updateHardwareBaseline(parseArgs(process.argv));
  process.stdout.write(JSON.stringify({
    devices: result.devices.length,
    samples: result.history.length,
    trend: true
  }, null, 2));
}

export default updateHardwareBaseline;
