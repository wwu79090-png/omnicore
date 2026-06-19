import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import OmniCore, {
  DevProfile,
  PrefabRegistry,
  Templates,
  TimeGuard
} from '../src/index.js';
import { optimizeGameSources, optimizeSource } from '../scripts/optimize-source.js';

describe('PrefabRegistry JSON prefabs', () => {
  it('loads inherited prefab JSON and instantiates a sprite entity', () => {
    const registry = new PrefabRegistry();

    registry.load('Enemy', {
      type: 'sprite',
      texture: 'enemy',
      width: 24,
      height: 24,
      props: { hp: 10, faction: 'monster' }
    });
    registry.load('Slime', {
      extends: 'Enemy',
      texture: 'slime',
      props: { hp: 3 }
    });

    const slime = registry.instantiate('Slime', 100, 200);

    expect(slime.texture).toBe('slime');
    expect(slime.x).toBe(100);
    expect(slime.y).toBe(200);
    expect(slime.width).toBe(24);
    expect(slime.props).toMatchObject({ hp: 3, faction: 'monster' });
  });

  it('reads missing prefabs from /assets/prefabs before instantiation', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ type: 'sprite', texture: 'bat', props: { hp: 2 } })
    }));
    const registry = new PrefabRegistry({ fetcher });

    await registry.load('bat');
    const bat = registry.instantiate('bat', 4, 8);

    expect(fetcher).toHaveBeenCalledWith('/assets/prefabs/bat.json');
    expect(bat.texture).toBe('bat');
    expect(bat.props.hp).toBe(2);
  });
});

describe('DevProfile pressure scan', () => {
  it('runs a debug-only 10 second pressure scan and returns concrete suggestions', async () => {
    const profile = new DevProfile({
      debug: true,
      durationMs: 10000,
      frameSampler: async () => [40, 38, 36, 34]
    });

    const report = await profile.scan();

    expect(report.durationMs).toBe(10000);
    expect(report.load).toEqual({ tiles: 200, entities: 50, sounds: 1 });
    expect(report.avgFps).toBeLessThan(30);
    expect(report.suggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'tile.chunkSize', value: '16x16' }),
      expect.objectContaining({ key: 'renderer.bloom', value: false })
    ]));
  });

  it('does not scan release mode by default', async () => {
    const profile = new DevProfile({ debug: false });
    await expect(profile.scan()).resolves.toBeNull();
  });
});

describe('source optimizer', () => {
  it('rewrites high-frequency new Entity and new Sprite inside loops to pool allocation', () => {
    const source = `
      for (let i = 0; i < 10; i += 1) {
        const enemy = new Entity({ hp: 1 });
        const sprite = new Sprite('slime');
      }
      const menu = new Sprite('menu');
    `;

    const result = optimizeSource(source);

    expect(result.changed).toBe(true);
    expect(result.output).toContain("OmniCore.Pool.allocate('Entity')");
    expect(result.output).toContain("OmniCore.Pool.allocate('Sprite')");
    expect(result.output).toContain("const menu = new Sprite('menu')");
    expect(result.rewrites).toHaveLength(2);
  });

  it('scans src/game style folders and writes optimized files with logs', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'omni-optimize-'));
    const gameDir = path.join(root, 'src', 'game');
    const file = path.join(gameDir, 'combat.js');
    mkdirSync(gameDir, { recursive: true });
    writeFileSync(file, 'while (alive) {\n  const e = new Entity();\n}\n');

    const report = optimizeGameSources({ root, logger: () => {} });

    expect(report.filesChanged).toBe(1);
    expect(readFileSync(file, 'utf8')).toContain("OmniCore.Pool.allocate('Entity')");
  });
});

describe('TimeGuard and Templates', () => {
  it('clamps abnormal deltaTime spikes to 16ms and warns once', () => {
    const warn = vi.fn();
    const clockValues = [1000, 1016, 1032];
    const guard = new TimeGuard({
      clock: () => clockValues.shift() ?? 1048,
      warn,
      expectedFrameMs: 16
    });

    expect(guard.clamp(16)).toBe(16);
    expect(guard.clamp(120)).toBe(16);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('deltaTime'));
  });

  it('generates a reusable topdown player starter template', () => {
    const code = Templates.generate('topdown_player');

    expect(code).toContain('class Player');
    expect(code).toContain('WASD');
    expect(code).toContain('store.subscribe');
    expect(code).toContain('OmniCore.Sprite');
  });

  it('exposes ergonomic helpers from OmniCore namespace', () => {
    expect(typeof OmniCore.Prefab.instantiate).toBe('function');
    expect(typeof OmniCore.DevProfile).toBe('function');
    expect(typeof OmniCore.TimeGuard).toBe('function');
    expect(typeof OmniCore.Templates.generate).toBe('function');
  });
});
