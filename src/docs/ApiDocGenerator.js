import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const EXPORT_PATTERN = /export\s+(?:class|function|const|let|var)\s+([A-Za-z0-9_]+)/g;

/**
 * Generate a small structured API documentation site from source exports.
 */
export function generateApiDocs({
  srcDir = path.resolve('src'),
  outDir = path.resolve('docs/api-site'),
  siteDomain = 'docs.omnicore.dev'
} = {}) {
  const files = listJavaScriptFiles(srcDir);
  const modules = files
    .map((file) => parseModule(file, srcDir))
    .filter((module) => module.exports.length > 0);
  mkdirSync(outDir, { recursive: true });
  const manifest = { generatedAt: new Date().toISOString(), modules };
  writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(path.join(outDir, 'index.html'), renderHtml(manifest));
  if (siteDomain) writeFileSync(path.join(outDir, 'CNAME'), `${siteDomain}\n`);
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
  const rows = modules.map((module) => `
    <article>
      <h2>${escapeHtml(module.path)}</h2>
      <p>${escapeHtml(module.summary)}</p>
      <code>${escapeHtml(module.exports.join(', '))}</code>
    </article>
  `).join('');
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

export default generateApiDocs;
