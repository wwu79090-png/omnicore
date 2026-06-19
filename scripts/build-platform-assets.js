#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const assetsDir = path.resolve(args.assets || 'assets');
const manifestPath = path.resolve(args.manifest || path.join(assetsDir, 'assets.manifest.json'));
const platformMode = Boolean(args.platform);
const targets = String(args.targets || args.target || args.platform || 'web')
  .split(',')
  .map((target) => target.trim())
  .filter(Boolean);
const baseOut = args.out ? path.resolve(args.out) : null;
const reports = targets.map((target) => buildTarget(target, targets.length > 1 || Boolean(args.targets)));
console.log(JSON.stringify(reports.length === 1 ? reports[0] : { targets: reports }, null, 2));

function buildTarget(target, nestedOut) {
  const outDir = baseOut
    ? nestedOut ? path.join(baseOut, target) : baseOut
    : path.resolve(path.join('dist', 'platform-assets', target));
  const configPath = path.resolve(args.config || path.join(root, 'config', 'platform-assets', `${target}.json`));

  const config = readJson(configPath);
  const manifest = readJson(manifestPath);
  const imageQuality = normalizeQuality(config.imageQuality);
  const images = Array.isArray(manifest.images) ? manifest.images : [];
  const publicPath = platformMode && !args.targets
    ? normalizePublicPath(args.publicPath || target)
    : '';
  const referencedAssets = collectManifestReferences(images);
  const unusedResources = findUnusedResources(assetsDir, referencedAssets);
  const shouldCleanUnused = Object.prototype.hasOwnProperty.call(args, 'clean-unused');
  const cleanedResources = shouldCleanUnused
    ? cleanUnusedResources(assetsDir, unusedResources)
    : [];
  const report = {
    target,
    config: slash(path.relative(root, configPath)),
    generatedAt: new Date().toISOString(),
    imageQuality,
    publicPath,
    originalBytes: 0,
    estimatedBytes: 0,
    assets: [],
    unusedResources,
    cleanedResources
  };

  fs.mkdirSync(outDir, { recursive: true });

  for (const image of images) {
    const source = resolveAssetFile(image);
    if (!source || !fs.existsSync(source)) {
      report.assets.push({
        name: image.name || image.url || image.path,
        missing: true,
        originalBytes: 0,
        estimatedBytes: 0
      });
      continue;
    }
    const stat = fs.statSync(source);
    const estimatedBytes = Math.max(1, Math.ceil(stat.size * imageQuality));
    const originalUrl = image.url || path.basename(source);
    const relativeOut = rewritePlatformPath(originalUrl, publicPath);
    const destination = path.join(outDir, relativeOut);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
    report.originalBytes += stat.size;
    report.estimatedBytes += estimatedBytes;
    report.assets.push({
      name: image.name || path.basename(source),
      source: slash(path.relative(root, source)),
      output: slash(path.relative(root, destination)),
      url: relativeOut,
      originalUrl,
      originalBytes: stat.size,
      estimatedBytes,
      quality: imageQuality,
      webpAlternative: config.webpFallback ? relativeOut.replace(/\.(png|jpg|jpeg)$/i, '.webp') : null
    });
  }

  const packageManifest = {
    ...manifest,
    target,
    platformConfig: config,
    images: images.map((image) => ({
      ...image,
      originalUrl: image.url || image.path || null,
      url: rewritePlatformPath(image.url || image.path || '', publicPath),
      quality: imageQuality,
      webpAlternative: config.webpFallback && /\.(png|jpg|jpeg)$/i.test(image.url || image.path || '')
        ? rewritePlatformPath(String(image.url || image.path).replace(/\.(png|jpg|jpeg)$/i, '.webp'), publicPath)
        : null
    }))
  };

  writeJson(path.join(outDir, 'assets.manifest.json'), packageManifest);
  writeJson(path.join(outDir, 'asset-package-report.json'), report);
  writeUnusedResources(path.join(outDir, 'unused-resources.txt'), unusedResources);
  if (shouldCleanUnused) {
    writeJson(path.join(outDir, 'unused-resources-cleaned.json'), {
      generatedAt: report.generatedAt,
      cleaned: cleanedResources
    });
  }
  return report;
}

function resolveAssetFile(image) {
  const candidates = [];
  if (image.path) candidates.push(path.resolve(root, image.path));
  if (image.path) candidates.push(path.resolve(assetsDir, image.path));
  if (image.path && slash(image.path).startsWith('assets/')) {
    candidates.push(path.resolve(path.dirname(assetsDir), image.path));
  }
  if (image.url) candidates.push(path.resolve(assetsDir, image.url));
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0] || null;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function normalizeQuality(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  if (numeric > 1) return Math.max(0.01, Math.min(1, numeric / 100));
  return Math.max(0.01, Math.min(1, numeric));
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

function normalizePublicPath(value) {
  const clean = String(value || '').replace(/^\/+|\/+$/g, '');
  return clean ? `${clean}/` : '';
}

function rewritePlatformPath(value, publicPath) {
  const clean = slash(value || '').replace(/^\/+/, '');
  if (!publicPath || !clean) return clean;
  if (clean.startsWith(publicPath)) return clean;
  return `${publicPath}${clean}`;
}

function collectManifestReferences(images = []) {
  const references = new Set();
  for (const image of images) {
    for (const value of [image.path, image.url]) {
      if (!value) continue;
      const normalized = slash(value).replace(/^\/+/, '');
      references.add(normalized);
      if (normalized.startsWith('assets/')) references.add(normalized.slice('assets/'.length));
    }
  }
  return references;
}

function findUnusedResources(rootDir, references) {
  if (!fs.existsSync(rootDir)) return [];
  return listFiles(rootDir)
    .filter((file) => /\.(?:png|jpe?g|webp|svg|gif|mp3|ogg|wav)$/iu.test(file))
    .map((file) => {
      const relative = slash(path.relative(rootDir, file));
      const referenced = references.has(relative)
        || references.has(`assets/${relative}`)
        || references.has(path.basename(relative));
      return {
        path: relative,
        bytes: fs.statSync(file).size,
        reason: 'not-referenced',
        referenced
      };
    })
    .filter((entry) => !entry.referenced)
    .map(({ referenced, ...entry }) => entry);
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

function writeUnusedResources(file, unusedResources) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lines = unusedResources.length
    ? unusedResources.map((item) => `${item.path}\t${item.bytes}\t${item.reason}`)
    : ['No unused resources detected.'];
  fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
}

function cleanUnusedResources(rootDir, unusedResources = []) {
  const rootPath = path.resolve(rootDir);
  const cleaned = [];
  for (const resource of unusedResources) {
    const target = path.resolve(rootPath, resource.path);
    if (!target.startsWith(rootPath) || !fs.existsSync(target)) continue;
    const stat = fs.statSync(target);
    if (!stat.isFile()) continue;
    fs.unlinkSync(target);
    cleaned.push({
      ...resource,
      action: 'deleted'
    });
  }
  return cleaned;
}
