#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = parseArgs(process.argv.slice(2));
// legacy threshold = 0.005; 2D crown CI enforces a stricter 0.1% pixel gate.
const threshold = 0.001;
const defaultThreshold = threshold;

export function compareVisualResults({
  examples = [],
  threshold: pixelThreshold = defaultThreshold,
  outDir = 'docs/release-notes/visual',
  generatedAt = new Date().toISOString()
} = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const results = examples.map((example) => {
    const width = Math.max(1, Number(example.width) || 1);
    const height = Math.max(1, Number(example.height) || 1);
    const diffPixels = Array.isArray(example.diffPixels) ? example.diffPixels : [];
    const diffRatio = diffPixels.length / (width * height);
    const pass = diffRatio < pixelThreshold;
    const result = {
      name: example.name,
      diffRatio,
      threshold: pixelThreshold,
      pass
    };
    if (!pass) {
      const heatmap = path.resolve(outDir, `${slugify(example.name)}-diff-heatmap.svg`);
      fs.writeFileSync(heatmap, buildHeatmapSvg({ width, height, diffPixels, name: example.name }), 'utf8');
      result.heatmap = heatmap;
      result.ciAttachment = {
        type: 'image/svg+xml',
        path: heatmap,
        label: `${example.name} diff heatmap`
      };
    }
    return result;
  });
  return {
    generatedAt,
    threshold: pixelThreshold,
    results,
    pass: results.every((item) => item.pass)
  };
}

export function buildHeatmapSvg({ width = 1, height = 1, diffPixels = [], name = 'visual-diff' } = {}) {
  const scale = Math.max(1, Math.ceil(240 / Math.max(width, height)));
  const rects = diffPixels.map((pixel) => {
    const x = Number(pixel.x) || 0;
    const y = Number(pixel.y) || 0;
    return `<rect data-diff-pixel="${x},${y}" x="${x * scale}" y="${y * scale}" width="${scale}" height="${scale}" fill="#ef4444" fill-opacity="0.85"/>`;
  }).join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" viewBox="0 0 ${width * scale} ${height * scale}" role="img" aria-label="${escapeXml(name)} diff heatmap">`,
    '<rect width="100%" height="100%" fill="#111827"/>',
    rects,
    buildBoundingBox(diffPixels, scale),
    '</svg>'
  ].join('');
}

function buildBoundingBox(diffPixels, scale) {
  if (!diffPixels.length) return '';
  const xs = diffPixels.map((pixel) => Number(pixel.x) || 0);
  const ys = diffPixels.map((pixel) => Number(pixel.y) || 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return `<rect x="${minX * scale}" y="${minY * scale}" width="${(maxX - minX + 1) * scale}" height="${(maxY - minY + 1) * scale}" fill="none" stroke="#fbbf24" stroke-width="2"/>`;
}

async function main() {
  const cliThreshold = Number(args.threshold) || defaultThreshold;
  const goldenPath = path.resolve(args.golden || 'tests/visual/golden/examples.json');
  const outPath = path.resolve(args.out || 'docs/release-notes/visual-regression-report.json');
  const outDir = path.resolve(args.heatmapDir || path.dirname(outPath), 'visual-diff-heatmaps');
  const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
  const report = compareVisualResults({
    examples: golden.examples || [],
    threshold: cliThreshold,
    outDir
  });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(1);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    options[arg.slice(2)] = argv[index + 1];
    index += 1;
  }
  return options;
}

function slugify(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'visual';
}

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
