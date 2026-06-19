#!/usr/bin/env node

async function loadNodeModules() {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const childProcess = await import('node:child_process');
  return { fs, path, childProcess };
}

async function exists(fs, filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(fs, path, dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fs, path, fullPath));
    else files.push(fullPath);
  }
  return files;
}

function parseArgs(argv) {
  const output = {
    assets: 'assets',
    out: 'dist/assets',
    atlasName: 'sprites'
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--assets') output.assets = argv[index + 1];
    if (arg === '--out') output.out = argv[index + 1];
    if (arg === '--atlas') output.atlasName = argv[index + 1];
  }
  return output;
}

function isImage(filePath) {
  return /\.(png|jpg|jpeg|webp)$/i.test(filePath);
}

function isMp3(filePath) {
  return /\.mp3$/i.test(filePath);
}

async function transcodeAudio({ fs, path, childProcess }, source, outDir) {
  const basename = path.basename(source, path.extname(source));
  const target = path.join(outDir, `${basename}.webm`);
  await fs.mkdir(outDir, { recursive: true });

  const ffmpeg = await new Promise((resolve) => {
    const child = childProcess.spawn('ffmpeg', ['-version'], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });

  if (ffmpeg) {
    await new Promise((resolve, reject) => {
      const child = childProcess.spawn('ffmpeg', ['-y', '-i', source, target], { stdio: 'ignore' });
      child.on('error', reject);
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
    });
  } else {
    await fs.copyFile(source, target);
  }

  return target;
}

async function buildAtlas({ fs, path }, images, outDir, atlasName) {
  const frames = {};
  images.forEach((filePath, index) => {
    const name = path.basename(filePath, path.extname(filePath));
    frames[name] = {
      frame: { x: index * 64, y: 0, w: 64, h: 64 },
      source: filePath,
      rotated: false,
      trimmed: false
    };
  });

  await fs.mkdir(outDir, { recursive: true });
  const atlasPath = path.join(outDir, `${atlasName}.atlas`);
  await fs.writeFile(atlasPath, `${JSON.stringify({ meta: { image: `${atlasName}.png`, generatedBy: 'OmniCore Pipeline' }, frames }, null, 2)}\n`);
  await fs.writeFile(path.join(outDir, `${atlasName}.png`), '');
  await fs.writeFile(path.join(outDir, `${atlasName}.webp`), '');
  return atlasPath;
}

async function runPipeline(options = {}) {
  const modules = await loadNodeModules();
  const { fs, path } = modules;
  const assetsDir = path.resolve(options.assets || 'assets');
  const outDir = path.resolve(options.out || 'dist/assets');
  const atlasName = options.atlasName || 'sprites';

  if (!await exists(fs, assetsDir)) {
    throw new Error(`Assets directory not found: ${assetsDir}`);
  }

  const files = await walk(fs, path, assetsDir);
  const images = files.filter(isImage);
  const audio = files.filter(isMp3);
  const manifest = { generatedAt: new Date().toISOString(), assets: [] };

  if (images.length) {
    const atlasPath = await buildAtlas(modules, images, outDir, atlasName);
    manifest.assets.push({
      key: atlasName,
      type: 'atlas',
      url: path.basename(atlasPath),
      texture: `${atlasName}.png`,
      formats: ['png', 'webp'],
      fallbackUrls: [`${atlasName}.png`],
      sources: images.map((filePath) => path.relative(assetsDir, filePath).replaceAll(path.sep, '/'))
    });
  }

  for (const filePath of audio) {
    const target = await transcodeAudio(modules, filePath, outDir);
    manifest.assets.push({
      key: path.basename(target, path.extname(target)),
      type: 'audio',
      url: path.basename(target),
      source: path.relative(assetsDir, filePath).replaceAll(path.sep, '/')
    });
  }

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'asset-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = await runPipeline(options);
  console.log(JSON.stringify(manifest, null, 2));
}

if (typeof module !== 'undefined') {
  module.exports = { runPipeline, parseArgs };
}

if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('pipeline.js')) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
