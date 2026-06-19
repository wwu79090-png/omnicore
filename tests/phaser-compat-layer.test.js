import { describe, expect, it, vi } from 'vitest';
import { createPhaserCompatScene } from '../src/compat/phaser/PhaserCompat.js';
import { analyzeMigrationSource } from '../scripts/omni-migrate.js';

describe('Phaser compatibility layer', () => {
  it('maps Phaser scene lifecycle and sprite factories to OmniCore scene primitives', async () => {
    const keyboard = vi.fn();
    const preload = vi.fn(function preload() {
      this.load.image('hero', 'assets/hero.png');
    });
    const create = vi.fn(function create() {
      this.hero = this.physics.add.sprite(24, 32, 'hero');
      this.physics.add.collider(this.hero, { id: 'ground' }, () => 'hit');
      this.input.keyboard.on('keydown-SPACE', keyboard);
      this.tweens.add({ targets: this.hero, x: 120, duration: 300 });
    });
    const update = vi.fn();

    const compat = createPhaserCompatScene({
      key: 'LevelOne',
      preload,
      create,
      update
    });

    await compat.boot();
    compat.update(1 / 60, 16);

    expect(preload).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(16, 1 / 60);
    expect(compat.scene.name).toBe('LevelOne');
    expect(compat.scene.children[0]).toMatchObject({
      type: 'sprite',
      texture: 'hero',
      x: 24,
      y: 32
    });
    expect(compat.assets).toEqual([{ type: 'image', key: 'hero', url: 'assets/hero.png' }]);
    expect(compat.physicsBodies[0]).toMatchObject({ key: 'hero', arcade: true });
    expect(compat.colliders[0]).toMatchObject({ left: compat.scene.children[0], right: { id: 'ground' } });
    expect(compat.inputBindings[0]).toMatchObject({ event: 'keydown-SPACE', handler: keyboard });
    expect(compat.tweens[0]).toMatchObject({ targets: compat.scene.children[0], x: 120, duration: 300 });
  });

  it('detects Phaser loader, input, tween, and sprite factory migration opportunities', () => {
    const report = analyzeMigrationSource({
      file: 'level.js',
      source: `
        class LevelOne extends Phaser.Scene {
          preload() {
            this.load.image('hero', 'hero.png');
            this.load.spritesheet('run', 'run.png', { frameWidth: 32 });
          }
          create() {
            this.add.sprite(10, 20, 'hero');
            this.input.keyboard.on('keydown-SPACE', this.jump);
            this.tweens.add({ targets: this.player, x: 100 });
          }
        }
      `
    });

    expect(report.findings.map((finding) => finding.id)).toEqual(expect.arrayContaining([
      'phaser-loader-assets',
      'phaser-display-factory',
      'phaser-input-keyboard',
      'phaser-tween-timeline'
    ]));
  });
});
