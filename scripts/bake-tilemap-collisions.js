#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Tilemap from '../src/tilemap/Tilemap.js';

/**
 * Bake Tiled/OmniCore tile collision layers into binary polygon files.
 *
 * @param {object} options Bake options.
 * @returns {object} Bake report.
 */
export function bakeTilemapCollisionFiles({
  source = path.join('assets', 'maps'),
  outDir = path.join('dist', 'tilemap-collisions'),
  optional = false,
  collisionTileIds = [1]
} = {}) {
  const sourceRoot = path.resolve(source);
  const outputRoot = path.resolve(outDir);
  const report = {
    source: sourceRoot,
    outDir: outputRoot,
    baked: 0,
    skipped: 0,
    navmeshes: 0,
    files: [],
    navmeshFiles: []
  };

  if (!fs.existsSync(sourceRoot)) {
    if (optional) return { ...report, optional: true };
    return report;
  }

  for (const file of listFiles(sourceRoot).filter((item) => item.endsWith('.json'))) {
    const json = readJson(file, null);
    if (!json) {
      report.skipped += 1;
      continue;
    }
    const layer = findCollisionLayer(json);
    if (!layer) {
      report.skipped += 1;
      continue;
    }
    const binary = Tilemap.bakeCollisionBinary({
      width: layer.width || json.width,
      height: layer.height || json.height,
      tileWidth: layer.tileWidth || layer.tilewidth || json.tilewidth || json.tileWidth || 16,
      tileHeight: layer.tileHeight || layer.tileheight || json.tileheight || json.tileHeight || 16,
      data: layer.data || [],
      collisionTileIds: layer.collisionTileIds || collisionTileIds
    });
    const relative = path.relative(sourceRoot, file).replace(/\.json$/iu, '.collision.bin');
    const destination = path.join(outputRoot, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, Buffer.from(binary));
    const navmesh = Tilemap.parse(json).bakeNavigationMesh(layer.name, {
      blockedTileIds: layer.collisionTileIds || collisionTileIds
    });
    const navmeshRelative = path.relative(sourceRoot, file).replace(/\.json$/iu, '.navmesh.json');
    const navmeshDestination = path.join(outputRoot, navmeshRelative);
    fs.mkdirSync(path.dirname(navmeshDestination), { recursive: true });
    fs.writeFileSync(navmeshDestination, `${JSON.stringify(serializeNavmesh(navmesh), null, 2)}\n`, 'utf8');
    report.baked += 1;
    report.navmeshes += 1;
    report.files.push(destination);
    report.navmeshFiles.push(navmeshDestination);
  }

  return report;
}

function serializeNavmesh(navmesh = {}) {
  return {
    format: 'OmniCore.NavMesh',
    version: 1,
    width: navmesh.width || 0,
    height: navmesh.height || 0,
    tileWidth: navmesh.tileWidth || 0,
    tileHeight: navmesh.tileHeight || 0,
    grid: Array.isArray(navmesh.grid) ? navmesh.grid : []
  };
}

function findCollisionLayer(json = {}) {
  const layers = flattenLayers(json.layers || []);
  return layers.find((layer) => {
    if (layer.type !== 'tilelayer') return false;
    if (/collision|collider|physics/i.test(layer.name || '')) return true;
    const properties = normalizeProperties(layer.properties);
    return Boolean(properties.collision || properties.collider || properties.physics);
  }) || null;
}

function flattenLayers(layers = []) {
  const output = [];
  for (const layer of layers) {
    if (Array.isArray(layer.layers)) output.push(...flattenLayers(layer.layers));
    else output.push(layer);
  }
  return output;
}

function normalizeProperties(properties = {}) {
  if (Array.isArray(properties)) {
    return Object.fromEntries(properties.map((item) => [item.name, item.value]));
  }
  return { ...properties };
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

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function parseArgs(argv) {
  const options = {
    source: path.join('assets', 'maps'),
    outDir: path.join('dist', 'tilemap-collisions'),
    optional: false,
    collisionTileIds: [1]
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source') {
      index += 1;
      options.source = argv[index];
    } else if (arg === '--out' || arg === '--outDir') {
      index += 1;
      options.outDir = argv[index];
    } else if (arg === '--optional') {
      options.optional = true;
    } else if (arg === '--collision-id') {
      index += 1;
      options.collisionTileIds.push(Number(argv[index]));
    }
  }
  options.collisionTileIds = [...new Set(options.collisionTileIds.filter(Number.isFinite))];
  return options;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const report = bakeTilemapCollisionFiles(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
}

export default bakeTilemapCollisionFiles;
