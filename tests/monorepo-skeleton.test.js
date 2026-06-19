import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('OmniCore monorepo skeleton', () => {
  it('declares workspace packages and runnable monorepo scripts', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

    expect(pkg.workspaces).toEqual(expect.arrayContaining([
      'packages/*',
      'examples/*',
      'tools/*'
    ]));
    expect(pkg.scripts).toMatchObject({
      'build:workspace': 'node tools/build/index.js',
      'demo:platformer': 'node examples/platformer/src/main.js'
    });
  });

  it('contains core, physics, editor protocol, build tool, and platformer workspace manifests', () => {
    for (const file of [
      'packages/core/package.json',
      'packages/core/src/index.js',
      'packages/physics/package.json',
      'packages/physics/src/index.js',
      'packages/editor-protocol/package.json',
      'packages/editor-protocol/src/index.js',
      'examples/platformer/package.json',
      'examples/platformer/src/main.js',
      'tools/build/package.json',
      'tools/build/index.js',
      'docs/architecture/monorepo-skeleton.md'
    ]) {
      expect(existsSync(path.join(root, file))).toBe(true);
    }
  });

  it('runs the hello platformer scene and reports hot-edit and physics backend evidence', () => {
    const output = execFileSync(process.execPath, ['examples/platformer/src/main.js'], {
      cwd: root,
      encoding: 'utf8'
    });
    const demo = JSON.parse(output);

    expect(demo).toMatchObject({
      name: 'hello-platformer',
      scene: expect.objectContaining({
        name: 'hello-scene',
        entityCount: 2
      }),
      physics: expect.objectContaining({
        activeBackend: 'arcade-lite',
        switchedBackend: 'noop'
      }),
      editor: expect.objectContaining({
        hotEditApplied: true,
        protocol: 'OmniCore.EditorProtocol'
      }),
      wasm: expect.objectContaining({
        extensionPoint: '@omnicore/core/wasm-slot'
      })
    });
  });

  it('builds the workspace manifest with extension point descriptions', () => {
    const outDir = path.join(root, 'dist', 'monorepo-skeleton');
    rmSync(outDir, { recursive: true, force: true });

    execFileSync(process.execPath, ['tools/build/index.js'], {
      cwd: root,
      encoding: 'utf8'
    });

    const manifest = JSON.parse(readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));
    expect(manifest).toMatchObject({
      ok: true,
      packages: expect.arrayContaining([
        expect.objectContaining({ name: '@omnicore/core' }),
        expect.objectContaining({ name: '@omnicore/physics' }),
        expect.objectContaining({ name: '@omnicore/editor-protocol' }),
        expect.objectContaining({ name: '@omnicore/example-platformer' }),
        expect.objectContaining({ name: '@omnicore/build-tools' })
      ]),
      extensionPoints: {
        wasm: expect.stringContaining('Wasm'),
        physicsBackend: expect.stringContaining('backend'),
        editorHotEdit: expect.stringContaining('hot edit')
      }
    });
  });
});
