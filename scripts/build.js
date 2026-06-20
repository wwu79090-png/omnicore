#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { create3DAssetReport, MODEL_COMPLEXITY_WARNING } from './check-3d-assets.js';

export function parseBuildArgs(argv = []) {
  const options = {
    check3d: false,
    dryRun: false,
    root: process.cwd(),
    viteArgs: []
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check-3d') options.check3d = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--root') {
      index += 1;
      options.root = path.resolve(argv[index]);
    } else {
      options.viteArgs.push(arg);
    }
  }
  return options;
}

export function runBuild(argv = process.argv.slice(2)) {
  const options = parseBuildArgs(argv);
  if (options.check3d) {
    const report = create3DAssetReport({ root: options.root });
    if (!report.ok) {
      for (const violation of report.violations) {
        process.stderr.write(`${MODEL_COMPLEXITY_WARNING} ${violation.file} ${violation.type}=${violation.value} limit=${violation.limit}\n`);
      }
      throw new Error(`${MODEL_COMPLEXITY_WARNING} ${report.violations.length} violation(s)`);
    }
  }
  if (options.dryRun) {
    const result = { ok: true, dryRun: true, check3d: options.check3d };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  }
  const viteBin = path.resolve('node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [viteBin, 'build', ...options.viteArgs], {
    cwd: options.root,
    stdio: 'inherit',
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status || 1;
  return { ok: result.status === 0, status: result.status };
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  try {
    const result = runBuild();
    if (result.ok === false) process.exitCode = result.status || 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
