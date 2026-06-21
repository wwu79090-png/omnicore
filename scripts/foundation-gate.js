#!/usr/bin/env node
import crypto from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AssetPipelineGate } from '../src/assets/AssetPipelineGate.js';
import { PrefabManager } from '../src/prefab/PrefabManager.js';
import {
  collectSceneDependencies,
  normalizeSceneDocument,
  validateSceneDocument
} from '../src/scene/SceneDocument.js';
import {
  compareRenderSnapshots,
  createDeterministicRenderQueue,
  snapshotRenderQueue
} from '../src/renderer/DeterministicRenderQueue.js';

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ASSET_BUDGET_BYTES = 64 * 1024 * 1024;

export function createFoundationGateReport({
  projectRoot = moduleRoot,
  assetsDir = 'assets',
  sceneDirs = ['examples', 'assets/scenes'],
  prefabDirs = ['assets/prefabs'],
  maxAssetBytes = DEFAULT_ASSET_BUDGET_BYTES,
  generatedAt = new Date().toISOString()
} = {}) {
  const root = path.resolve(projectRoot);
  const sceneDocuments = inspectSceneDocuments({ root, sceneDirs });
  const prefabs = inspectPrefabs({ root, prefabDirs });
  const assetPipeline = inspectAssetPipeline({
    root,
    assetsDir,
    maxAssetBytes,
    sceneDocuments,
    prefabs
  });
  const renderSnapshots = inspectRenderSnapshots(sceneDocuments.documents);
  const ok = sceneDocuments.ok && prefabs.ok && assetPipeline.ok && renderSnapshots.ok;

  return {
    schema: 'omnicore.foundation-gate-report.v1',
    generatedAt,
    ok,
    sceneDocuments: omitDocuments(sceneDocuments),
    prefabs: omitPrefabPayloads(prefabs),
    assetPipeline,
    renderSnapshots
  };
}

export function writeFoundationGateReport(report, {
  out = path.join(moduleRoot, 'docs', 'release-notes', 'foundation-gate-report.json'),
  projectRoot = moduleRoot
} = {}) {
  const outFile = path.resolve(projectRoot, out);
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return outFile;
}

function inspectSceneDocuments({ root, sceneDirs }) {
  const files = sceneDirs
    .map((dir) => path.resolve(root, dir))
    .filter(existsSync)
    .flatMap(listFiles)
    .filter(isSceneCandidate);
  const failures = [];
  const documents = [];

  for (const file of files) {
    const relative = slash(path.relative(root, file));
    const source = readJson(file, null);
    if (!source) {
      failures.push({
        code: 'scene-json-invalid',
        file: relative,
        message: `Scene JSON could not be parsed: ${relative}`
      });
      continue;
    }
    const document = normalizeSceneDocument(source);
    const validation = validateSceneDocument(document);
    if (!validation.ok) {
      failures.push(...validation.errors.map((error) => ({ ...error, file: relative })));
    }
    documents.push({
      file: relative,
      document,
      dependencies: collectSceneDependencies(document)
    });
  }

  return {
    ok: failures.length === 0,
    checked: files.length,
    documents,
    failures
  };
}

function inspectPrefabs({ root, prefabDirs }) {
  const files = prefabDirs
    .map((dir) => path.resolve(root, dir))
    .filter(existsSync)
    .flatMap(listFiles)
    .filter((file) => file.endsWith('.json'));
  const failures = [];
  const prefabs = [];

  for (const file of files) {
    const relative = slash(path.relative(root, file));
    const source = readJson(file, null);
    if (!source) {
      failures.push({
        code: 'prefab-json-invalid',
        file: relative,
        message: `Prefab JSON could not be parsed: ${relative}`
      });
      continue;
    }
    const validation = PrefabManager.validate(source);
    if (!validation.ok) {
      failures.push(...validation.errors.map((error) => ({ ...error, file: relative })));
    }
    prefabs.push({
      file: relative,
      prefab: source,
      dependencies: PrefabManager.collectDependencies(source)
    });
  }

  return {
    ok: failures.length === 0,
    checked: files.length,
    prefabs,
    failures
  };
}

