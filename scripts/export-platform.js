#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ExportPaywall from '../src/commercial/ExportPaywall.js';

const args = parseArgs(process.argv.slice(2));
const target = args.target || 'html5';
const outDir = path.resolve(args.out || `dist/export-${target}`);
const license = args.license || process.env.OMNICORE_PRO_LICENSE || '';
const paywall = new ExportPaywall({ license });

try {
  paywall.assertExport(target);
  mkdirSync(outDir, { recursive: true });
  const files = createExportFiles(target);
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(outDir, name);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf8');
  }
  writeFileSync(path.join(outDir, 'export-manifest.json'), JSON.stringify({
    engine: 'OmniCore',
    target,
    generatedAt: new Date().toISOString(),
    proFeature: 'one-click-platform-export'
  }, null, 2), 'utf8');
  console.log(`[OmniCore] 已导出 ${target} 平台包：${outDir}`);
} catch (error) {
  console.error(`[OmniCore] ${error.message || error}`);
  process.exit(2);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
    } else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

function createExportFiles(exportTarget) {
  if (exportTarget === 'html5') return createHtml5Files();
  if (exportTarget === 'wechat') return createWechatFiles();
  if (exportTarget === 'douyin') return createDouyinFiles();
  throw new Error(`不支持的一键导出目标：${exportTarget}`);
}

function createHtml5Files() {
  return {
    'index.html': `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OmniCore HTML5 Export</title>
  <style>html,body,#app{margin:0;width:100%;height:100%;background:#111827;color:#e5e7eb}</style>
</head>
<body>
  <div id="app"></div>
  <script type="module">
    import OmniCore from './omnicore.esm.js';
    const game = await new OmniCore.Game({ parent: '#app', renderer: 'auto', autoStart: false }).init();
    console.log('[OmniCore] HTML5 export ready', game);
  </script>
</body>
</html>
`
  };
}

function createWechatFiles() {
  return {
    'game.json': JSON.stringify({ deviceOrientation: 'landscape', networkTimeout: { request: 10000 } }, null, 2),
    'project.config.json': JSON.stringify({
      appid: 'touristappid',
      projectname: 'OmniCore WeChat Export',
      miniprogramRoot: './'
    }, null, 2),
    'wechat-adapter.js': `globalThis.window = globalThis;
globalThis.document = globalThis.document || { createElement: () => wx.createCanvas() };
globalThis.fetch = (url, options = {}) => new Promise((resolve, reject) => {
  wx.request({
    url,
    method: options.method || 'GET',
    data: options.body,
    success: (res) => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, json: async () => res.data, text: async () => String(res.data) }),
    fail: reject
  });
});
`
  };
}

function createDouyinFiles() {
  return {
    'game.json': JSON.stringify({ deviceOrientation: 'landscape' }, null, 2),
    'project.config.json': JSON.stringify({
      appid: 'testappid',
      projectname: 'OmniCore Douyin Export',
      miniprogramRoot: './'
    }, null, 2),
    'douyin-adapter.js': `const ttApi = globalThis.tt;
globalThis.window = globalThis;
globalThis.fetch = (url, options = {}) => new Promise((resolve, reject) => {
  ttApi.request({
    url,
    method: options.method || 'GET',
    data: options.body,
    success: (res) => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, json: async () => res.data, text: async () => String(res.data) }),
    fail: reject
  });
});
`
  };
}
