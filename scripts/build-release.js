#!/usr/bin/env node
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TEXT_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest']);

export function parseReleaseBuildArgs(argv = []) {
  const options = {
    root: process.cwd(),
    assetsDir: 'assets',
    distDir: 'dist',
    skipVite: false,
    viteArgs: []
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      index += 1;
      options.root = path.resolve(argv[index]);
    } else if (arg === '--assets') {
      index += 1;
      options.assetsDir = argv[index];
    } else if (arg === '--dist') {
      index += 1;
      options.distDir = argv[index];
    } else if (arg === '--skip-vite') options.skipVite = true;
    else options.viteArgs.push(arg);
  }
  return options;
}

export async function buildRelease(input = {}) {
  const options = {
    ...parseReleaseBuildArgs([]),
    ...input
  };
  const root = path.resolve(options.root);
  const assetsRoot = path.resolve(root, options.assetsDir);
  const distRoot = path.resolve(root, options.distDir);

  if (!options.skipVite) runViteBuild(root, options.viteArgs);
  mkdirSync(distRoot, { recursive: true });

  const copiedAssets = copyAssetsIntoDist({ assetsRoot, distRoot });
  const rewrittenFiles = rewriteDistAssetPaths(distRoot);
  const report = {
    ok: true,
    root,
    distRoot,
    assetsRoot,
    copiedAssets,
    rewrittenFiles
  };
  writeFileSync(path.join(distRoot, 'release-build-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

function runViteBuild(root, viteArgs = []) {
  const viteBin = path.resolve(root, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [viteBin, 'build', ...viteArgs], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`vite build failed with exit code ${result.status}`);
}

function copyAssetsIntoDist({ assetsRoot, distRoot }) {
  if (!existsSync(assetsRoot)) return [];
  const target = path.join(distRoot, 'assets');
  mkdirSync(target, { recursive: true });
  cpSync(assetsRoot, target, { recursive: true });
  return listFiles(target);
}

function rewriteDistAssetPaths(distRoot) {
  const rewritten = [];
  for (const file of listFiles(distRoot)) {
    if (!TEXT_EXTENSIONS.has(path.extname(file))) continue;
    const before = readFileSync(file, 'utf8');
    const after = rewriteAssetReferences(before);
    if (after === before) continue;
    writeFileSync(file, after, 'utf8');
    rewritten.push(file);
  }
  return rewritten;
}

export function rewriteAssetReferences(source = '') {
  return String(source)
    .replace(/(["'(`])\/+assets\//g, '$1assets/')
    .replace(/(["'(`])(?:\.\.\/)+assets\//g, '$1assets/')
    .replace(/(["'(`])\.\/assets\//g, '$1assets/');
}

function listFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) visit(full);
      else files.push(full);
    }
  };
  visit(root);
  return files;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  buildRelease(parseReleaseBuildArgs(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
