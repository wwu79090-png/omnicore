import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPhysicsWorld } from '@omnicore/physics';

describe('@omnicore/physics editor-grade runtime world', () => {
  it('runs arcade contacts, sensors, raycasts, constraints, debug draw, and backend capability reports', () => {
    const world = createPhysicsWorld({
      backend: 'arcade',
      gravity: { x: 0, y: 0 }
    });

    world.addBody({
      id: 'hero',
      type: 'dynamic',
      x: 0,
      y: 0,
      width: 8,
      height: 8,
      velocity: { x: 20, y: 0 },
      collider: { shape: 'box', width: 8, height: 8 }
    });
    world.addBody({
      id: 'crate',
      type: 'static',
      x: 12,
      y: 0,
      width: 8,
      height: 8,
      collider: { shape: 'box', width: 8, height: 8 }
    });
    world.addSensor({
      id: 'finish-trigger',
      x: 16,
      y: 0,
      width: 6,
      height: 8
    });
    world.addConstraint({
      id: 'hero-rope',
      type: 'distance',
      bodyA: 'hero',
      bodyB: 'crate',
      limits: { min: 2, max: 24 }
    });

    const step = world.step(0.5);
    const hit = world.raycast({ x: -10, y: 4 }, { x: 1, y: 0 }, 80);
    const snapshot = world.createDiagnosticsSnapshot({
      raycasts: [{
        id: 'forward-probe',
        origin: { x: -10, y: 4 },
        direction: { x: 1, y: 0 },
        maxDistance: 80
      }]
    });

    expect(step).toMatchObject({
      stepped: true,
      backend: 'arcade',
      contacts: [expect.objectContaining({ bodyA: 'hero', bodyB: 'crate' })],
      sensors: [expect.objectContaining({ sensorId: 'finish-trigger', bodyId: 'hero' })]
    });
    expect(hit).toMatchObject({ bodyId: 'hero', distance: 20 });
    expect(snapshot.schema).toBe('omnicore.physics-runtime-diagnostics.v1');
    expect(snapshot.summary).toMatchObject({
      bodyCount: 3,
      dynamicBodyCount: 1,
      staticBodyCount: 2,
      sensorCount: 1,
      constraintCount: 1,
      contactCount: 1,
      sensorEventCount: 1,
      raycastHitCount: 1,
      debugColliderCount: 3
    });
    expect(snapshot.debugDraw.colliders.map((collider) => collider.id)).toEqual([
      'hero',
      'crate',
      'finish-trigger'
    ]);
    expect(snapshot.backendCapabilities.backends.map((backend) => backend.id)).toEqual(expect.arrayContaining([
      'arcade',
      'rapier',
      'box2d',
      'noop'
    ]));
    expect(snapshot.crossEngineProfile.capabilities).toEqual(expect.arrayContaining([
      'arcade-contacts',
      'sensor-overlap-events',
      'raycast-probes',
      'constraint-audit',
      'editor-debug-draw'
    ]));
  });

  it('ships a runnable physics debug draw demo that exercises the public package API', () => {
    const demoRoot = join(process.cwd(), 'examples/physics-debug-draw-demo');
    const mainPath = join(demoRoot, 'src/main.js');
    const readmePath = join(demoRoot, 'README.md');

    expect(existsSync(join(demoRoot, 'index.html'))).toBe(true);
    expect(existsSync(mainPath)).toBe(true);
    expect(existsSync(readmePath)).toBe(true);

    const main = readFileSync(mainPath, 'utf8');
    expect(main).toContain("from '@omnicore/physics'");
    expect(main).toContain('createPhysicsWorld');
    expect(main).toContain('addSensor');
    expect(main).toContain('addConstraint');
    expect(main).toContain('createDiagnosticsSnapshot');
    expect(main).toContain('debugDraw');

    const readme = readFileSync(readmePath, 'utf8');
    expect(readme).toContain('Physics Debug Draw Demo');
    expect(readme).toContain('sensor');
    expect(readme).toContain('raycast');
  });
});
