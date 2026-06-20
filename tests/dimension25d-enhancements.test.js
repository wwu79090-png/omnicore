import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AIImporter,
  AudioManager,
  HeightfieldNavMesh25D,
  Light2D,
  NavigationAgent2D,
  ParticleTerrainCollider25D
} from '../src/index.js';

describe('OmniCore 2.5D enhancement pack', () => {
  it('finds height-aware paths and marks jump decisions across z deltas', () => {
    const navmesh = new HeightfieldNavMesh25D({
      width: 3,
      height: 2,
      cellSize: 32,
      heights: [
        0, 1, 2,
        0, 0, 0
      ],
      jumpHeight: 1.25
    });
    const path = navmesh.findPath({ x: 0, y: 0 }, { x: 2, y: 0 });
    const agent = new NavigationAgent2D({ navmesh, position: { x: 0, y: 0, z: 0 }, speed: 32 });

    agent.setTarget({ x: 64, y: 0, z: 2 });

    expect(path.map((point) => point.z)).toEqual([0, 1, 2]);
    expect(path.some((point) => point.action === 'jump')).toBe(true);
    expect(agent.path.at(-1)).toMatchObject({ x: 2, y: 0, z: 2 });
  });

  it('computes 2.5D spatial audio attenuation, occlusion low-pass, and vertical reverb bias', () => {
    const audio = new AudioManager();
    const profile = audio.createSpatial25DProfile({
      listener: { x: 0, y: 0, z: 0 },
      source: { x: 96, y: 0, z: 64 },
      occluders: [{ id: 'wall', absorption: 0.75 }]
    });

    expect(profile.distance).toBeGreaterThan(100);
    expect(profile.gain).toBeLessThan(1);
    expect(profile.lowpassHz).toBeLessThan(12000);
    expect(profile.reverbBias).toBeGreaterThan(0);
    expect(profile.occluded).toBe(true);
  });

  it('bounces and slides particles against projected 2.5D terrain height', () => {
    const collider = new ParticleTerrainCollider25D({
      width: 2,
      height: 2,
      cellSize: 32,
      heights: [0, 0, 1, 1],
      restitution: 0.5,
      friction: 0.5
    });
    const [particle] = collider.step([{ x: 16, y: 40, z: 0.2, vx: 8, vy: 0, vz: -10 }], 0.1);

    expect(particle.collided).toBe(true);
    expect(particle.z).toBeGreaterThanOrEqual(1);
    expect(particle.vz).toBeGreaterThan(0);
    expect(Math.abs(particle.vx)).toBeLessThan(8);
  });

  it('creates volumetric fog, light scattering, and rim-light render commands from Light2D', () => {
    const layer = Light2D.createVolumetricFogLayer({
      lights: [Light2D.directional({ angle: 0.5, intensity: 1.2 })],
      occluders: [{ id: 'tower', x: 64, y: 32, width: 24, height: 96, depth: 2 }],
      fog: { density: 0.4, scatter: 0.75, rimStrength: 0.5 }
    });

    expect(layer.pipeline).toBe('omnicore-25d-volumetric-fog/v1');
    expect(layer.commands.map((command) => command.op)).toEqual([
      'fog:volume-pass',
      'fog:scatter-light',
      'fog:rim-light'
    ]);
    expect(layer.commands[1].scatter).toBe(0.75);
  });

  it('generates 2.5D procedural assets, projected shadows, z sorting, and occlusion from 2D boundaries', () => {
    const importer = new AIImporter({ fetcher: null });
    const level = importer.generate25DLevel({
      name: 'river-forest',
      boundaries: [
        { type: 'river', points: [{ x: 0, y: 80 }, { x: 160, y: 96 }] },
        { type: 'forest', points: [{ x: 32, y: 16 }, { x: 96, y: 48 }] }
      ]
    });

    expect(level.assets.map((asset) => asset.kind)).toEqual(expect.arrayContaining(['water-plane', 'tree-model']));
    expect(level.shadows.length).toBeGreaterThan(0);
    expect(level.depthOcclusion.every((item) => Number.isFinite(item.sortY))).toBe(true);
    expect(level.entities).toEqual([...level.entities].sort((a, b) => a.sortY - b.sortY));
  });

  it('ships algorithm docs and independent example scenes for all five enhancements', () => {
    expect(existsSync('docs/25d-enhancements.md')).toBe(true);
    for (const name of ['navigation', 'audio', 'particles', 'fog', 'procedural-level']) {
      expect(existsSync(`examples/25d-enhancements/${name}.scene.json`)).toBe(true);
    }
  });
});
