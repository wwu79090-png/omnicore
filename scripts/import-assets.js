#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const options = parseArgs(process.argv.slice(2));
const sourceDir = path.resolve(ROOT, options.source || 'source-assets');
const assetsDir = path.resolve(ROOT, options.out || 'assets');
const manifestPath = path.resolve(ROOT, options.manifest || path.join('assets', 'assets.manifest.json'));
const strict = Boolean(options.strict);

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  sourceDir: relative(sourceDir),
  outputDir: relative(assetsDir),
  images: [],
  spriteSheets: [],
  audio: [],
  skipped: [],
  dependencies: {
    scenes: [],
    assets: []
  }
};

if (!fs.existsSync(sourceDir)) {
  fs.mkdirSync(sourceDir, { recursive: true });
  writeManifest();
  console.warn(`[import-assets] Created empty source directory: ${relative(sourceDir)}`);
  console.warn('[import-assets] Drop .png, .aseprite, .psd, or .mp3 files into source-assets/ and run again.');
  process.exit(0);
}

const converters = {
  aseprite: commandAvailable(options.aseprite || 'aseprite', ['--version']),
  magick: commandAvailable(options.magick || 'magick', ['-version']),
  ffmpeg: commandAvailable(options.ffmpeg || 'ffmpeg', ['-version'])
};

for (const file of walk(sourceDir)) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.png') importPng(file);
  else if (ext === '.aseprite') importAseprite(file);
  else if (ext === '.psd') importPsd(file);
  else if (ext === '.mp3') importMp3(file);
}

analyzeSceneDependencies();
writeManifest();

if (strict && manifest.skipped.length > 0) {
  console.error(`[import-assets] ${manifest.skipped.length} asset(s) were skipped.`);
  process.exit(1);
}

console.log(`[import-assets] Imported ${manifest.images.length} image(s), ${manifest.spriteSheets.length} sprite sheet(s), ${manifest.audio.length} audio file(s).`);
console.log(`[import-assets] Manifest: ${relative(manifestPath)}`);

function importPng(file) {
  const out = outputPath(file, 'sprites', '.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.copyFileSync(file, out);
  manifest.images.push({
    type: 'image',
    name: assetName(file),
    source: relative(file),
    url: slash(path.relative(assetsDir, out)),
    path: relative(out),
    referencedBy: []
  });
}

function importAseprite(file) {
  const sheet = outputPath(file, 'sprites', '.png');
  const data = outputPath(file, 'sprites', '.json');
  fs.mkdirSync(path.dirname(sheet), { recursive: true });
  if (!converters.aseprite) {
    skip(file, 'aseprite converter not found', { expected: 'aseprite -b input --sheet out.png --data out.json --format json-array' });
    return;
  }
  const result = spawnSync(options.aseprite || 'aseprite', [
    '-b',
    file,
    '--sheet',
    sheet,
    '--data',
    data,
    '--format',
    'json-array'
  ], { encoding: 'utf8' });
  if (result.status !== 0) {
    skip(file, 'aseprite conversion failed', { stderr: result.stderr?.trim() || result.error?.message || '' });
    return;
  }
  manifest.spriteSheets.push({
    type: 'spritesheet',
    name: assetName(file),
    source: relative(file),
    image: slash(path.relative(assetsDir, sheet)),
    data: slash(path.relative(assetsDir, data)),
    path: relative(sheet)
  });
}

function importPsd(file) {
  const out = outputPath(file, 'images', '.webp');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (!converters.magick) {
    skip(file, 'ImageMagick magick converter not found', { expected: 'magick input.psd[0] output.webp' });
    return;
  }
  const result = spawnSync(options.magick || 'magick', [`${file}[0]`, out], { encoding: 'utf8' });
  if (result.status !== 0) {
    skip(file, 'psd conversion failed', { stderr: result.stderr?.trim() || result.error?.message || '' });
    return;
  }
  manifest.images.push({
    type: 'image',
    name: assetName(file),
    source: relative(file),
    url: slash(path.relative(assetsDir, out)),
    path: relative(out),
    format: 'webp',
    referencedBy: []
  });
}

function analyzeSceneDependencies() {
  const sceneFiles = walk(sourceDir).filter((file) => isSceneJson(file));
  const imageByName = new Map();
  for (const image of manifest.images) {
    imageByName.set(path.basename(image.source || image.path), image);
    imageByName.set(path.basename(image.url || image.path), image);
    imageByName.set(image.name, image);
  }

  for (const sceneFile of sceneFiles) {
    let data = null;
    try {
      data = JSON.parse(fs.readFileSync(sceneFile, 'utf8'));
    } catch (error) {
      skip(sceneFile, 'scene dependency parse failed', { stderr: error.message });
      continue;
    }

    const refs = [...new Set(collectTextureReferences(data))];
    const sceneRel = relative(sceneFile);
    const references = refs.map((url) => {
      const resolved = resolveSceneReference(sceneFile, url, imageByName);
      if (resolved.image && !resolved.image.referencedBy.includes(sceneRel)) {
        resolved.image.referencedBy.push(sceneRel);
      }
      return {
        type: 'texture',
        url,
        exists: resolved.exists,
        source: resolved.source ? relative(resolved.source) : null,
        asset: resolved.image?.path || null
      };
    });

    manifest.dependencies.scenes.push({
      scene: sceneRel,
      references
    });
  }

  manifest.dependencies.assets = manifest.images
    .filter((image) => image.referencedBy?.length)
    .map((image) => ({
      path: image.path,
      url: image.url,
      referencedBy: [...image.referencedBy]
    }));
}

function isSceneJson(file) {
  if (path.basename(file).toLowerCase() === 'scene.json') return true;
  if (path.extname(file).toLowerCase() !== '.json') return false;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return data?.format === 'OmniCore.Scene.json' || Array.isArray(data?.entities) || Array.isArray(data?.children);
  } catch {
    return false;
  }
}

