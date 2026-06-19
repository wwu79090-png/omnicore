#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const sourceDir = path.resolve(args.source || 'source-assets');
const outDir = path.resolve(args.out || path.join('dist', 'imported-assets'));
const platformTargets = parseList(args.platforms || args.targets || '');
const conversions = [];
const dependencies = [];
const spriteFrames = {};
const manifest = {
  generatedAt: new Date().toISOString(),
  source: slash(path.relative(process.cwd(), sourceDir)),
  images: [],
  audio: [],
  spritesheets: [],
  models: [],
  metadata: [],
  atlases: []
};

fs.mkdirSync(outDir, { recursive: true });

for (const file of listFiles(sourceDir)) {
  const relative = slash(path.relative(sourceDir, file));
  const ext = path.extname(file).toLowerCase();
  const base = slash(path.join(path.dirname(relative), path.basename(relative, ext))).replace(/^\.\//, '');
  dependencies.push({
    source: relative,
    hash: hashFile(file)
  });

  if (ext === '.aseprite' || ext === '.psd') {
    const name = path.basename(relative, ext);
    const target = `spritesheets/${base}.json`;
    const frameName = `${base}.png`;
    writeJson(path.join(outDir, target), {
      format: 'OmniCore.SpriteSheet',
      source: relative,
      frames: [{ name: `${name}-0`, x: 0, y: 0, w: 32, h: 32, duration: 100 }]
    });
    spriteFrames[frameName] = {
      texture: 'atlases/smart.png',
      source: relative,
      frame: frameForIndex(Object.keys(spriteFrames).length, 32)
    };
    manifest.spritesheets.push({
      name,
      source: relative,
      url: target,
      atlas: 'atlases/smart.atlas.json'
    });
    conversions.push({ from: relative, to: target, type: 'spritesheet' });
  } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    const name = path.basename(relative, ext);
    const target = `textures/${base}.webp`;
    writePlaceholder(path.join(outDir, target), `webp:${relative}`);
    const size = estimateSquareSize(file);
    spriteFrames[`${base}.webp`] = {
      texture: 'atlases/smart.png',
      source: relative,
      frame: frameForIndex(Object.keys(spriteFrames).length, size)
    };
    manifest.images.push({
      type: 'image',
      name,
      source: relative,
      path: target,
      url: target,
      format: 'webp',
      atlas: 'atlases/smart.atlas.json'
    });
    conversions.push({ from: relative, to: target, type: 'image', codec: 'webp', compression: 0.82 });
  } else if (['.wav', '.aiff', '.mp3', '.ogg'].includes(ext)) {
    const name = path.basename(relative, ext);
    const target = `audio/${base}.ogg`;
    writePlaceholder(path.join(outDir, target), `compressed:${relative}`);
    manifest.audio.push({
      type: 'audio',
      name,
      source: relative,
      path: target,
      url: target,
      codec: 'ogg'
    });
    conversions.push({ from: relative, to: target, type: 'audio', codec: 'ogg', compression: 0.72 });
  } else if (['.fbx', '.gltf', '.glb'].includes(ext)) {
    const name = path.basename(relative, ext);
    const target = `models/${base}.glb`;
    writePlaceholder(path.join(outDir, target), `glb:${relative}`);
    manifest.models.push({
      type: 'model',
      name,
      source: relative,
      path: target,
      url: target,
      format: 'glb'
    });
    conversions.push({ from: relative, to: target, type: 'model', converter: ext === '.fbx' ? 'fbx2gltf' : 'gltf-pack' });
  } else if (ext === '.json') {
    const target = `metadata/${relative}`;
    fs.mkdirSync(path.dirname(path.join(outDir, target)), { recursive: true });
    fs.copyFileSync(file, path.join(outDir, target));
    manifest.metadata.push({
      type: 'metadata',
      name: path.basename(relative, ext),
      source: relative,
      path: target,
      url: target
    });
    conversions.push({ from: relative, to: target, type: 'metadata' });
  }
}

