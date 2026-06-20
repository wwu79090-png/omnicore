import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const EXPORT_PATTERN = /export\s+(?:class|function|const|let|var)\s+([A-Za-z0-9_]+)/g;
const DEFAULT_GENERATED_AT = '2026-06-20T00:00:00.000Z';

function resolveGeneratedAt() {
  if (process.env.OMNICORE_GENERATED_AT) return process.env.OMNICORE_GENERATED_AT;
  if (process.env.SOURCE_DATE_EPOCH) {
    const epoch = Number(process.env.SOURCE_DATE_EPOCH);
    if (Number.isFinite(epoch)) return new Date(epoch * 1000).toISOString();
  }
  return DEFAULT_GENERATED_AT;
}

/**
 * Generate a small structured API documentation site from source exports.
 */
export function generateApiDocs({
  srcDir = path.resolve('src'),
  outDir = path.resolve('docs/api-site'),
  siteDomain = 'docs.omnicore.dev',
  generatedAt = resolveGeneratedAt()
} = {}) {
  const files = listJavaScriptFiles(srcDir);
  const modules = files
    .map((file) => parseModule(file, srcDir))
    .filter((module) => module.exports.length > 0);
  mkdirSync(outDir, { recursive: true });
  const manifest = { generatedAt, modules };
  writeStableFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeStableFile(path.join(outDir, 'index.html'), renderHtml(manifest));
  if (siteDomain) writeStableFile(path.join(outDir, 'CNAME'), `${siteDomain}\n`);
  return manifest;
}

function listJavaScriptFiles(root) {
  if (!existsSync(root)) return [];
  const entries = readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(fullPath);
    return /\.(js|mjs)$/.test(entry.name) ? [fullPath] : [];
  });
}

function parseModule(file, srcDir) {
  const source = readFileSync(file, 'utf8');
  const exports = [];
  let match = EXPORT_PATTERN.exec(source);
  while (match) {
    exports.push(match[1]);
    match = EXPORT_PATTERN.exec(source);
  }
  return {
    path: path.relative(srcDir, file).replace(/\\/g, '/'),
    summary: firstJsDoc(source),
    exports
  };
}

function firstJsDoc(source) {
  const match = source.match(/\/\*\*([\s\S]*?)\*\//);
  if (!match) return '';
  return match[1]
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trim())
    .filter(Boolean)
    .join(' ');
}

function renderHtml({ generatedAt, modules }) {
  const rows = modules.map((module) => [
    '    <article>',
    `      <h2>${escapeHtml(module.path)}</h2>`,
    `      <p>${escapeHtml(module.summary)}</p>`,
    `      <code>${escapeHtml(module.exports.join(', '))}</code>`,
    '    </article>'
  ].join('\n')).join('\n');
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OmniCore API</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a; }
      main { max-width: 1080px; margin: 0 auto; padding: 32px 20px; }
      article { border-bottom: 1px solid #cbd5e1; padding: 16px 0; }
      code { color: #075985; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <main>
      <h1>OmniCore API</h1>
      <p>JSDoc powered HTML documentation site for OmniCore public modules.</p>
      <p>Generated at ${escapeHtml(generatedAt)}</p>
      ${rows}
    </main>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function writeStableFile(file, contents) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const tempFile = `${file}.${process.pid}.${attempt}.tmp`;
    try {
      writeFileSync(tempFile, contents);
      renameSync(tempFile, file);
      return;
    } catch (error) {
      lastError = error;
      if (existsSync(tempFile)) rmSync(tempFile, { force: true });
      if (!isRetryableWriteError(error)) break;
      sleepSync(10 * (attempt + 1));
    }
  }
  throw lastError;
}

function isRetryableWriteError(error) {
  return ['EBUSY', 'EPERM', 'EACCES', 'UNKNOWN'].includes(error?.code);
}

function sleepSync(ms) {
  if (typeof Atomics !== 'undefined' && typeof SharedArrayBuffer !== 'undefined') {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    return;
  }
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // Best-effort fallback for non-Node runtimes without Atomics.wait.
  }
}

export default generateApiDocs;
