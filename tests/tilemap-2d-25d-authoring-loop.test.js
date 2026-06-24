import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  TILEMAP_2D_25D_AUTHORING_SCHEMA,
  createTilemap2D25DAuthoringLoop
} from '../src/index.js';

describe('2D/2.5D tilemap authoring and playtest loop', () => {
  it('builds a complete editor loop for tile editing, stamps, animation, playtest, hot reload, and 2.5D preview', () => {
    const loop = createTilemap2D25DAuthoringLoop({
      tilemap: {
        width: 8,
        height: 6,
        tileWidth: 16,
        tileHeight: 16,
        layers: [
          { name: 'Ground', type: 'tilelayer', width: 8, height: 6, data: new Array(48).fill(0) },
          { name: 'Collision', type: 'tilelayer', width: 8, height: 6, data: new Array(48).fill(0) },
          { name: 'Decoration', type: 'tilelayer', width: 8, height: 6, data: new Array(48).fill(4) }
        ]
      },
      tileOperations: [
        { tool: 'brush', layer: 'Ground', x: 2, y: 1, tile: 3 },
        { tool: 'rect-fill', layer: 'Ground', x: 0, y: 4, width: 4, height: 1, tile: 5 },
        { tool: 'erase', layer: 'Decoration', x: 1, y: 1 },
        { tool: 'selection-copy', layer: 'Ground', x: 0, y: 4, width: 2, height: 1, target: { x: 5, y: 2 } },
        {
          tool: 'terrain-rule',
          layer: 'Ground',
          x: 3,
          y: 3,
          tile: 9,
          rule: { id: 'grass-edge', neighbors: ['n', 'e', 's', 'w'], edgeTile: 10 }
        }
      ],
      collisionPaint: [
        { kind: 'one-way', x: 2, y: 2, width: 3, height: 1 },
        { kind: 'slope', x: 5, y: 3, width: 2, height: 1, direction: 'ascending' },
        { kind: 'moving-platform', x: 1, y: 5, width: 2, height: 1, velocity: { x: 16, y: 0 } }
      ],
      stampPalette: [
        { id: 'slime', type: 'monster', prefab: 'prefabs/slime.prefab.json', size: { width: 16, height: 14 } },
        { id: 'spikes', type: 'trap', prefab: 'prefabs/spikes.prefab.json' },
        { id: 'chest', type: 'chest', prefab: 'prefabs/chest.prefab.json' },
        { id: 'portal', type: 'portal', prefab: 'prefabs/portal.prefab.json' },
        { id: 'torch', type: 'light', prefab: 'prefabs/torch-light.prefab.json', light: { radius: 64 } },
        { id: 'tutorial', type: 'trigger', prefab: 'prefabs/tutorial-trigger.prefab.json' }
      ],
      stampPlacements: [
        { stamp: 'slime', tile: { x: 3, y: 4 }, count: 2, spacing: { x: 1, y: 0 } },
        { stamp: 'spikes', tile: { x: 1, y: 4 } },
        { stamp: 'chest', tile: { x: 6, y: 4 } },
        { stamp: 'portal', tile: { x: 7, y: 3 } },
        { stamp: 'torch', tile: { x: 2, y: 2 } },
        { stamp: 'tutorial', tile: { x: 0, y: 3 } }
      ],
      animation: {
        actorId: 'hero',
        arcadeState: {
          grounded: true,
          velocity: { x: 80, y: 0 },
          attacking: false,
          hurt: false
        },
        states: ['idle', 'run', 'jump', 'fall', 'attack', 'hurt'],
        ySortPreview: true,
        entities: [
          { id: 'hero', type: 'player', x: 32, y: 48, width: 16, height: 24 }
        ]
      },
      playtest: {
        runInEditor: true,
        hotReload: true,
        debug: ['collisions', 'sensors', 'animation', 'y-sort']
      }
    });

    expect(loop.schema).toBe(TILEMAP_2D_25D_AUTHORING_SCHEMA);
    expect(loop.editor.tools).toEqual(expect.arrayContaining([
      'Brush',
      'RectFill',
      'Eraser',
      'SelectionCopy',
      'AutoTile',
      'TerrainRule',
      'CollisionPainter',
      'StampPalette',
      'Playtest'
    ]));
    expect(loop.tilemap.edits.map((edit) => edit.tool)).toEqual(expect.arrayContaining([
      'brush',
      'rect-fill',
      'erase',
      'selection-copy',
      'terrain-rule',
      'autotile-neighbor'
    ]));
    expect(loop.tilemap.changedCells).toEqual(expect.arrayContaining([
      expect.objectContaining({ layer: 'Ground', x: 2, y: 1, to: 3 }),
      expect.objectContaining({ layer: 'Decoration', x: 1, y: 1, to: 0 }),
      expect.objectContaining({ layer: 'Ground', x: 5, y: 2, tool: 'selection-copy' })
    ]));
    expect(loop.collision.colliders).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'one-way-0', type: 'one-way', x: 32, y: 32, width: 48, height: 16 }),
      expect.objectContaining({ id: 'slope-1', type: 'slope', slope: { direction: 'ascending' } }),
      expect.objectContaining({ id: 'moving-platform-2', type: 'moving-platform', velocity: { x: 16, y: 0 } })
    ]));
    expect(loop.collision.debugDraw.map((command) => command.op)).toEqual(expect.arrayContaining([
      'debug:collision-one-way',
      'debug:collision-slope',
      'debug:collision-moving-platform'
    ]));
    expect(loop.stamps.placements).toHaveLength(7);
    expect(loop.stamps.placements[0]).toMatchObject({
      stamp: 'slime',
      prefab: 'prefabs/slime.prefab.json',
      x: 48,
      y: 64
    });
    expect(loop.stamps.undoRedo.undoStack.map((entry) => entry.op)).toEqual(expect.arrayContaining([
      'tile-edit-batch',
      'stamp-place-batch'
    ]));
    expect(loop.savePatch.dependencies.prefabs).toEqual(expect.arrayContaining([
      'prefabs/slime.prefab.json',
      'prefabs/torch-light.prefab.json',
      'prefabs/tutorial-trigger.prefab.json'
    ]));
    expect(loop.savePatch.scene.entities.map((entity) => entity.type)).toEqual(expect.arrayContaining([
      'monster',
      'trap',
      'chest',
      'portal',
      'light',
      'trigger'
    ]));
    expect(loop.animation.current).toBe('run');
    expect(loop.animation.stateMachine.states).toHaveProperty('idle');
    expect(loop.animation.stateMachine.states).toHaveProperty('hurt');
    expect(loop.animation.ySortPreview).toContainEqual(expect.objectContaining({
      id: 'hero',
      animation: 'run'
    }));
    expect(loop.playtest.runAction).toMatchObject({ type: 'editor:playtest:start' });
    expect(loop.playtest.debugPanels).toEqual(expect.arrayContaining([
      'Collisions',
      'Sensors',
      'Animation',
      'YSort'
    ]));
    expect(loop.playtest.hotReloadEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'tilemap:changed' }),
      expect.objectContaining({ type: 'scene:stamps-changed' }),
      expect.objectContaining({ type: 'animation:state-changed' })
    ]));
  });

  it('ships an official playable 2D/2.5D platformer demo template', () => {
    const root = join(process.cwd(), 'examples/2d-25d-platformer-demo');
    const mainPath = join(root, 'src/main.js');
    const readmePath = join(root, 'README.md');
    const packagePath = join(root, 'package.json');

    expect(existsSync(join(root, 'index.html'))).toBe(true);
    expect(existsSync(mainPath)).toBe(true);
    expect(existsSync(readmePath)).toBe(true);
    expect(existsSync(packagePath)).toBe(true);

    const main = readFileSync(mainPath, 'utf8');
    expect(main).toContain('createTilemap2D25DAuthoringLoop');
    expect(main).toContain('createArcade2DGameplayPlan');
    expect(main).toContain('createScene2D25DPipeline');
    expect(main).toContain('moving-platform');
    expect(main).toContain('requestAnimationFrame');
    expect(main).toContain('debugOverlay');

    const readme = readFileSync(readmePath, 'utf8');
    expect(readme).toContain('2D/2.5D Platformer Demo');
    expect(readme).toContain('one-way');
    expect(readme).toContain('slope');
    expect(readme).toContain('hot reload');
  });
});
