import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeMigrationSource, migrateProject } from '../scripts/omni-migrate.js';

describe('cross-engine migration analysis', () => {
  it('reports Phaser Scene lifecycle and Arcade Physics migration risks', () => {
    const source = `
      class LevelOne extends Phaser.Scene {
        preload() { this.load.image('hero', 'hero.png'); }
        create() {
          this.player = this.physics.add.sprite(32, 48, 'hero');
          this.physics.add.collider(this.player, this.platforms);
        }
        update(time, delta) { this.player.setVelocityX(120); }
      }
    `;

    const report = analyzeMigrationSource({ source, file: 'level-one.js' });

    expect(report.framework).toBe('phaser');
    expect(report.findings.map((finding) => finding.id)).toEqual(expect.arrayContaining([
      'phaser-scene-lifecycle',
      'phaser-arcade-physics'
    ]));
    expect(report.findings.find((finding) => finding.id === 'phaser-scene-lifecycle')).toMatchObject({
      risk: 'low',
      omnicoreTarget: 'OmniCore Scene'
    });
    expect(report.findings.find((finding) => finding.id === 'phaser-arcade-physics')).toMatchObject({
      risk: 'medium',
      omnicoreTarget: 'loadPhysics() + PhysicsWorld'
    });
  });

  it('reports Construct Event Sheet and Cocos Component/Prefab migration risks', () => {
    const constructReport = analyzeMigrationSource({
      file: 'event-sheet.json',
      source: JSON.stringify({
        project: 'platformer',
        eventSheets: [
          {
            name: 'Main',
            events: [
              { conditions: [{ type: 'Keyboard', key: 'ArrowRight' }], actions: [{ type: 'Move', dx: 2 }] }
            ]
          }
        ]
      })
    });

    const cocosReport = analyzeMigrationSource({
      file: 'Player.ts',
      source: `
        import { _decorator, Component, Prefab } from 'cc';
        const { ccclass, property } = _decorator;
        @ccclass('Player')
        export class Player extends Component {
          @property(Prefab) bulletPrefab = null;
          start() {}
          update(dt) {}
        }
      `
    });

    expect(constructReport.framework).toBe('construct');
    expect(constructReport.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'construct-event-sheet',
        risk: 'low',
        omnicoreTarget: 'JSON Event Sheet + VisualEventGraph'
      })
    ]));
    expect(cocosReport.framework).toBe('cocos');
    expect(cocosReport.findings.map((finding) => finding.id)).toEqual(expect.arrayContaining([
      'cocos-component',
      'cocos-prefab'
    ]));
  });

  it('prints a dry-run migration report without changing user source files', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'omni-migrate-analysis-'));
    const sourceFile = path.join(root, 'level.js');
    const original = `
      class LevelOne extends Phaser.Scene {
        preload() { this.load.image('hero', 'hero.png'); }
        create() { this.physics.add.sprite(32, 48, 'hero'); }
      }
    `;
    writeFileSync(sourceFile, original);
    mkdirSync(path.join(root, 'construct'), { recursive: true });
    writeFileSync(path.join(root, 'construct', 'events.json'), JSON.stringify({ eventSheets: [{ events: [] }] }));

    const project = migrateProject({ root, dryRun: true });
    expect(project.analysisSummary.frameworks).toEqual(expect.arrayContaining(['phaser', 'construct']));

    const output = execFileSync(process.execPath, ['scripts/omni-migrate.js', '--root', root, '--dry-run'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 120000
    });

    expect(output).toContain('OmniCore Migration Dry Run');
    expect(output).toContain('phaser-scene-lifecycle');
    expect(output).toContain('construct-event-sheet');
    expect(readFileSync(sourceFile, 'utf8')).toBe(original);
  });
});
