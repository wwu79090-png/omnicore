import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import OmniCore, { Deprecation, Game, StorageManager } from '../src/index.js';
import { migrate as migrateV1ToV2 } from '../migration/v1.0.0_to_v2.0.0.js';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

describe('OmniCore maintenance system', () => {
  it('keeps old data copies when migrating playerData from v1.0.0 to v2.0.0', () => {
    const oldSave = {
      engineVersion: '1.0.0',
      playerData: {
        id: 'p1',
        name: 'Ada',
        level: 7,
        inventory: ['wand']
      }
    };

    const migrated = migrateV1ToV2(oldSave);

    expect(migrated.engineVersion).toBe('2.0.0');
    expect(migrated.player).toEqual({
      id: 'p1',
      profile: { name: 'Ada' },
      progression: { level: 7 },
      inventory: ['wand']
    });
    expect(migrated.__backup.playerData).toEqual(oldSave.playerData);
    expect(oldSave.playerData.name).toBe('Ada');
  });

  it('runs Storage version mismatch migration during Game.init without overwriting backups', async () => {
    StorageManager.memory.clear();
    StorageManager.set('omnicore:engineVersion', '1.0.0');
    StorageManager.set('playerData', { id: 'p2', name: 'Lin', level: 3, inventory: [] });
    const mismatch = vi.fn(({ from, to }) => ({ from, to }));

    const game = new Game({
      renderer: 'canvas',
      autoAttach: false,
      autoStart: false,
      engineVersion: '2.0.0',
      onVersionMismatch: mismatch,
      migrations: {
        '1.0.0->2.0.0': ({ storage }) => {
          const playerData = storage.get('playerData');
          storage.backup('playerData', playerData, '1.0.0');
          storage.set('player', { profile: { name: playerData.name }, progression: { level: playerData.level } });
        }
      }
    });

    await game.init();

    expect(mismatch).toHaveBeenCalledWith(expect.objectContaining({ from: '1.0.0', to: '2.0.0' }));
    expect(StorageManager.get('omnicore:engineVersion')).toBe('2.0.0');
    expect(StorageManager.get('playerData')).toEqual({ id: 'p2', name: 'Lin', level: 3, inventory: [] });
    expect(StorageManager.get('player')).toEqual({ profile: { name: 'Lin' }, progression: { level: 3 } });
    expect(StorageManager.get('omnicore:backup:1.0.0:playerData')).toEqual({
      id: 'p2',
      name: 'Lin',
      level: 3,
      inventory: []
    });

    game.destroy();
  });

  it('warns and forwards deprecated APIs to supported replacements', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const calls = [];
    const result = await Deprecation.forward({
      api: 'OmniCore.Backend.use',
      since: '0.2.0',
      removeIn: '1.0.0',
      replacement: 'OmniCore.Backend.switch',
      target: () => {
        calls.push('switch');
        return 'ok';
      }
    });

    expect(result).toBe('ok');
    expect(calls).toEqual(['switch']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[OmniCore] [Deprecation] 已废弃 API OmniCore.Backend.use'));
    warn.mockRestore();
  });

  it('exposes required maintenance npm scripts', () => {
    expect(packageJson.scripts.health).toBe('node scripts/health-check.js');
    expect(packageJson.scripts['audit:deprecated']).toBe('node scripts/audit-deprecated.js');
    expect(packageJson.scripts['security-check']).toBe('node scripts/security-check.js');
    expect(packageJson.scripts['test:mem']).toBe('node scripts/health-check.js --memory');
    expect(packageJson.scripts['test:backends']).toBe('node scripts/health-check.js --backends');
    expect(packageJson.scripts['browsers:install']).toBe('playwright install chromium firefox webkit');
    expect(packageJson.scripts['pretest:e2e']).toBe('playwright install chromium firefox webkit');
  });

  it('exports maintenance helpers from the public OmniCore namespace', () => {
    expect(OmniCore.Deprecation).toBe(Deprecation);
    expect(typeof OmniCore.Storage.ensureEngineVersion).toBe('function');
    expect(typeof OmniCore.Storage.backup).toBe('function');
  });
});
