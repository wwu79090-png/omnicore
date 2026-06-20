#!/usr/bin/env node
import { createServer } from 'node:http';
import {
  existsSync,
  readFileSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_25D_BUNDLE_PATH = path.join(root, 'examples', '25d-editor-deploy-loop.production-bundle.json');

export function create25DBundlePreviewHtml(bundle = {}) {
  const deployment = bundle.deployment || bundle;
  const manifest = deployment.manifest || bundle.manifest || {};
  const scene = findPreviewScene(deployment.files || bundle.files || []);
  const entities = Array.isArray(scene.entities) ? scene.entities : [];
  const coCreated = entities.filter((entity) => entity.coCreated || entity.coCreationPlan);
  const readiness = bundle.readiness || {};
  const visualEvidence = bundle.visualEvidence
    || findReportFile(bundle, 'reports/25d-visual-evidence.json')
    || {};
  const readyLabel = readiness.ready || bundle.productionReady ? 'Production Ready' : 'Needs Review';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OmniCore 2.5D Bundle Preview</title>
  <style>
    :root { color-scheme: dark; font-family: Arial, sans-serif; background: #07111f; color: #e2e8f0; }
    body { margin: 0; min-height: 100vh; background: #07111f; }
    main { display: grid; grid-template-rows: auto 1fr auto; min-height: 100vh; }
    header, footer { padding: 14px 18px; background: #0f172a; border-bottom: 1px solid #1e293b; }
    h1 { margin: 0; font-size: 20px; letter-spacing: 0; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; font-size: 12px; color: #bfdbfe; }
    .meta span { border: 1px solid #334155; padding: 4px 6px; background: #020617; }
    .stage { position: relative; min-height: 420px; overflow: hidden; background: linear-gradient(#10243a, #152c28 55%, #1f3b22); }
    .ground { position: absolute; left: 0; right: 0; bottom: 0; height: 34%; background: linear-gradient(#294a2a, #19351e); border-top: 1px solid rgba(255,255,255,.14); }
    .entity { position: absolute; display: grid; place-items: end center; box-sizing: border-box; border: 1px solid rgba(255,255,255,.25); color: #f8fafc; font-size: 11px; text-shadow: 0 1px 2px #000; }
    .entity[data-cocreated="true"] { place-items: start center; padding-top: 4px; border-color: #38bdf8; background: rgba(14,165,233,.16); box-shadow: 0 18px 32px rgba(15,23,42,.45); }
    .entity:not([data-cocreated="true"]) { background: rgba(34,197,94,.2); }
    .shadow { position: absolute; width: 72px; height: 18px; border-radius: 50%; background: rgba(0,0,0,.28); filter: blur(1px); }
    .occlusion { position: absolute; left: 0; right: 0; height: 1px; background: rgba(250,204,21,.8); }
    aside { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 12px 18px; background: #020617; }
    aside div { border: 1px solid #1e293b; padding: 8px; min-height: 52px; background: #0f172a; }
    aside strong { display: block; font-size: 12px; color: #93c5fd; }
    aside span { font-size: 18px; color: #ecfeff; }
  </style>
</head>
<body>
  <main data-25d-preview="true">
    <header>
      <h1>OmniCore 2.5D Bundle Preview</h1>
      <div class="meta">
        <span>${escapeHtml(readyLabel)}</span>
        <span>${escapeHtml(manifest.profile || 'unknown')}</span>
        <span>${escapeHtml((manifest.targets || []).join(', ') || 'no targets')}</span>
        <span>Visual Evidence ${visualEvidence.ready ? 'Ready' : 'Pending'}</span>
      </div>
    </header>
    <section class="stage" aria-label="2.5D scene preview">
      <div class="ground"></div>
      ${entities.map(renderPreviewEntity).join('\n      ')}
      ${coCreated.map(renderPreviewShadow).join('\n      ')}
      ${coCreated.map(renderPreviewOcclusion).join('\n      ')}
    </section>
    <aside>
      <div><strong>Scene</strong><span>${escapeHtml(scene.name || 'untitled')}</span></div>
      <div><strong>Entities</strong><span>${entities.length}</span></div>
      <div><strong>Co-created</strong><span>${coCreated.length}</span></div>
      <div><strong>Score</strong><span>${Number(readiness.score ?? 0)}</span></div>
    </aside>
    <footer>Bundle preview generated from ${escapeHtml(bundle.format || 'bundle')}</footer>
  </main>
</body>
</html>`;
}

export async function create25DBundlePreviewServer({
  bundlePath = DEFAULT_25D_BUNDLE_PATH,
  host = '127.0.0.1',
  port = 43210
} = {}) {
  const resolved = path.resolve(bundlePath);
  const bundle = readBundle(resolved);
  const html = create25DBundlePreviewHtml(bundle);
  const server = createServer((request, response) => {
    const url = new URL(request.url || '/', `http://${host}`);
    if (url.pathname === '/bundle.json') {
      send(response, 200, 'application/json; charset=utf-8', `${JSON.stringify(bundle, null, 2)}\n`);
      return;
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      send(response, 200, 'text/html; charset=utf-8', html);
      return;
    }
    send(response, 404, 'text/plain; charset=utf-8', 'Not found');
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  return {
    server,
    url: `http://${host}:${actualPort}/`,
    bundlePath: resolved,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    })
  };
}

function readBundle(file) {
  if (!existsSync(file)) {
    throw new Error(`2.5D production bundle not found: ${file}`);
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

function findPreviewScene(files = []) {
  const sceneFile = files.find((file) => slash(file.path).startsWith('scenes/'));
  return sceneFile?.data || { name: 'untitled', entities: [] };
}

function findReportFile(bundle, reportPath) {
  const files = [
    ...(bundle.files || []),
    ...(bundle.deployment?.files || [])
  ];
  return files.find((file) => slash(file.path) === reportPath)?.data || null;
}

function renderPreviewEntity(entity = {}) {
  const bounds = entityBounds(entity);
  return `<div class="entity" data-entity-id="${escapeAttr(entity.id)}" data-cocreated="${entity.coCreated ? 'true' : 'false'}" style="left:${bounds.x}px; top:${bounds.y}px; width:${bounds.width}px; height:${bounds.height}px; z-index:${bounds.zIndex};">${escapeHtml(entity.name || entity.id || 'entity')}</div>`;
}

function renderPreviewShadow(entity = {}) {
  const bounds = entityBounds(entity);
  return `<div class="shadow" data-shadow-for="${escapeAttr(entity.id)}" style="left:${bounds.x - 10}px; top:${bounds.baselineY - 8}px;"></div>`;
}

function renderPreviewOcclusion(entity = {}) {
  const bounds = entityBounds(entity);
  return `<div class="occlusion" data-occlusion-for="${escapeAttr(entity.id)}" style="top:${bounds.baselineY}px;"></div>`;
}

function entityBounds(entity = {}) {
  const width = Math.max(24, Number(entity.width ?? entity.bounds?.width ?? 48));
  const height = Math.max(24, Number(entity.height ?? entity.bounds?.height ?? 48));
  const x = Number(entity.x ?? entity.position?.x ?? 80);
  const y = Number(entity.y ?? entity.position?.y ?? 120);
  const baselineY = Number(entity.placement?.baselineY ?? y + height);
  return {
    x,
    y,
    width,
    height,
    baselineY,
    zIndex: Math.max(1, Math.round(baselineY))
  };
}

function send(response, status, contentType, body) {
  response.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store'
  });
  response.end(body);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--bundle' || arg === '--bundle-path') {
      index += 1;
      options.bundlePath = argv[index];
    } else if (arg === '--host') {
      index += 1;
      options.host = argv[index];
    } else if (arg === '--port') {
      index += 1;
      options.port = Number(argv[index]);
    }
  }
  return options;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

export async function main(argv = process.argv.slice(2)) {
  const preview = await create25DBundlePreviewServer(parseArgs(argv));
  console.log(`[OmniCore] 25D bundle preview: ${preview.url}`);
  return preview;
}

if (isCli()) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
