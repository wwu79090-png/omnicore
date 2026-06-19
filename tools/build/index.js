#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const WORKSPACE_PACKAGES = [
  'packages/core',
  'packages/physics',
  'packages/editor-protocol',
  'examples/platformer',
  'tools/build'
];

export async function buildWorkspaceManifest({ outDir = path.join(root, 'dist', 'monorepo-skeleton') } = {}) {
  const packages = WORKSPACE_PACKAGES.map(readWorkspacePackage);
  const demoModule = await import(pathToFileURL(path.join(root, 'examples', 'platformer', 'src', 'main.js')).href);
  const demo = demoModule.runPlatformerDemo();
  const manifest = {
    ok: packages.every((workspacePackage) => workspacePackage.entryExists) && demo.name === 'hello-platformer',
    generatedAt: new Date().toISOString(),
    packages,
    demo,
    extensionPoints: {
      wasm: 'Wasm modules attach through @omnicore/core createWasmExtensionSlot without changing scene contracts.',
      physicsBackend: 'Physics backend switching is isolated behind @omnicore/physics createPhysicsWorld().switchBackend().',
      editorHotEdit: 'Editor hot edit patches flow through @omnicore/editor-protocol createHotEditSession().apply().'
    }
  };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

function readWorkspacePackage(relativeDir) {
  const dir = path.join(root, relativeDir);
  const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const entry = pkg.main || pkg.exports?.['.'] || 'index.js';
  const entryPath = typeof entry === 'string' ? entry : entry.default || 'index.js';
  return {
    name: pkg.name,
    version: pkg.version,
    dir: relativeDir,
    entry: entryPath,
    entryExists: existsSync(path.join(dir, entryPath))
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const manifest = await buildWorkspaceManifest();
  process.stdout.write(`workspace build ok: ${manifest.ok}\n`);
}

export default buildWorkspaceManifest;