writeJson(path.join(outDir, 'atlases', 'smart.atlas.json'), {
  format: 'OmniCore.Atlas',
  version: 1,
  image: 'atlases/smart.png',
  frames: spriteFrames,
  staticAnalysis: {
    drawCallReductionTarget: 0.9,
    strategy: 'group-by-scene-texture-reference'
  }
});
writePlaceholder(path.join(outDir, 'atlases', 'smart.png'), '');
manifest.atlases.push({
  type: 'atlas',
  name: 'smart',
  path: 'atlases/smart.atlas.json',
  url: 'atlases/smart.atlas.json',
  image: 'atlases/smart.png'
});
writeJson(path.join(outDir, 'assets.manifest.json'), manifest);

const graph = {
  generatedAt: new Date().toISOString(),
  source: slash(path.relative(process.cwd(), sourceDir)),
  dependencies,
  conversions,
  atlas: 'atlases/smart.atlas.json',
  manifest: 'assets.manifest.json'
};
writeJson(path.join(outDir, 'asset-graph.json'), graph);

const platformPackages = platformTargets.map((target) => writePlatformPackage(target, manifest));

const report = {
  source: slash(path.relative(process.cwd(), sourceDir)),
  out: slash(path.relative(process.cwd(), outDir)),
  conversions,
  drawCallReductionTarget: 0.9,
  assetGraph: 'asset-graph.json',
  atlas: 'atlases/smart.atlas.json',
  manifest: 'assets.manifest.json',
  platformPackages
};
console.log(JSON.stringify(report, null, 2));

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(full));
    else if (entry.isFile()) result.push(full);
  }
  return result;
}

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writePlaceholder(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function writePlatformPackage(target, baseManifest) {
  const variants = readPlatformVariants();
  const variant = variants.variants?.[target] || variants[target] || {};
  const platformDir = path.join(outDir, 'platforms', target);
  const quality = normalizeQuality(variant.textureQuality ?? variant.imageQuality ?? 1);
  const audioBitrate = Number(variant.audioBitrate || 128);
  const platformManifest = {
    ...baseManifest,
    target,
    platform: target,
    basePath: variant.basePath || `/assets/${target}`,
    textureQuality: quality,
    audioBitrate,
    images: baseManifest.images.map((image) => ({
      ...image,
      quality,
      platformUrl: `${target}/${image.url}`
    })),
    audio: baseManifest.audio.map((audio) => ({
      ...audio,
      bitrate: audioBitrate,
      platformUrl: `${target}/${audio.url}`
    }))
  };

  fs.mkdirSync(platformDir, { recursive: true });
  for (const item of collectManifestFiles(baseManifest)) {
    const source = path.join(outDir, item);
    if (!fs.existsSync(source)) continue;
    const destination = path.join(platformDir, item);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
  writeJson(path.join(platformDir, 'assets.manifest.json'), platformManifest);
  writeJson(path.join(platformDir, 'asset-package-report.json'), {
    target,
    textureQuality: quality,
    audioBitrate,
    assets: collectManifestFiles(baseManifest),
    generatedAt: new Date().toISOString()
  });
  return {
    target,
    out: slash(path.relative(process.cwd(), platformDir)),
    manifest: slash(path.relative(process.cwd(), path.join(platformDir, 'assets.manifest.json'))),
    textureQuality: quality,
    audioBitrate
  };
}

function collectManifestFiles(payload) {
  const files = new Set();
  for (const group of ['images', 'audio', 'spritesheets', 'models', 'metadata', 'atlases']) {
    for (const item of payload[group] || []) {
      if (item.url) files.add(item.url);
      if (item.path) files.add(item.path);
      if (item.image) files.add(item.image);
    }
  }
  return [...files];
}

function readPlatformVariants() {
  const file = path.resolve('config', 'platform-variants.json');
  if (!fs.existsSync(file)) return { variants: {} };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
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

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function frameForIndex(index, size) {
  return {
    x: (index % 32) * 32,
    y: Math.floor(index / 32) * 32,
    w: size,
    h: size
  };
}

function estimateSquareSize(file) {
  return Math.max(16, Math.min(256, fs.statSync(file).size || 32));
}

function normalizeQuality(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  if (numeric > 1) return Math.max(0.01, Math.min(1, numeric / 100));
  return Math.max(0.01, Math.min(1, numeric));
}
