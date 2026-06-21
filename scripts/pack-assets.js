#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PrefabManager } from '../src/prefab/PrefabManager.js';
import { collectSceneDependencies, normalizeSceneDocument } from '../src/scene/SceneDocument.js';

const args = parseArgs(process.argv.slice(2));
const assetsDir = path.resolve(args.assets || 'assets');
const spritesDir = path.join(assetsDir, 'sprites');
const scenesDir = args.scenes ? path.resolve(args.scenes) : null;
const prefabsDir = path.join(assetsDir, 'prefabs');
const referenceDirs = collectReferenceDirs(args.references, scenesDir, prefabsDir);
const outDir = path.resolve(args.out || path.join('dist', 'assets'));
const atlasDir = path.join(outDir, 'atlases');
const cachePath = path.join(outDir, '.pack-assets-cache.json');
const previousCache = readJson(cachePath, {});
const nextCache = {};
const rewriteMap = new Map();
const graph = {
  generatedAt: new Date().toISOString(),
  assets: [],
  scenes: [],
  sceneDependencies: [],
  prefabDependencies: []
};
const report = {
  packed: 0,
  skipped: 0,
  atlases: [],
  scenes: [],
  graph: slash(path.relative(process.cwd(), path.join(outDir, 'asset-graph.json')))
};

fs.mkdirSync(atlasDir, { recursive: true });

for (const group of collectSpriteGroups(spritesDir)) {
  const hash = hashFiles(group.files);
  const output = path.join(atlasDir, `${group.name}.atlas.json`);
  const texture = `atlases/${group.name}.png`;
  const dependencies = group.files.map((file) => `assets/${slash(path.relative(assetsDir, file))}`);
  nextCache[group.name] = hash;

  const atlas = buildAtlas(group, texture, dependencies);
  if (previousCache[group.name] === hash && fs.existsSync(output)) {
    report.skipped += 1;
  } else {
    writeJson(output, atlas);
    fs.writeFileSync(path.join(atlasDir, `${group.name}.png`), '', 'utf8');
    report.packed += 1;
  }

  for (const file of group.files) {
    const dependency = `assets/${slash(path.relative(assetsDir, file))}`;
    rewriteMap.set(dependency, `${slash(path.relative(outDir, output))}#${path.basename(file)}`);
  }

  const graphEntry = {
    group: group.name,
    output: slash(path.relative(outDir, output)),
    texture,
    hash,
    dependencies
  };
  graph.assets.push(graphEntry);
  report.atlases.push(graphEntry);
}

if (scenesDir && fs.existsSync(scenesDir)) {
  for (const sceneFile of listFiles(scenesDir).filter((file) => file.endsWith('.json'))) {
    const relative = slash(path.relative(scenesDir, sceneFile));
    const source = readJson(sceneFile, null);
    if (!source) continue;
    const dependencies = collectSceneDependencies(normalizeSceneDocument(source));
    const rewritten = rewriteTextures(source, rewriteMap);
    const destination = path.join(outDir, 'scenes', relative);
    writeJson(destination, rewritten.payload);
    const sceneEntry = {
      scene: relative,
      output: slash(path.relative(outDir, destination)),
      rewritten: rewritten.count,
      dependencies
    };
    graph.scenes.push(sceneEntry);
    graph.sceneDependencies.push({
      scene: relative,
      dependencies
    });
    report.scenes.push(sceneEntry);
  }
}

if (fs.existsSync(prefabsDir)) {
  for (const prefabFile of listFiles(prefabsDir).filter((file) => file.endsWith('.json'))) {
    const source = readJson(prefabFile, null);
    if (!source) continue;
    graph.prefabDependencies.push({
      prefab: `assets/${slash(path.relative(assetsDir, prefabFile))}`,
      dependencies: PrefabManager.collectDependencies(source)
    });
  }
}

const deadAssets = findDeadAssets(assetsDir, referenceDirs);
graph.deadAssets = deadAssets;
report.deadAssets = deadAssets;
report.deadBytes = deadAssets.reduce((sum, item) => sum + item.bytes, 0);

writeJson(path.join(outDir, 'asset-graph.json'), graph);
writeJson(cachePath, nextCache);
console.log(JSON.stringify(report, null, 2));

function collectSpriteGroups(root) {
  if (!fs.existsSync(root)) return [];
  const files = listFiles(root).filter(isImageFile);
  const groups = new Map();
  for (const file of files) {
    const relativeDir = slash(path.relative(root, path.dirname(file)));
    const group = relativeDir && relativeDir !== '.' ? relativeDir.replace(/[^\w.-]+/g, '-') : 'default';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(file);
  }
  return Array.from(groups.entries()).map(([name, groupFiles]) => ({
    name,
    files: groupFiles.sort((left, right) => left.localeCompare(right))
  }));
}

function buildAtlas(group, texture, dependencies) {
  const frames = {};
  group.files.forEach((file, index) => {
    const name = path.basename(file);
    const size = Math.max(16, Math.min(256, fs.statSync(file).size));
    frames[name] = {
      texture,
      source: dependencies[index],
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

function rewriteTextures(value, map) {
  let count = 0;
  const visit = (item) => {
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, visit(child)]));
    }
    if (typeof item === 'string') {
      const normalized = slash(item);
      const replacement = map.get(normalized);
      if (replacement) {
        count += 1;
        return replacement;
      }
    }
    return item;
  };
  return { payload: visit(value), count };
}

function hashFiles(files) {
  const hash = crypto.createHash('sha256');
  for (const file of files) {
    hash.update(slash(path.relative(process.cwd(), file)));
    hash.update(fs.readFileSync(file));
  }
  return hash.digest('hex');
}

function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

function isImageFile(file) {
  return /\.(?:png|jpe?g|webp|svg)$/iu.test(file);
}

function isTrimmableAsset(file) {
  return /\.(?:png|jpe?g|webp|svg|gif|mp3|ogg|wav|json)$/iu.test(file);
}

function collectReferenceDirs(value, ...fallbackDirs) {
  const dirs = [];
  for (const fallbackDir of fallbackDirs) {
    if (fallbackDir) dirs.push(fallbackDir);
  }
  if (value) {
    for (const item of String(value).split(',')) {
      const trimmed = item.trim();
      if (trimmed) dirs.push(path.resolve(trimmed));
    }
  }
  return [...new Set(dirs)].filter((dir) => fs.existsSync(dir));
}

function findDeadAssets(root, refs) {
  if (!fs.existsSync(root) || refs.length === 0) return [];
  const referenceText = refs
    .flatMap((dir) => listFiles(dir))
    .filter((file) => !file.includes(`${path.sep}node_modules${path.sep}`))
    .map((file) => safeReadText(file))
    .join('\n');
  const assets = listFiles(root).filter(isTrimmableAsset);
  return assets
    .map((file) => {
      const relative = slash(path.relative(root, file));
      const assetPath = `assets/${relative}`;
      return {
        path: assetPath,
        bytes: fs.statSync(file).size,
        reason: 'not-referenced',
        referenced: isAssetReferenced(referenceText, assetPath, relative)
      };
    })
    .filter((item) => !item.referenced)
    .map(({ referenced, ...item }) => item);
}

function isAssetReferenced(referenceText, assetPath, relative) {
  if (!referenceText) return false;
  const candidates = [assetPath, relative, `/${assetPath}`, `./${assetPath}`];
  return candidates.some((candidate) => referenceText.includes(candidate));
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function safeReadText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    options[arg.slice(2)] = argv[index + 1];
    index += 1;
  }
  return options;
}

function slash(value) {
  return String(value).replace(/\\/g, '/');
}
