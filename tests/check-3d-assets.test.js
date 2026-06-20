import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { create3DAssetReport } from '../scripts/check-3d-assets.js';

describe('3D asset complexity build gate', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('reports GLTF/GLB models above triangle and texture limits', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-3d-check-'));
    writeModel(temp, 'assets/models/heavy.gltf', {
      triangles: 20001,
      textureWidth: 4096,
      textureHeight: 2048
    });

    const report = create3DAssetReport({ root: temp });

    expect(report.ok).toBe(false);
    expect(report.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        file: 'assets/models/heavy.gltf',
        type: 'triangles',
        value: 20001,
        limit: 20000
      }),
      expect.objectContaining({
        file: 'assets/models/heavy.gltf',
        type: 'texture',
        value: 4096,
        limit: 2048
      })
    ]));
  });

  it('blocks npm build when --check-3d finds oversized models', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-3d-build-'));
    writeModel(temp, 'assets/models/heavy.gltf', {
      triangles: 20001,
      textureWidth: 4096,
      textureHeight: 2048
    });

    expect(() => execFileSync(process.execPath, [
      'scripts/build.js',
      '--check-3d',
      '--dry-run',
      '--root',
      temp
    ], { cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe' })).toThrow(/2\.5D 模型复杂度过高/);
    expect(JSON.parse(readFileSync('package.json', 'utf8')).scripts.build).toBe('node scripts/build.js');
  });
});

function writeModel(root, relative, { triangles, textureWidth, textureHeight }) {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  const indexCount = triangles * 3;
  const gltf = {
    asset: { version: '2.0' },
    meshes: [{
      primitives: [{
        indices: 0,
        attributes: { POSITION: 1 },
        material: 0
      }]
    }],
    accessors: [
      { count: indexCount },
      { count: indexCount }
    ],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    textures: [{ source: 0 }],
    images: [{
      uri: 'heavy.png',
      extras: {
        width: textureWidth,
        height: textureHeight
      }
    }]
  };
  writeFileSync(file, `${JSON.stringify(gltf, null, 2)}\n`);
}
