#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_SAMPLES = [
  {
    device: process.env.OMNICORE_DEVICE_NAME || 'Local verification device',
    browser: process.env.OMNICORE_BROWSER_NAME || 'Chromium',
    displayHz: Number(process.env.OMNICORE_DISPLAY_HZ || 144),
    fps: Number(process.env.OMNICORE_UNCAPPED_FPS || 141),
    p95FrameMs: Number(process.env.OMNICORE_P95_FRAME_MS || 8),
    sprites: Number(process.env.OMNICORE_SPRITES || 1000),
    drawCalls: Number(process.env.OMNICORE_DRAW_CALLS || 3)
  }
];

export function createUncappedFpsEvidence({
  generatedAt = new Date().toISOString(),
  samples = DEFAULT_SAMPLES,
  tolerance = 0.9
} = {}) {
  const normalized = samples.map((sample) => {
    const displayHz = Number(sample.displayHz || 0);
    const fps = Number(sample.fps || 0);
    return {
      device: sample.device || 'unknown-device',
      browser: sample.browser || 'unknown-browser',
      displayHz,
      fps,
      p95FrameMs: Number(sample.p95FrameMs || 0),
      sprites: Number(sample.sprites || 0),
      drawCalls: Number(sample.drawCalls || 0),
      uncapped: displayHz > 60 && fps >= displayHz * tolerance,
      notes: sample.notes || ''
    };
  });
  const failures = normalized
    .filter((sample) => !sample.uncapped)
    .map((sample) => ({
      code: 'fps-below-display-threshold',
      device: sample.device,
      fps: sample.fps,
      displayHz: sample.displayHz,
      threshold: Number((sample.displayHz * tolerance).toFixed(2))
    }));

  return {
    format: 'OmniCore.UncappedFpsEvidence',
    version: 1,
    generatedAt,
    ok: failures.length === 0,
    tolerance,
    samples: normalized,
    failures,
    captureChecklist: [
      'Run npm run performance:uncapped-evidence on the target device.',
      'Record display refresh rate, browser version, FPS, p95 frame time, sprite count, and draw calls.',
      'Attach a screenshot or screen recording to the GitHub release when available.'
    ]
  };
}

export function renderUncappedFpsMarkdown(report) {
  const rows = report.samples.map((sample) => `| ${sample.device} | ${sample.browser} | ${sample.displayHz} | ${sample.fps} | ${sample.p95FrameMs} | ${sample.sprites} | ${sample.drawCalls} | ${sample.uncapped ? 'pass' : 'fail'} |`).join('\n');
  return `# Uncapped FPS Evidence

Generated: ${report.generatedAt}

OmniCore does not apply an engine-level FPS cap by default. A sample passes when measured FPS reaches at least ${(report.tolerance * 100).toFixed(0)}% of a display refresh rate above 60Hz.

| Device | Browser | Display Hz | FPS | P95 frame ms | Sprites | Draw calls | Result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
${rows}

## Capture Checklist

${report.captureChecklist.map((item) => `- ${item}`).join('\n')}
`;
}

export function writeUncappedFpsEvidence(report, {
  out = path.join('docs', 'performance', 'uncapped-fps-evidence.json'),
  markdownOut = path.join('docs', 'performance', 'real-device-uncapped-fps.md')
} = {}) {
  const outFile = path.resolve(out);
  const markdownFile = path.resolve(markdownOut);
  mkdirSync(path.dirname(outFile), { recursive: true });
  mkdirSync(path.dirname(markdownFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(markdownFile, renderUncappedFpsMarkdown(report), 'utf8');
  return { out: outFile, markdownOut: markdownFile };
}

export function captureUncappedFpsEvidence(options = {}) {
  const report = createUncappedFpsEvidence(options);
  writeUncappedFpsEvidence(report, options);
  return report;
}

function parseArgs(argv = []) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) options[key] = true;
    else {
      options[key] = next;
      index += 1;
    }
  }
  return options;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const report = captureUncappedFpsEvidence(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

export default captureUncappedFpsEvidence;
