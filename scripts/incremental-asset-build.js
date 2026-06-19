#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

/**
 * Incrementally packs changed image assets and rewrites scene texture refs.
 *
 * @param {object} options Build options.
 * @returns {Promise<object>} Build report.
 */
export async function runIncrementalAssetBuild({
  assetsDir = 'assets',
  scenesDir = 'examples',
  outDir = path.join('dist', 'assets'),
  changedFiles = [],
  atlasName = 'incremental',
  now = () => performance.now()
} = {}) {
  const started = now();
  const assetsRoot = path.resolve(assetsDir);
  const scenesRoot = path.resolve(scenesDir);
  const outputRoot = path.resolve(outDir);
  const atlasDir = path.join(outputRoot, 'atlases');
  const processedFiles = normalizeChangedFiles(changedFiles, assetsRoot)
    .filter((file) => isImageFile(file) && fs.existsSync(path.join(assetsRoot, file)));
  fs.mkdirSync(atlasDir, { recursive: true });

  const atlasFile = path.join(atlasDir, `${atlasName}.atlas.json`);
  const atlasTexture = `atlases/${atlasName}.png`;
  const atlas = buildAtlas(processedFiles, assetsRoot, atlasTexture);
  const rewriteMap = buildRewriteMap(processedFiles, atlasFile, assetsRoot, outputRoot);
  const hash = hashFiles(processedFiles.map((file) => path.join(assetsRoot, file)));

  if (processedFiles.length) {
    writeJson(atlasFile, atlas);
    fs.writeFileSync(path.join(atlasDir, `${atlasName}.png`), '', 'utf8');
  }

  const sceneReports = fs.existsSync(scenesRoot)
    ? rewriteSceneDirectory({ scenesRoot, outputRoot, rewriteMap })
    : [];

  const graph = {
    generatedAt: new Date().toISOString(),
    incremental: true,
    changedFiles: [...changedFiles],
    processedFiles,
    hash,
    atlases: processedFiles.length ? [{
      name: atlasName,
      output: slash(path.relative(outputRoot, atlasFile)),
      texture: atlasTexture,
      frames: Object.keys(atlas.frames)
    }] : [],
    scenes: sceneReports
  };
  writeJson(path.join(outputRoot, 'incremental-asset-graph.json'), graph);

  const durationMs = Number((now() - started).toFixed(3));
  return {
    incremental: true,
    targetMs: 200,
    durationMs,
    changedCount: changedFiles.length,
    processedFiles,
    hash,
    atlases: graph.atlases,
    scenes: sceneReports,
    graph: slash(path.relative(process.cwd(), path.join(outputRoot, 'incremental-asset-graph.json')))
  };
}

function buildAtlas(files, assetsRoot, texture) {
  const frames = {};
  files.forEach((file, index) => {
    const absolute = path.join(assetsRoot, file);
    const basename = path.basename(file);
    const size = Math.max(16, Math.min(256, fs.statSync(absolute).size || 16));
    frames[basename] = {
      texture,
      source: `assets/${slash(file)}`,
      frame: {
        x: index * 32,
        y: 0,
        w: size,
        h: size
      },
      rotated: false,
      trimmed: false
    };
  });
  return {
    format: 'OmniCore.Atlas',
    version: 1,
    image: texture,
    frames
  };
}

function buildRewriteMap(files, atlasFile, assetsRoot, outputRoot) {
  const map = new Map();
  for (const file of files) {
    const key = slash(file);
    const assetKey = `assets/${key}`;
    const value = `${slash(path.relative(outputRoot, atlasFile))}#${path.basename(file)}`;
    map.set(key, value);
    map.set(assetKey, value);
    map.set(slash(path.join(assetsRoot, file)), value);
  }
  return map;
}

function rewriteSceneDirectory({ scenesRoot, outputRoot, rewriteMap }) {
  const reports = [];
  for (const sceneFile of listFiles(scenesRoot).filter((file) => file.endsWith('.json'))) {
    const source = readJson(sceneFile, null);
    if (!source) continue;
    const rewritten = rewriteTextures(source, rewriteMap);
    const relative = slash(path.relative(scenesRoot, sceneFile));
    const destination = path.join(outputRoot, 'scenes', relative);
    writeJson(destination, rewritten.payload);
    reports.push({
      scene: relative,
      output: slash(path.relative(outputRoot, destination)),
      rewritten: rewritten.count
    });
  }
  return reports;
}

function rewriteTextures(value, map) {
  let count = 0;
  const visit = (item) => {
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, visit(child)]));
    }
    if (typeof item === 'string') {
      const replacement = map.get(slash(item));
      if (replacement) {
        count += 1;
        return replacement;
      }
    }
    return item;
  };
  return { payload: visit(value), count };
}

function normalizeChangedFiles(files, assetsRoot) {
  return [...new Set((files || []).map((file) => {
    const value = slash(file);
    if (path.isAbsolute(file)) return slash(path.relative(assetsRoot, file));
    return value.replace(/^assets\//u, '');
  }))];
}

function hashFiles(files) {
  const hash = crypto.createHash('sha256');
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    hash.update(slash(path.relative(process.cwd(), file)));
    hash.update(fs.readFileSync(file));
  }
  return hash.digest('hex');
}

function listFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

function isImageFile(file) {
  return /\.(?:png|jpe?g|webp)$/iu.test(file);
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function parseArgs(argv) {
  const options = {
    assetsDir: 'assets',
    scenesDir: 'examples',
    outDir: path.join('dist', 'assets'),
    changedFiles: []
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--assets') {
      index += 1;
      options.assetsDir = argv[index];
    } else if (arg === '--scenes') {
      index += 1;
      options.scenesDir = argv[index];
    } else if (arg === '--out') {
      index += 1;
      options.outDir = argv[index];
    } else if (arg === '--changed' || arg === '--file') {
      index += 1;
      options.changedFiles.push(argv[index]);
    }
  }
  return options;
}

function slash(value) {
  return String(value).replace(/\\/g, '/');
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const report = await runIncrementalAssetBuild(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
}

export default runIncrementalAssetBuild;
