#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MODEL_COMPLEXITY_WARNING = '[OmniCore] 2.5D 模型复杂度过高，建议优化。';
export const DEFAULT_3D_ASSET_LIMITS = Object.freeze({
  triangles: 20000,
  texture: 2048
});

export function create3DAssetReport({
  root = process.cwd(),
  limits = DEFAULT_3D_ASSET_LIMITS
} = {}) {
  const files = findModelFiles(root);
  const models = files.map((file) => inspectModelFile(root, file, limits));
  const violations = models.flatMap((model) => model.violations);
  return {
    ok: violations.length === 0,
    root,
    limits: { ...limits },
    files: models,
    violations
  };
}

function findModelFiles(root) {
  const start = path.join(root, 'assets', 'models');
  if (!existsSync(start)) return [];
  const files = [];
  walk(start, files);
  return files.filter((file) => /\.(gltf|glb)$/i.test(file));
}

function walk(dir, files) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else files.push(fullPath);
  }
}

function inspectModelFile(root, file, limits) {
  const relative = toPosix(path.relative(root, file));
  const metrics = file.endsWith('.gltf')
    ? inspectGltfJson(readFileSync(file, 'utf8'))
    : inspectGlb(readFileSync(file));
  const violations = [];
  if (metrics.triangles > limits.triangles) {
    violations.push({
      file: relative,
      type: 'triangles',
      value: metrics.triangles,
      limit: limits.triangles
    });
  }
  if (metrics.maxTextureSize > limits.texture) {
    violations.push({
      file: relative,
      type: 'texture',
      value: metrics.maxTextureSize,
      limit: limits.texture
    });
  }
  return {
    file: relative,
    ...metrics,
    violations
  };
}

function inspectGltfJson(source) {
  const gltf = JSON.parse(source);
  const triangles = (gltf.meshes || []).reduce((total, mesh) => (
    total + (mesh.primitives || []).reduce((primitiveTotal, primitive) => (
      primitiveTotal + primitiveTriangleCount(gltf, primitive)
    ), 0)
  ), 0);
  const maxTextureSize = (gltf.images || []).reduce((max, image) => Math.max(
    max,
    Number(image.width || image.extras?.width || 0),
    Number(image.height || image.extras?.height || 0)
  ), 0);
  return { triangles, maxTextureSize };
}

function inspectGlb(buffer) {
  if (buffer.length < 20 || buffer.toString('utf8', 0, 4) !== 'glTF') return { triangles: 0, maxTextureSize: 0 };
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;
    if (chunkType === 0x4e4f534a) {
      const json = buffer.toString('utf8', offset, offset + chunkLength).trim();
      return inspectGltfJson(json);
    }
    offset += chunkLength;
  }
  return { triangles: 0, maxTextureSize: 0 };
}

function primitiveTriangleCount(gltf, primitive = {}) {
  const accessorIndex = primitive.indices ?? primitive.attributes?.POSITION;
  const count = Number(gltf.accessors?.[accessorIndex]?.count || 0);
  return Math.ceil(count / 3);
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function parseArgs(argv) {
  const options = { root: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--root') {
      options.root = path.resolve(argv[index + 1]);
      index += 1;
    }
  }
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = create3DAssetReport(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error(MODEL_COMPLEXITY_WARNING);
    process.exitCode = 1;
  }
}
