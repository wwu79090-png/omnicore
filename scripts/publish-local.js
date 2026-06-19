#!/usr/bin/env node
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const port = Number(args.port ?? 4177);
const once = Boolean(args.once);
const telemetryReports = new Map();

if (!once) runBuild();

const server = createServer((request, response) => {
  const localUrl = makeUrl(request.headers.host || `127.0.0.1:${server.address().port}`);
  if (request.url?.startsWith('/__omnicore/telemetry')) {
    handleTelemetry(request, response);
    return;
  }
  if (request.url === '/publish' || request.url === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(publishPage(localUrl));
    return;
  }
  serveFile(request.url, response);
});

server.listen(port, '0.0.0.0', () => {
  const address = server.address();
  const publishUrl = makeUrl(`127.0.0.1:${address.port}`);
  console.log(`[OmniCore] local publish page: ${publishUrl}`);
  console.log(`[OmniCore] LAN publish page: ${makeUrl(`${findLanAddress()}:${address.port}`)}`);
  console.log(`[OmniCore] 远程设备遥测: ${makeTelemetryUrl(`127.0.0.1:${address.port}`)}`);
  console.log(`QRCode:\n${asciiQr(publishUrl)}`);
  console.log(wechatPreviewGuide(publishUrl));
  if (once) {
    fetchOnce(publishUrl).finally(() => {
      server.close();
      server.closeAllConnections?.();
    });
  }
});

function runBuild() {
  const result = spawnSync(process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm.cmd run build:prod']
    : ['run', 'build:prod'], {
    cwd: root,
    stdio: 'inherit'
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

function serveFile(urlPath, response) {
  const clean = decodeURIComponent((urlPath || '/').split('?')[0]).replace(/^\/+/, '');
  const file = path.resolve(root, 'dist', clean || 'omnicore.esm.js');
  if (!file.startsWith(path.resolve(root, 'dist')) || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, { 'content-type': contentType(file) });
  response.end(readFileSync(file));
}

function publishPage(url) {
  return `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OmniCore Publish</title></head>
  <body style="font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:24px">
    <h1>OmniCore Publish</h1>
    <p>手机连接同一局域网后访问：</p>
    <p><a style="color:#38bdf8" href="${url}">${url}</a></p>
    <pre>${asciiQr(url)}</pre>
    <section style="max-width:720px;line-height:1.7">
      <h2>微信小游戏预览指引</h2>
      <ol>
        <li>先运行平台导出命令生成微信小游戏目录。</li>
        <li>打开微信开发者工具，选择“导入小游戏项目”。</li>
        <li>导入后点击“预览”生成二维码，再用微信扫码真机预览。</li>
      </ol>
    </section>
    <section style="max-width:720px;line-height:1.7">
      <h2>远程设备遥测</h2>
      <p>手机端会向 <code>/__omnicore/telemetry</code> 上报视口、FPS、触摸轨迹和内存估算；电脑端可访问该端点查看最近设备状态。</p>
    </section>
    <script>
      (() => {
        const endpoint = '/__omnicore/telemetry';
        const deviceId = localStorage.getItem('omnicore:deviceId') || globalThis.crypto?.randomUUID?.() || String(Date.now());
        localStorage.setItem('omnicore:deviceId', deviceId);
        const touches = [];
        let frames = 0;
        let last = performance.now();
        let fps = 0;
        function frame(now) {
          frames += 1;
          if (now - last >= 1000) {
            fps = Math.round((frames * 1000) / (now - last));
            frames = 0;
            last = now;
          }
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        addEventListener('pointermove', (event) => {
          touches.push({ type: event.type, x: Math.round(event.clientX), y: Math.round(event.clientY), at: Date.now() });
          while (touches.length > 12) touches.shift();
        }, { passive: true });
        setInterval(() => {
          const memory = performance.memory?.usedJSHeapSize || 0;
          fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              deviceId,
              viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio || 1 },
              fps,
              memory,
              touches,
              url: location.href,
              userAgent: navigator.userAgent
            })
          }).catch(() => {});
        }, 1000);
      })();
    </script>
  </body>
</html>`;
}

function makeUrl(host) {
  return `http://${host}/publish`;
}

function makeTelemetryUrl(host) {
  return `http://${host}/__omnicore/telemetry`;
}

function findLanAddress() {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return '127.0.0.1';
}

function asciiQr(text) {
  const bits = Array.from(text).map((char) => char.charCodeAt(0));
  const rows = [];
  for (let y = 0; y < 13; y += 1) {
    let row = '';
    for (let x = 0; x < 25; x += 1) row += bits[(x + y) % bits.length] % (x + 3) < 3 ? '██' : '  ';
    rows.push(row);
  }
  return rows.join('\n');
}

function wechatPreviewGuide(url) {
  const telemetryUrl = url.replace('/publish', '/__omnicore/telemetry');
  return [
    '[OmniCore] 微信开发者工具预览指引：',
    '1. 运行 npm run export:platform -- --target wechat 生成微信小游戏目录。',
    '2. 打开微信开发者工具，选择“导入小游戏项目”，导入导出的目录。',
    `3. 在开发者工具点击“预览”生成二维码；也可以先访问本地发布页检查资源：${url}`,
    '4. 使用微信扫码在真实设备上预览，重点观察启动时间、贴图加载和触控输入。',
    `5. 电脑端打开远程设备遥测端点查看手机视口、FPS、触摸轨迹和内存：${telemetryUrl}`
  ].join('\n');
}

function handleTelemetry(request, response) {
  writeCors(response);
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.method === 'GET') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ devices: [...telemetryReports.values()] }, null, 2));
    return;
  }
  if (request.method !== 'POST') {
    response.writeHead(405);
    response.end('Method not allowed');
    return;
  }

  let body = '';
  request.on('data', (chunk) => {
    body += chunk.toString();
    if (body.length > 64 * 1024) request.destroy();
  });
  request.on('end', () => {
    const report = normalizeTelemetryReport(body, request);
    if (report.deviceId) telemetryReports.set(report.deviceId, report);
    trimTelemetryReports();
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: true, deviceId: report.deviceId || null }));
  });
}

function writeCors(response) {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type');
}

function normalizeTelemetryReport(body, request) {
  let payload = {};
  try {
    payload = JSON.parse(body || '{}');
  } catch {
    payload = {};
  }
  const remoteId = request.socket?.remoteAddress || 'device';
  return {
    deviceId: String(payload.deviceId || remoteId),
    updatedAt: Date.now(),
    viewport: payload.viewport || {},
    fps: Number.isFinite(Number(payload.fps)) ? Number(payload.fps) : null,
    memory: Number.isFinite(Number(payload.memory)) ? Number(payload.memory) : null,
    touches: Array.isArray(payload.touches) ? payload.touches.slice(-12) : [],
    url: payload.url || null,
    userAgent: payload.userAgent || request.headers['user-agent'] || null
  };
}

function trimTelemetryReports() {
  const reports = [...telemetryReports.values()].sort((left, right) => right.updatedAt - left.updatedAt);
  for (const report of reports.slice(8)) telemetryReports.delete(report.deviceId);
}

function contentType(file) {
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  return 'application/octet-stream';
}

async function fetchOnce(url) {
  const response = await fetch(url, { headers: { connection: 'close' } });
  await response.text();
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--port') {
      options.port = argv[index + 1];
      index += 1;
    } else if (argv[index] === '--once') {
      options.once = true;
    }
  }
  return options;
}
