import { describe, expect, it } from 'vitest';
import { createScene2D25DPipeline } from '../src/index.js';

describe('2D and 2.5D runtime editor closure', () => {
  it('builds one production scene plan for tile streaming, arcade collision, camera, parallax, depth, lighting, and editor export', () => {
    const solidRow = new Array(48).fill(0).map((_, index) => (index >= 40 ? 1 : 0));
    const pipeline = createScene2D25DPipeline({
      tilemap: {
        width: 8,
        height: 6,
        tileWidth: 16,
        tileHeight: 16,
        layers: [
          { name: 'Ground', type: 'tilelayer', width: 8, height: 6, data: solidRow },
          {
            name: 'Collision',
            type: 'tilelayer',
            width: 8,
            height: 6,
            data: solidRow,
            collisionTileIds: [1]
          }
        ]
      },
      entities: [
        { id: 'hero', type: 'player', x: 48, y: 54, width: 12, height: 18, depthY: 72 },
        { id: 'tree', type: 'occluder', x: 64, y: 32, width: 24, height: 48, depthY: 80, occludes: ['hero'] },
        { id: 'npc', type: 'actor', x: 24, y: 48, width: 12, height: 16, depthY: 64 }
      ],
      camera: {
        follow: 'hero',
        viewport: { width: 160, height: 96 },
        bounds: { x: 0, y: 0, width: 128, height: 96 },
        lerp: 0.25,
        deadzone: { x: 48, y: 32, width: 64, height: 32 }
      },
      parallax: [
        { id: 'sky', factorX: 0.2, factorY: 0.1 },
        { id: 'mid', factorX: 0.55, factorY: 0.35 }
      ],
      collisions: { layer: 'Collision', solidTileIds: [1], arcade: true },
      streaming: { chunkWidth: 4, chunkHeight: 3, preloadRadius: 1 },
      lights: [
        {
          id: 'torch',
          type: 'point',
          x: 56,
          y: 58,
          radius: 48,
          intensity: 1.2,
          shadowCasters: ['tree']
        }
      ],
      editor: {
        exportTargets: ['web', 'wechat', 'electron'],
        hotReload: true,
        inspector: true
      }
    });

    expect(pipeline.schema).toBe('omnicore.scene-2d-25d-pipeline.v1');
    expect(pipeline.tilemap.summary).toMatchObject({
      width: 8,
      height: 6,
      tileWidth: 16,
      tileHeight: 16,
      layerCount: 2
    });
    expect(pipeline.streaming.visibleChunks.length).toBeGreaterThan(0);
    expect(pipeline.streaming.loadChunks).toContain('0,0');
    expect(pipeline.collisions.staticColliderCount).toBeGreaterThan(0);
    expect(pipeline.collisions.arcadeBodies[0]).toMatchObject({
      type: 'static',
      layer: 'Collision',
      width: 128,
      height: 16
    });
    expect(pipeline.collisions.debugDraw[0]).toMatchObject({ op: 'debug:rect', layer: 'Collision' });
    expect(pipeline.camera.followTargetId).toBe('hero');
    expect(pipeline.camera.deadzone).toMatchObject({ width: 64, height: 32 });
    expect(pipeline.parallax.layers.map((layer) => layer.id)).toEqual(['sky', 'mid']);
    expect(pipeline.depth2_5D.sortedEntities.map((entity) => entity.id)).toEqual(['npc', 'hero', 'tree']);
    expect(pipeline.depth2_5D.occlusionBands[0]).toMatchObject({ occluderId: 'tree', targetId: 'hero' });
    expect(pipeline.lighting.shadowCommands[0]).toMatchObject({
      lightId: 'torch',
      casterId: 'tree',
      op: 'light2d:shadow-rect'
    });
    expect(pipeline.editor.inspectorSections).toEqual(expect.arrayContaining([
      'Tilemap',
      'Camera2D',
      'ArcadePhysics',
      'Depth2.5D',
      'Light2D'
    ]));
    expect(pipeline.editor.exportPlan.targets).toEqual(['web', 'wechat', 'electron']);
    expect(pipeline.runtimeSync.payloads).toEqual(expect.arrayContaining([
      'tilemap',
      'camera',
      'collisions',
      'depth2_5D',
      'lighting'
    ]));
    expect(pipeline.quality.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: '2d-camera-follow' }),
      expect.objectContaining({ id: '2d-arcade-collision' }),
      expect.objectContaining({ id: '25d-depth-occlusion' })
    ]));
  });
});
