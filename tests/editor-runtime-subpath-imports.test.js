import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('editor runtime subpath imports', () => {
  it('exports focused runtime modules as public package subpaths', () => {
    const rootPackage = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(rootPackage.exports['./physics/PhysicsWorld.js']).toBe('./src/physics/PhysicsWorld.js');
    expect(rootPackage.exports['./dimension3d/Scene3DKit.js']).toBe('./src/dimension3d/Scene3DKit.js');
  });

  it('keeps the editor on lightweight public subpath imports instead of the OmniCore root bundle', () => {
    const editorApp = readFileSync('packages/omnicore-editor/src/editor-app.js', 'utf8');

    expect(editorApp).toContain("import PhysicsWorld from 'omnicore/physics/PhysicsWorld.js';");
    expect(editorApp).toContain("import Scene3DKit from 'omnicore/dimension3d/Scene3DKit.js';");
    expect(editorApp).not.toContain("import { PhysicsWorld, Scene3DKit } from 'omnicore';");
    expect(editorApp).not.toMatch(/from ['"].*src\//);
  });

  it('builds the desktop editor without the large chunk warning caused by the root runtime bundle', () => {
    const result = spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm.cmd --workspace packages/omnicore-editor run build'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;

    expect(result.status).toBe(0);
    expect(output).not.toContain('Some chunks are larger than 500 kB');
    expect(findLargeOmniCoreRuntimeChunks(output)).toEqual([]);
  });
});

function findLargeOmniCoreRuntimeChunks(output) {
  return String(output)
    .split(/\r?\n/u)
    .filter((line) => line.includes('omnicore-runtime-'))
    .filter((line) => {
      const match = line.match(/\s(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d+))?\s+kB/u);
      if (!match) return false;
      const size = Number(`${match[1].replace(/,/gu, '')}.${match[2] || '0'}`);
      return size > 500;
    });
}
