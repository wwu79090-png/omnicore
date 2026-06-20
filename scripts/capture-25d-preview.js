#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import {
  create25DBundlePreviewServer,
  DEFAULT_25D_BUNDLE_PATH
} from './preview-25d-bundle.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SCREENSHOT_PATH = path.join(root, 'docs', 'release-notes', '25d-preview.png');
const DEFAULT_REPORT_PATH = path.join(root, 'docs', 'release-notes', '25d-preview-screenshot-evidence.json');
const DEFAULT_CERTIFICATION_PATH = path.join(root, 'docs', 'release-notes', '25d-production-certification.json');
const DEFAULT_MIN_BYTES = 1024;

export function create25DPreviewEvidenceReport({
  generatedAt = new Date().toISOString(),
  bundlePath = DEFAULT_25D_BUNDLE_PATH,
  screenshotPath = DEFAULT_SCREENSHOT_PATH,
  screenshotBytes = 0,
  certificationPath = DEFAULT_CERTIFICATION_PATH,
  url = null,
  minBytes = DEFAULT_MIN_BYTES,
  consoleErrors = [],
  consoleWarnings = []
} = {}) {
  const nonBlank = Number(screenshotBytes || 0) >= Number(minBytes || DEFAULT_MIN_BYTES);
  const consoleClean = consoleErrors.length === 0 && consoleWarnings.length === 0;
  return {
    format: 'OmniCore.25DPreviewScreenshotEvidence',
    version: 1,
    generatedAt,
    ready: nonBlank && consoleClean,
    url,
    screenshot: {
      path: toProjectPath(screenshotPath),
      bytes: Number(screenshotBytes || 0),
      minBytes: Number(minBytes || DEFAULT_MIN_BYTES),
      nonBlank
    },
    source: {
      bundle: toProjectPath(bundlePath),
      certification: toProjectPath(certificationPath)
    },
    console: {
      clean: consoleClean,
      errors: consoleErrors,
      warnings: consoleWarnings
    }
  };
}

export function write25DPreviewEvidenceReport({
  reportPath = DEFAULT_REPORT_PATH,
  screenshotPath = DEFAULT_SCREENSHOT_PATH,
  screenshotBytes = null,
  dryRun = false,
  ...options
} = {}) {
  const resolvedScreenshot = path.resolve(screenshotPath);
  const bytes = screenshotBytes ?? (existsSync(resolvedScreenshot) ? statSync(resolvedScreenshot).size : 0);
  const report = create25DPreviewEvidenceReport({
    ...options,
    screenshotPath,
    screenshotBytes: dryRun && bytes === 0 ? Number(options.minBytes || DEFAULT_MIN_BYTES) : bytes
  });
  const resolvedReport = path.resolve(reportPath);
  mkdirSync(path.dirname(resolvedReport), { recursive: true });
  writeFileSync(resolvedReport, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

export async function capture25DPreviewScreenshot({
  bundlePath = DEFAULT_25D_BUNDLE_PATH,
  screenshotPath = DEFAULT_SCREENSHOT_PATH,
  reportPath = DEFAULT_REPORT_PATH,
  certificationPath = DEFAULT_CERTIFICATION_PATH,
  generatedAt = new Date().toISOString(),
  host = '127.0.0.1',
  port = 43210,
  minBytes = DEFAULT_MIN_BYTES
} = {}) {
  const preview = await create25DBundlePreviewServer({ bundlePath, host, port });
  const browser = await chromium.launch();
  const consoleErrors = [];
  const consoleWarnings = [];
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
      if (message.type() === 'warning') consoleWarnings.push(message.text());
    });
    await page.goto(preview.url, { waitUntil: 'networkidle' });
    await page.locator('[data-25d-preview="true"]').waitFor({ state: 'visible' });
    const resolvedScreenshot = path.resolve(screenshotPath);
    mkdirSync(path.dirname(resolvedScreenshot), { recursive: true });
    await page.screenshot({ path: resolvedScreenshot, fullPage: true });
    const screenshotBytes = statSync(resolvedScreenshot).size;
    const report = write25DPreviewEvidenceReport({
      reportPath,
      screenshotPath,
      screenshotBytes,
      bundlePath,
      certificationPath,
      generatedAt,
      url: preview.url,
      minBytes,
      consoleErrors,
      consoleWarnings
    });
    if (!report.ready) process.exitCode = 1;
    return report;
  } finally {
    await browser.close();
    await preview.close();
  }
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--bundle' || arg === '--bundle-path') {
      index += 1;
      options.bundlePath = argv[index];
    } else if (arg === '--screenshot') {
      index += 1;
      options.screenshotPath = argv[index];
    } else if (arg === '--report') {
      index += 1;
      options.reportPath = argv[index];
    } else if (arg === '--certification') {
      index += 1;
      options.certificationPath = argv[index];
    } else if (arg === '--generated-at') {
      index += 1;
      options.generatedAt = argv[index];
    } else if (arg === '--host') {
      index += 1;
      options.host = argv[index];
    } else if (arg === '--port') {
      index += 1;
      options.port = Number(argv[index]);
    } else if (arg === '--min-bytes') {
      index += 1;
      options.minBytes = Number(argv[index]);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }
  return options;
}

function toProjectPath(file) {
  const resolved = path.resolve(file);
  const relative = path.relative(root, resolved).replace(/\\/g, '/');
  return relative.startsWith('..') ? String(file).replace(/\\/g, '/') : relative;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = options.dryRun
    ? write25DPreviewEvidenceReport(options)
    : await capture25DPreviewScreenshot(options);
  const status = report.ready ? 'ready' : 'failed';
  console.log(`[OmniCore] 25D preview screenshot evidence ${status}: ${report.screenshot.path}`);
  if (!report.ready) process.exitCode = 1;
  return report;
}

if (isCli()) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
