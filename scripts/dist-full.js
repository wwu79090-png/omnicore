#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageVersion = pkg.version || '0.0.0';
const version = process.env.OMNICORE_OFFLINE_VERSION || '1.0.0';
const zipName = `OmniCore-v${version}-Offline.zip`;
const staging = path.join(root, 'dist-offline', `OmniCore-v${version}`);
const output = path.join(root, zipName);

run('npm', ['run', 'build:prod']);
rmSync(path.dirname(staging), { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

[
  'src',
  'examples',
  'docs',
  'assets',
  'dist',
  'README.md',
  'CHANGELOG.md',
  'GOVERNANCE.md',
  'LTS.md',
  'package.json',
  'vite.config.js'
].forEach((entry) => copyIfExists(path.join(root, entry), path.join(staging, entry)));

writeFileSync(path.join(staging, 'index.html'), offlineIndex(version), 'utf8');
rmSync(output, { force: true });
compress(staging, output);
rmSync(path.dirname(staging), { recursive: true, force: true });
console.log(`[OmniCore] Offline package created: ${output} (package ${packageVersion})`);

function copyIfExists(from, to) {
  if (!existsSync(from)) return;
  cpSync(from, to, { recursive: true });
}

function run(command, args) {
  const result = spawnTool(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

function spawnTool(command, args, options) {
  if (process.platform === 'win32' && command === 'npm') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', ['npm.cmd', ...args.map(quoteCmdArg)].join(' ')], options);
  }
  const executable = executableFor(command);
  return spawnSync(executable, args, options);
}

function executableFor(command) {
  if (command === 'node') return process.execPath;
  return command;
}

function quoteCmdArg(value) {
  return /[\s"]/u.test(value) ? `"${String(value).replace(/"/g, '\\"')}"` : value;
}

function compress(source, target) {
  if (process.platform === 'win32') {
    const script = [
      '$ErrorActionPreference = "Stop"',
      '$WarningPreference = "Stop"',
      'Add-Type -AssemblyName System.IO.Compression.FileSystem',
      `$source = ${powershellLiteral(source)}`,
      `$target = ${powershellLiteral(target)}`,
      'if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force }',
      '[System.IO.Compression.ZipFile]::CreateFromDirectory($source, $target, [System.IO.Compression.CompressionLevel]::Fastest, $false)',
      'if (-not (Test-Path -LiteralPath $target)) { throw "Zip target was not created: $target" }'
    ].join('; ');
    const result = spawnSync('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script
    ], { encoding: 'utf8' });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0 || result.stderr.trim()) process.exit(result.status || 1);
    return;
  }
  const result = spawnSync('zip', ['-r', target, '.'], { cwd: source, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

function powershellLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function offlineIndex(currentVersion) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OmniCore Offline ${currentVersion}</title>
    <style>body{margin:0;background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;padding:24px}a{color:#38bdf8}</style>
  </head>
  <body>
    <h1>OmniCore v${currentVersion} Offline Package</h1>
    <p>包含源码、构建产物、官方示例、文档和默认素材。可直接查看 examples/index.html 或 examples/game-demo/index.html。</p>
    <ul>
      <li><a href="./README.md">README.md</a></li>
      <li><a href="./examples/index.html">基础示例</a></li>
      <li><a href="./examples/game-demo/index.html">官方小游戏 Demo</a></li>
      <li><a href="./docs/tutorial-first-hour.md">第一小时教程</a></li>
    </ul>
  </body>
</html>
`;
}
