#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

checkCommand('node', ['--version']);
checkCommand('npm', ['--version']);

if (!existsSync(path.join(root, 'node_modules'))) {
  console.log('[OmniCore] node_modules missing; running npm install.');
  run('npm', ['install']);
}

if (dryRun) {
  console.log('[OmniCore] launch-dev dry run passed.');
  process.exit(0);
}

console.log('[OmniCore] starting development server.');
run('npm', ['run', 'dev']);

function checkCommand(command, args) {
  const result = spawnTool(command, args, {
    cwd: root,
    stdio: 'pipe',
    shell: false
  });
  if (result.status !== 0) {
    console.error(`[OmniCore] ${command} is required but was not found.`);
    process.exit(result.status || 1);
  }
  console.log(`[OmniCore] ${command}: ${String(result.stdout).trim()}`);
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
