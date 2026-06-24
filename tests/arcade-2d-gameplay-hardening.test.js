import { describe, expect, it } from 'vitest';
import {
  createArcade2DGameplayPlan,
  createScene2D25DPipeline
} from '../src/index.js';

describe('Arcade 2D gameplay hardening', () => {
  it('resolves one-way platforms, slopes, sensors, moving platforms, debug draw, editor metadata, and quality checks', () => {
    const plan = createArcade2DGameplayPlan({
      delta: 0.5,
      gravity: { x: 0, y: 0 },
      actors: [
        {
          id: 'hero',
          x: 40,
          y: 46,
          previous: { x: 40, y: 38 },
          width: 12,
          height: 18,
          velocity: { x: 20, y: 160 },
          controls: { jumpPressed: true },
          abilities: { coyoteTimeMs: 100, jumpBufferMs: 120, jumpVelocity: 220 }
        },
        {
          id: 'runner',
          x: 104,
          y: 52,
          previous: { x: 104, y: 50 },
          width: 12,
          height: 18,
          velocity: { x: 0, y: 40 }
        },
        {
          id: 'crate',
          x: 12,
          y: 48,
          previous: { x: 12, y: 46 },
          width: 12,
          height: 12,
          velocity: { x: 0, y: 10 }
        }
      ],
      colliders: [
        { id: 'bridge', type: 'one-way', x: 32, y: 60, width: 64, height: 8 },
        { id: 'hill', type: 'slope', x: 96, y: 40, width: 32, height: 32, slope: { direction: 'ascending' } },
        { id: 'lift', type: 'moving-platform', x: 8, y: 60, width: 20, height: 8, velocity: { x: 12, y: 0 } }
      ],
      sensors: [
        { id: 'coin', channel: 'pickup', x: 38, y: 40, width: 16, height: 16 }
      ],
      editor: {
        inspector: true,
        debugDraw: true,
        exportTargets: ['web', 'wechat']
      }
    });

    expect(plan.schema).toBe('omnicore.arcade-2d-gameplay-plan.v1');
    expect(plan.actors.hero.next).toMatchObject({
      x: 40,
      y: 42,
      grounded: true,
      floorId: 'bridge'
    });
    expect(plan.actors.hero.movement).toMatchObject({
      floorType: 'one-way',
      canJump: true,
      jumpBuffered: true
    });
    expect(plan.actors.runner.next).toMatchObject({
      grounded: true,
      floorId: 'hill'
    });
    expect(plan.actors.runner.movement.slopeAngleDegrees).toBeLessThan(0);
    expect(plan.actors.crate.next).toMatchObject({
      x: 18,
      grounded: true,
      floorId: 'lift'
    });
    expect(plan.actors.crate.movement.platformVelocity).toEqual({ x: 12, y: 0 });
    expect(plan.contacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ actorId: 'hero', colliderId: 'bridge', kind: 'one-way' }),
      expect.objectContaining({ actorId: 'runner', colliderId: 'hill', kind: 'slope' }),
      expect.objectContaining({ actorId: 'crate', colliderId: 'lift', kind: 'moving-platform' })
    ]));
    expect(plan.sensorEvents).toEqual([
      expect.objectContaining({ actorId: 'hero', sensorId: 'coin', channel: 'pickup' })
    ]);
    expect(plan.debugDraw.map((command) => command.op)).toEqual(expect.arrayContaining([
      'debug:arcade-actor',
      'debug:arcade-one-way',
      'debug:arcade-slope',
      'debug:arcade-sensor'
    ]));
    expect(plan.editor.inspectorSections).toEqual([
      'Arcade2D',
      'OneWayPlatforms',
      'SlopeColliders',
      'MovingPlatforms',
      'Sensors',
      'DebugDraw',
      'Export'
    ]);
    expect(plan.editor.exportPlan.targets).toEqual(['web', 'wechat']);
    expect(plan.quality.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'arcade-one-way-platforms', pass: true }),
      expect.objectContaining({ id: 'arcade-slope-colliders', pass: true }),
      expect.objectContaining({ id: 'arcade-moving-platforms', pass: true }),
      expect.objectContaining({ id: 'arcade-sensor-events', pass: true })
    ]));
  });

  it('connects the stronger Arcade 2D gameplay plan into the 2D/2.5D scene pipeline', () => {
    const pipeline = createScene2D25DPipeline({
      tilemap: {
        width: 8,
        height: 5,
        tileWidth: 16,
        tileHeight: 16,
        layers: [
          {
            name: 'Collision',
            type: 'tilelayer',
            width: 8,
            height: 5,
            data: new Array(40).fill(0).map((_, index) => (index >= 32 ? 1 : 0)),
            collisionTileIds: [1]
          }
        ]
      },
      entities: [
        { id: 'hero', type: 'player', x: 40, y: 46, previous: { x: 40, y: 38 }, width: 12, height: 18 }
      ],
      camera: { follow: 'hero', viewport: { width: 160, height: 96 } },
      collisions: { layer: 'Collision', solidTileIds: [1] },
      arcade2D: {
        delta: 0.5,
        actors: [
          {
            id: 'hero',
            x: 40,
            y: 46,
            previous: { x: 40, y: 38 },
            width: 12,
            height: 18,
            velocity: { x: 0, y: 120 }
          }
        ],
        colliders: [
          { id: 'bridge', type: 'one-way', x: 32, y: 60, width: 64, height: 8 }
        ],
        sensors: [
          { id: 'tutorial-zone', channel: 'tutorial', x: 32, y: 42, width: 32, height: 24 }
        ]
      }
    });

    expect(pipeline.arcade2D.schema).toBe('omnicore.arcade-2d-gameplay-plan.v1');
    expect(pipeline.arcade2D.actors.hero.next).toMatchObject({ y: 42, grounded: true });
    expect(pipeline.editor.inspectorSections).toContain('Arcade2DGameplay');
    expect(pipeline.runtimeSync.payloads).toContain('arcade2D');
    expect(pipeline.quality.checks).toContainEqual(expect.objectContaining({
      id: 'arcade2d-gameplay-loop',
      pass: true
    }));
  });
});