function collectTextureReferences(value, refs = []) {
  if (typeof value === 'string') {
    if (/\.(png|jpg|jpeg|webp|gif|svg)(?:$|[?#])/i.test(value)) refs.push(value);
    return refs;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectTextureReferences(item, refs));
    return refs;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      if (/^(texture|image|sprite|src|url|tileset|atlas)$/i.test(key)) collectTextureReferences(child, refs);
      else if (typeof child === 'object') collectTextureReferences(child, refs);
    });
  }
  return refs;
}

function resolveSceneReference(sceneFile, url, imageByName) {
  const basename = path.basename(url);
  const candidates = [
    path.resolve(path.dirname(sceneFile), url),
    path.resolve(sourceDir, url),
    path.resolve(assetsDir, url)
  ];
  const source = candidates.find((candidate) => fs.existsSync(candidate)) || null;
  const image = imageByName.get(basename)
    || imageByName.get(url.replace(/\.[^.]+$/u, ''))
    || null;
  return {
    exists: Boolean(source || image),
    source,
    image
  };
}

function importMp3(file) {
  const out = outputPath(file, 'audio', '.ogg');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (!converters.ffmpeg) {
    skip(file, 'ffmpeg converter not found', { expected: 'ffmpeg -y -i input.mp3 output.ogg' });
    return;
  }
  const result = spawnSync(options.ffmpeg || 'ffmpeg', ['-y', '-i', file, out], { encoding: 'utf8' });
  if (result.status !== 0) {
    skip(file, 'mp3 conversion failed', { stderr: result.stderr?.trim() || result.error?.message || '' });
    return;
  }
  manifest.audio.push({
    type: 'audio',
    name: assetName(file),
    source: relative(file),
    url: slash(path.relative(assetsDir, out)),
    path: relative(out),
    format: 'ogg'
  });
}

function skip(file, reason, detail = {}) {
  const item = {
    source: relative(file),
    reason,
    ...detail
  };
  manifest.skipped.push(item);
  console.warn(`[import-assets] skipped ${item.source}: ${reason}`);
}

function writeManifest() {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function outputPath(file, group, ext) {
  const rel = path.relative(sourceDir, file);
  const parsed = path.parse(rel);
  return path.join(assetsDir, group, parsed.dir, `${parsed.name}${ext}`);
}

function assetName(file) {
  return slash(path.relative(sourceDir, file)).replace(/\.[^.]+$/u, '');
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (entry.name.startsWith('.')) return [];
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return entry.isFile() ? [absolute] : [];
  });
}

function commandAvailable(command, versionArgs = ['--version']) {
  const result = spawnSync(command, versionArgs, {
    stdio: 'ignore',
    shell: false,
    windowsHide: true
  });
  return !result.error && result.status === 0;
}

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--strict') parsed.strict = true;
    else if (arg.startsWith('--')) parsed[arg.slice(2)] = args[i + 1];
  }
  return parsed;
}

function relative(file) {
  return slash(path.relative(ROOT, file));
}

function slash(value) {
  return String(value).replace(/\\/g, '/');
}