function inspectAssetPipeline({
  root,
  assetsDir,
  maxAssetBytes,
  sceneDocuments,
  prefabs
}) {
  const absoluteAssets = path.resolve(root, assetsDir);
  const assets = existsSync(absoluteAssets)
    ? listFiles(absoluteAssets).map((file) => ({
      key: slash(path.relative(absoluteAssets, file)),
      url: slash(path.relative(absoluteAssets, file)),
      size: statSync(file).size,
      hash: hashFile(file)
    }))
    : [];
  const dependencies = {};

  for (const scene of sceneDocuments.documents) {
    const deps = flattenDependencies(scene.dependencies).filter(isVerifiableAssetReference);
    if (deps.length) dependencies[scene.file] = deps;
  }
  for (const prefab of prefabs.prefabs) {
    const deps = flattenDependencies(prefab.dependencies).filter(isVerifiableAssetReference);
    if (deps.length) dependencies[prefab.file] = deps;
  }

  const report = new AssetPipelineGate({
    manifest: {
      assets,
      dependencies
    },
    budgets: {
      totalBytes: Number(maxAssetBytes) || DEFAULT_ASSET_BUDGET_BYTES
    }
  }).run();

  return report;
}

function inspectRenderSnapshots(documents) {
  const failures = [];
  const snapshots = [];

  for (const scene of documents) {
    const queue = createDeterministicRenderQueue(scene.document.children || []);
    const snapshot = snapshotRenderQueue(queue);
    const repeat = snapshotRenderQueue(createDeterministicRenderQueue([...(scene.document.children || [])].reverse()));
    const comparison = compareRenderSnapshots(snapshot, repeat);
    if (!comparison.ok) {
      failures.push({
        code: 'render-snapshot-unstable',
        file: scene.file,
        firstMismatch: comparison.firstMismatch
      });
    }
    snapshots.push({
      file: scene.file,
      hash: snapshot.hash,
      order: snapshot.order
    });
  }

  return {
    ok: failures.length === 0,
    checked: snapshots.length,
    snapshots,
    failures
  };
}

function omitDocuments(sceneDocuments) {
  return {
    ok: sceneDocuments.ok,
    checked: sceneDocuments.checked,
    failures: sceneDocuments.failures,
    dependencies: sceneDocuments.documents.map((document) => ({
      file: document.file,
      dependencies: document.dependencies
    }))
  };
}

function omitPrefabPayloads(prefabs) {
  return {
    ok: prefabs.ok,
    checked: prefabs.checked,
    failures: prefabs.failures,
    dependencies: prefabs.prefabs.map((prefab) => ({
      file: prefab.file,
      dependencies: prefab.dependencies
    }))
  };
}

function flattenDependencies(buckets = {}) {
  return Object.values(buckets).flat().map(normalizeAssetKey).filter(Boolean);
}

function isVerifiableAssetReference(value) {
  return /\.[a-z0-9]+(?:[#?].*)?$/iu.test(value);
}

function isSceneCandidate(file) {
  const normalized = slash(file);
  return /\.scene\.json$/iu.test(normalized) || /\/scene\.json$/iu.test(normalized);
}

function listFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function hashFile(file) {
  return crypto.createHash('sha256').update(readFileSync(file)).digest('hex');
}

function normalizeAssetKey(value) {
  return String(value || '').replace(/\\/gu, '/').replace(/^assets\//u, '');
}

function slash(value) {
  return String(value).replace(/\\/g, '/');
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') {
      index += 1;
      options.out = argv[index];
    } else if (arg === '--assets') {
      index += 1;
      options.assetsDir = argv[index];
    } else if (arg === '--scenes') {
      index += 1;
      options.sceneDirs = splitList(argv[index]);
    } else if (arg === '--prefabs') {
      index += 1;
      options.prefabDirs = splitList(argv[index]);
    } else if (arg === '--max-asset-bytes') {
      index += 1;
      options.maxAssetBytes = Number(argv[index]);
    }
  }
  return options;
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = createFoundationGateReport(options);
  const outFile = writeFoundationGateReport(report, {
    out: options.out,
    projectRoot: moduleRoot
  });
  console.log(`[OmniCore] foundation gate report written: ${outFile}`);
  if (!report.ok) {
    for (const section of ['sceneDocuments', 'prefabs', 'assetPipeline', 'renderSnapshots']) {
      for (const failure of report[section]?.failures || []) {
        console.error(`[foundation:${section}] ${failure.code}: ${failure.message || failure.file || JSON.stringify(failure)}`);
      }
    }
    process.exitCode = 1;
  }
  return report;
}

if (isCli()) {
  main();
}
