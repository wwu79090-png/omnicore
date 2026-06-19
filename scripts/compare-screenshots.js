#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const options = parseArgs(process.argv.slice(2));
const threshold = Number(options.threshold ?? 0.05);
const baseline = path.resolve(options.baseline || 'tests/e2e/__screenshots__/editor-baseline.png');
const currentPattern = options.current || 'tests/e2e/__screenshots__/editor-current-*.png';
const output = path.resolve(options.out || 'docs/release-notes/screenshot-diff-report.md');
const currentFiles = resolveCurrentFiles(currentPattern);

if (!fs.existsSync(baseline)) {
  console.error(`Baseline screenshot not found: ${baseline}`);
  process.exit(1);
}
if (!currentFiles.length) {
  console.error(`No current screenshots matched: ${currentPattern}`);
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const comparisonPage = await browser.newPage();
const comparisonResults = [];
try {
  for (const current of currentFiles) {
    const diff = await compareImages(comparisonPage, baseline, current);
    comparisonResults.push({
      current,
      ...diff,
      passed: diff.diffRatio <= threshold
    });
  }
} finally {
  await browser.close();
}

const report = formatReport(comparisonResults, threshold);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, report, 'utf8');
console.log(report);
process.exit(comparisonResults.every((item) => item.passed) ? 0 : 1);

async function compareImages(targetPage, baselinePath, currentPath) {
  const baselineImageData = dataUrl(baselinePath);
  const currentImageData = dataUrl(currentPath);
  return targetPage.evaluate(async (payload) => {
    const [baselineImage, currentImage] = await Promise.all([
      loadImage(payload.baselineImageData),
      loadImage(payload.currentImageData)
    ]);
    const width = Math.min(baselineImage.width, currentImage.width);
    const height = Math.min(baselineImage.height, currentImage.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(baselineImage, 0, 0, width, height);
    const baselinePixels = ctx.getImageData(0, 0, width, height).data;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(currentImage, 0, 0, width, height);
    const currentPixels = ctx.getImageData(0, 0, width, height).data;
    let different = 0;
    for (let index = 0; index < baselinePixels.length; index += 4) {
      const delta = Math.abs(baselinePixels[index] - currentPixels[index])
        + Math.abs(baselinePixels[index + 1] - currentPixels[index + 1])
        + Math.abs(baselinePixels[index + 2] - currentPixels[index + 2])
        + Math.abs(baselinePixels[index + 3] - currentPixels[index + 3]);
      if (delta > 64) different += 1;
    }
    const total = width * height;
    return {
      width,
      height,
      differentPixels: different,
      totalPixels: total,
      diffRatio: total ? different / total : 1
    };

    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
      });
    }
  }, { baselineImageData, currentImageData });
}

function resolveCurrentFiles(pattern) {
  if (!pattern.includes('*')) {
    const file = path.resolve(pattern);
    return fs.existsSync(file) ? [file] : [];
  }
  const absolute = path.resolve(pattern);
  const dir = path.dirname(absolute);
  const name = path.basename(absolute);
  const regex = new RegExp(`^${escapeRegex(name).replace(/\\\*/g, '.*')}$`);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => regex.test(file))
    .map((file) => path.join(dir, file));
}

function formatReport(items, maxDiffRatio) {
  const lines = [
    '# 截图差异报告',
    '',
    `阈值：${formatPercent(maxDiffRatio)}`,
    '',
    '| 文件 | 差异比例 | 差异像素 | 判定 |',
    '| --- | ---: | ---: | --- |'
  ];
  for (const item of items) {
    lines.push(`| \`${slash(path.relative(process.cwd(), item.current))}\` | ${formatPercent(item.diffRatio)} | ${item.differentPixels}/${item.totalPixels} | ${item.passed ? '通过' : '报警'} |`);
  }
  return `${lines.join('\n')}\n`;
}

function dataUrl(file) {
  const ext = path.extname(file).slice(1).toLowerCase() || 'png';
  return `data:image/${ext};base64,${fs.readFileSync(file).toString('base64')}`;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    parsed[arg.slice(2)] = argv[index + 1];
    index += 1;
  }
  return parsed;
}

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function formatPercent(value) {
  return `${Number((value * 100).toFixed(2))}%`;
}

function slash(value) {
  return String(value).replace(/\\/g, '/');
}
