#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const shouldOpenBrowser = args.has('--open') || !args.has('--no-open');

main();

function main() {
  console.log('[OmniCore] Dev launcher starting...');
  verifyNode();
  ensureDependencies();
  const server = spawnAsyncTool('npm', ['run', 'dev'], { cwd: root, stdio: 'inherit' });
  if (shouldOpenBrowser) setTimeout(() => openBrowser('http://localhost:5173/examples/index.html'), 2500);
  server.on('exit', (code) => process.exit(code || 0));
}

function verifyNode() {
  const version = process.versions.node;
  const major = Number(version.split('.')[0]);
  if (major < 18) {
    console.error(`[OmniCore] Node.js 18+ is required. Current: ${version}`);
    process.exit(1);
  }
  console.log(`[OmniCore] Node.js ${version}`);
}

function ensureDependencies() {
  if (existsSync(path.join(root, 'node_modules'))) return;
  console.log('[OmniCore] [Launcher] node_modules 不存在，正在执行 npm install。');
  run('npm', ['install']);
}

function run(command, args) {
  const result = spawnTool(command, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

function spawnTool(command, args, options) {
  if (process.platform === 'win32' && command === 'npm') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', ['npm.cmd', ...args].join(' ')], options);
  }
  return spawnSync(command, args, options);
}

function spawnAsyncTool(command, args, options) {
  if (process.platform === 'win32' && command === 'npm') {
    return spawn('cmd.exe', ['/d', '/s', '/c', ['npm.cmd', ...args].join(' ')], options);
  }
  return spawn(command, args, options);
}

function openBrowser(url) {
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
  } else if (process.platform === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  }
}
