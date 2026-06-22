#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function runAssetImporter(options = {}) {
  const cwd = options.cwd || process.cwd();
  const generatedAt = options.now || new Date().toISOString();
  const sourceDir = path.resolve(cwd, options.source || options.sourceDir || 'source-assets');
  const outDir = path.resolve(cwd, options.out || options.outDir || path.join('dist', 'imported-assets'));
  const platformTargets = Array.isArray(options.platforms)
    ? options.platforms
    : parseList(options.platforms || options.targets || '');
  const conversions = [];
  const externalCommandPlan = [];
  const dependencies = [];
  const spriteFrames = {};
  const manifest = {
    generatedAt,
    source: slash(path.relative(cwd, sourceDir)),
    images: [],
    audio: [],
    spritesheets: [],
    spine: [],
    models: [],
    metadata: [],
    fonts: [],
    atlases: []
  };

  fs.mkdirSync(outDir, { recursive: true });

  const addExternalCommandPlan = (plan) => {
    externalCommandPlan.push({
      required: false,
      converterMode: 'optional-external',
      ...plan,
      input: plan.input || null,
      outputs: plan.outputs || [],
      command: plan.command || null,
      fallback: plan.fallback || 'OmniCore writes a deterministic placeholder so local builds keep running.'
    });
  };

  for (const file of listFiles(sourceDir)) {
    const relative = slash(path.relative(sourceDir, file));
    const ext = path.extname(file).toLowerCase();
    const base = slash(path.join(path.dirname(relative), path.basename(relative, ext))).replace(/^\.\//u, '');
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
    } else if (ext === '.spine') {
      const name = path.basename(relative, ext);
      const skeletonTarget = `spine/${base}.skel`;
      const atlasTarget = `spine/${base}.atlas`;
      writePlaceholder(path.join(outDir, skeletonTarget), `skel:${relative}`);
      writePlaceholder(path.join(outDir, atlasTarget), `atlas:${relative}`);
      addExternalCommandPlan({
        tool: 'spine-cli',
        input: relative,
        outputs: [skeletonTarget, atlasTarget],
        command: `spine-cli export "${relative}" --skel "${skeletonTarget}" --atlas "${atlasTarget}"`,
        fallback: 'Placeholder .skel/.atlas files keep scene references stable until Spine CLI is available.'
      });
      manifest.spine.push({
        type: 'spine',
        name,
        source: relative,
        skeleton: skeletonTarget,
        atlas: atlasTarget,
        converter: 'spine-cli',
        converterMode: 'optional-external'
      });
      conversions.push({
        from: relative,
        to: skeletonTarget,
        atlas: atlasTarget,
        type: 'spine',
        converter: 'spine-cli',
        converterMode: 'optional-external'
      });
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
      addExternalCommandPlan({
        tool: 'texture-packer',
        input: relative,
        outputs: [target, 'atlases/smart.atlas.json'],
        command: `texture-packer "${relative}" --padding ${ext === '.png' ? 2 : 0} --format webp --out "${target}"`,
        fallback: 'Built-in placeholder conversion records 2px PNG edge padding and smart atlas metadata.'
      });
      manifest.images.push({
        type: 'image',
        name,
        source: relative,
        path: target,
        url: target,
        format: 'webp',
        atlas: 'atlases/smart.atlas.json',
        edgePadding: ext === '.png' ? 2 : 0,
        atlasPacked: true
      });
      conversions.push({
        from: relative,
        to: target,
        type: 'image',
        codec: 'webp',
        compression: 0.82,
        edgePadding: ext === '.png' ? 2 : 0,
        atlasPacked: true
      });
    } else if (['.wav', '.aiff', '.mp3', '.ogg'].includes(ext)) {
      const name = path.basename(relative, ext);
      const target = `audio/${base}.ogg`;
      writePlaceholder(path.join(outDir, target), `compressed:${relative}`);
      addExternalCommandPlan({
        tool: 'ffmpeg',
        input: relative,
        outputs: [target],
        command: `ffmpeg -y -i "${relative}" -c:a libvorbis -b:a 128k "${target}"`,
        fallback: 'Placeholder audio keeps manifests valid; runtime audio fallback covers missing decode.'
      });
      manifest.audio.push({
        type: 'audio',
        name,
        source: relative,
        path: target,
        url: target,
        codec: 'ogg'
      });
      conversions.push({ from: relative, to: target, type: 'audio', codec: 'ogg', compression: 0.72, converter: 'ffmpeg' });
    } else if (['.fbx', '.gltf', '.glb', '.blend'].includes(ext)) {
      const name = path.basename(relative, ext);
      const target = `models/${base}.glb`;
      const converter = ext === '.blend' ? 'blender' : ext === '.fbx' ? 'fbx2gltf' : 'gltf-pack';
      writePlaceholder(path.join(outDir, target), `glb:${relative}`);
      addExternalCommandPlan({
        tool: converter,
        input: relative,
        outputs: [target],
        command: converter === 'blender'
          ? `blender -b "${relative}" --python-expr "import bpy; bpy.ops.export_scene.gltf(filepath='${target}', export_format='GLB')"`
          : `${converter} "${relative}" --out "${target}"`,
        fallback: 'Placeholder GLB records the target model path for editor preview and CI packaging.'
      });
      manifest.models.push({
        type: 'model',
        name,
        source: relative,
        path: target,
        url: target,
        format: 'glb',
        sourceFormat: ext.slice(1),
        converter,
        converterMode: ext === '.blend' ? 'optional-external' : 'built-in-placeholder'
      });
      conversions.push({
        from: relative,
        to: target,
        type: ext === '.blend' ? 'blend-model' : 'model',
        converter,
        converterMode: ext === '.blend' ? 'optional-external' : 'built-in-placeholder'
      });
    } else if (ext === '.fnt') {
      const name = path.basename(relative, ext);
      const target = `fonts/${base}.font.json`;
      writeJson(path.join(outDir, target), {
        format: 'OmniCore.BitmapFont',
        source: relative,
        pages: [`${base}.png`],
        lineHeight: 16,
        glyphs: []
      });
      addExternalCommandPlan({
        tool: 'font-bitmap',
        input: relative,
        outputs: [target],
        command: `font-bitmap import "${relative}" --out "${target}"`,
        fallback: 'The .fnt metrics are preserved as JSON; matching PNG pages can be copied later.'
      });
      manifest.fonts.push({
        type: 'font',
        name,
        source: relative,
        path: target,
        url: target,
        format: 'bitmap-font'
      });
      conversions.push({ from: relative, to: target, type: 'bitmap-font', converter: 'font-bitmap' });
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
    generatedAt,
    source: slash(path.relative(cwd, sourceDir)),
    dependencies,
    conversions,
    externalCommandPlan,
    atlas: 'atlases/smart.atlas.json',
    manifest: 'assets.manifest.json'
  };
  writeJson(path.join(outDir, 'asset-graph.json'), graph);

  const platformPackages = platformTargets.map((target) => writePlatformPackage(target, manifest, outDir, cwd));

  return {
    source: slash(path.relative(cwd, sourceDir)),
    out: slash(path.relative(cwd, outDir)),
    conversions,
    externalCommandPlan,
    drawCallReductionTarget: 0.9,
    assetGraph: 'asset-graph.json',
    atlas: 'atlases/smart.atlas.json',
    manifest: 'assets.manifest.json',
    platformPackages
  };
}

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

function writePlatformPackage(target, baseManifest, outDir, cwd = process.cwd()) {
  const variants = readPlatformVariants(cwd);
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
  for (const group of ['images', 'audio', 'spritesheets', 'spine', 'models', 'metadata', 'fonts', 'atlases']) {
    for (const item of payload[group] || []) {
      if (item.url) files.add(item.url);
      if (item.path) files.add(item.path);
      if (item.image) files.add(item.image);
    }
  }
  return [...files];
}

function readPlatformVariants(cwd = process.cwd()) {
  const file = path.resolve(cwd, 'config', 'platform-variants.json');
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

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const report = runAssetImporter(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

export default runAssetImporter;
