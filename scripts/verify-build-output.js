#!/usr/bin/env node
import http from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { generateQualityReport } from './generate-quality-report.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function verifyBuildOutput({
  distDir = path.join(root, 'dist'),
  entry = 'omnicore-core.js',
  timeoutMs = 15000
} = {}) {
  const resolvedDistDir = path.resolve(distDir);
  const entryFile = path.join(resolvedDistDir, entry);
  if (!existsSync(entryFile)) throw new Error(`Build output missing: ${path.relative(root, entryFile)}`);
  const server = await startStaticServer(resolvedDistDir, entry);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    await page.goto(server.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForFunction(() => window.__OMNICORE_BUILD_READY__ === true, null, { timeout: timeoutMs });
    const bodyText = await page.locator('body').innerText();
    if (!bodyText.trim()) throw new Error('Build output failed white screen check.');
    return {
      ok: true,
      url: server.url,
      entry,
      bodyText
    };
  } finally {
    await browser.close();
    await server.close();
  }
}

async function startStaticServer(distDir, entry) {
  const resolvedDistDir = path.resolve(distDir);
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (url.pathname === '/') {
        response.setHeader('content-type', 'text/html; charset=utf-8');
        response.end(buildSmokeHtml(entry));
        return;
      }
      const file = path.resolve(resolvedDistDir, decodeURIComponent(url.pathname.replace(/^\//u, '')));
      if (!isPathInsideDirectory(file, resolvedDistDir)) {
        response.writeHead(403);
        response.end('forbidden');
        return;
      }
      response.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
      response.end(await readFile(file));
    } catch {
      response.writeHead(404);
      response.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

export function isPathInsideDirectory(file, directory) {
  const fileText = String(file);
  const directoryText = String(directory);
  const fileIsWindowsPath = isWindowsAbsolutePath(fileText);
  const directoryIsWindowsPath = isWindowsAbsolutePath(directoryText);
  if (fileIsWindowsPath !== directoryIsWindowsPath) return false;
  const pathApi = fileIsWindowsPath ? path.win32 : path;
  let resolvedFile = pathApi.resolve(fileText);
  let resolvedDirectory = pathApi.resolve(directoryText);
  if (fileIsWindowsPath) {
    resolvedFile = resolvedFile.toLowerCase();
    resolvedDirectory = resolvedDirectory.toLowerCase();
  }
  const relative = pathApi.relative(resolvedDirectory, resolvedFile);
  return relative === '' || (relative && !relative.startsWith('..') && !pathApi.isAbsolute(relative));
}

function isWindowsAbsolutePath(value) {
  return /^[a-z]:[\\/]/i.test(value) || /^\\\\[^\\]+\\[^\\]+/.test(value);
}

function buildSmokeHtml(entry) {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>OmniCore Build Smoke</title></head>
  <body style="background:#101827;color:#e5e7eb">
    <script type="module">
      import * as OmniCoreBuild from '/${entry}';
      window.__OMNICORE_BUILD_READY__ = Boolean(OmniCoreBuild && Object.keys(OmniCoreBuild).length);
      document.body.textContent = window.__OMNICORE_BUILD_READY__ ? 'OmniCore build ready' : '';
    </script>
  </body>
</html>`;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  try {
    if (process.env.OMNICORE_SKIP_POSTBUILD_VERIFY === '1') {
      generateQualityReport();
      console.log('[OmniCore] postbuild browser verification skipped.');
      process.exit(0);
    }
    const result = await verifyBuildOutput();
    generateQualityReport();
    console.log(`[OmniCore] postbuild browser verification passed: ${result.entry}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

export default verifyBuildOutput;
