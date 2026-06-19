#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { runCommand, resolvePackageCommand } from './lib/run-command.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultEngineRoot = path.resolve(scriptDir, '..');

export function parseBuildGameDemoArgs(args = process.argv.slice(2)) {
  if (args.length === 0) throw new Error('必须传入一个目标游戏项目路径。');
  if (args.length > 1) throw new Error('仅接收一个目标游戏项目路径参数。');
  return path.resolve(args[0]);
}

export async function runBuildGameDemo({
  targetProject,
  engineRoot = defaultEngineRoot,
  run = runCommand,
  copyPackage = copyEnginePackage,
  startServer = startPreviewServer,
  openBrowser = true
} = {}) {
  if (!targetProject) throw new Error('必须传入一个目标游戏项目路径。');
  const resolvedTarget = path.resolve(targetProject);
  const targetPackageRoot = path.join(resolvedTarget, 'node_modules', 'omnicore');
  const distDir = path.join(resolvedTarget, 'dist');

  await assertCommand(run(resolvePackageCommand('npm'), ['run', 'build'], { cwd: engineRoot }), '构建引擎失败');
  await copyPackage(engineRoot, targetPackageRoot);
  await assertCommand(run(resolvePackageCommand('npm'), ['run', 'build'], { cwd: resolvedTarget }), '打包游戏失败');
  const preview = await startServer(distDir);

  console.log(`[OmniCore] 预览地址：${preview.url}`);
  if (openBrowser) openUrl(preview.url);
  return {
    targetProject: resolvedTarget,
    targetPackageRoot,
    distDir,
    url: preview.url,
    server: preview.server || null
  };
}

export async function copyEnginePackage(engineRoot, targetRoot) {
  await rm(targetRoot, { recursive: true, force: true });
  await mkdir(targetRoot, { recursive: true });
  const entries = [
    'package.json',
    'src',
    'dist',
    'assets',
    'examples',
    'README.md',
    'CHANGELOG.md'
  ];

  await Promise.all(entries.map(async (entry) => {
    const source = path.join(engineRoot, entry);
    try {
      await stat(source);
    } catch {
      return;
    }
    await cp(source, path.join(targetRoot, entry), {
      recursive: true,
      force: true,
      dereference: true
    });
  }));
}

export async function startPreviewServer(distDir, { host = '127.0.0.1', port = 4173 } = {}) {
  const server = createServer(async (request, response) => {
    const filePath = resolveStaticPath(distDir, request.url || '/');
    if (!filePath) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    try {
      const info = await stat(filePath);
      const resolvedFile = info.isDirectory() ? path.join(filePath, 'index.html') : filePath;
      const finalInfo = await stat(resolvedFile);
      response.writeHead(200, {
        'content-length': finalInfo.size,
        'content-type': contentType(resolvedFile)
      });
      createReadStream(resolvedFile).pipe(response);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  return {
    server,
    url: `http://${host}:${server.address().port}/`
  };
}

function resolveStaticPath(root, requestUrl) {
  const url = new URL(requestUrl, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  const requested = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  return requested.startsWith(path.resolve(root)) ? requested : null;
}

async function assertCommand(commandPromise, message) {
  const result = await commandPromise;
  if (!result.ok) {
    throw new Error(`${message}\n${result.stderr || result.stdout || ''}`.trim());
  }
  return result;
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function openUrl(url) {
  const command = process.platform === 'win32'
    ? 'cmd'
    : process.platform === 'darwin'
      ? 'open'
      : 'xdg-open';
  const args = process.platform === 'win32'
    ? ['/c', 'start', '', url]
    : [url];
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref?.();
}

function isCli() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isCli()) {
  try {
    await runBuildGameDemo({ targetProject: parseBuildGameDemoArgs() });
  } catch (error) {
    console.error(`[OmniCore] ${error.message}`);
    process.exit(1);
  }
}
