import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PLATFORMER_2D_CONTROLLER_SCHEMA,
  createArcade2DGameplayPlan,
  createPlatformer2DControllerStep
} from '../src/index.js';

describe('2D/2.5D platformer controller', () => {
  it('turns input buffering, coyote time, variable jump, drop-through, floor context, animation, and debug data into one controller step', () => {
    const controller = createPlatformer2DControllerStep({
      delta: 1 / 60,
      actor: {
        id: 'hero',
        x: 48,
        y: 78,
        width: 16,
        height: 24,
        velocity: { x: 20, y: -180 },
        facing: 'right',
        grounded: false,
        lastGroundedAgoMs: 64
      },
      input: {
        axisX: 1,
        jumpPressedAgoMs: 50,
        jumpHeld: false,
        jumpReleased: true,
        down: true,
        attackPressed: true
      },
      floor: {
        id: 'bridge',
        type: 'one-way',
        velocity: { x: 18, y: 0 },
        slopeAngleDegrees: -22
      },
      tuning: {
        maxSpeed: 140,
        acceleration: 720,
        deceleration: 900,
        airAcceleration: 420,
        jumpVelocity: 310,
        coyoteTimeMs: 100,
        jumpBufferMs: 120,
        variableJumpCut: 0.45,
        lookAhead: 42
      }
    });

    expect(controller.schema).toBe(PLATFORMER_2D_CONTROLLER_SCHEMA);
    expect(controller.input).toMatchObject({
      moveAxis: 1,
      jumpBuffered: true,
      jumpHeld: false,
      jumpReleased: true,
      attackPressed: true,
      dropThroughRequested: true
    });
    expect(controller.movement).toMatchObject({
      canUseCoyoteJump: true,
      jumpStarted: true,
      variableJumpCutApplied: true,
      facing: 'right'
    });
    expect(controller.movement.velocity.x).toBeGreaterThan(20);
    expect(controller.movement.velocity.y).toBeCloseTo(-139.5);
    expect(controller.physics.actor).toMatchObject({
      id: 'hero',
      velocity: controller.movement.velocity,
      controls: { jumpPressed: true }
    });
    expect(controller.physics.ignoredColliderIds).toEqual(['bridge']);
    expect(controller.physics.floorContext).toMatchObject({
      id: 'bridge',
      type: 'one-way',
      movingPlatform: true,
      slopeAngleDegrees: -22
    });
    expect(controller.animation).toMatchObject({
      state: 'attack',
      reason: 'attack-input'
    });
    expect(controller.camera).toMatchObject({
      followTargetId: 'hero',
      lookAhead: { x: 42, y: 0 }
    });
    expect(controller.editor.panels).toEqual(expect.arrayContaining([
      'ControllerTuning',
      'InputBuffer',
      'CoyoteTime',
      'VariableJump',
      'OneWayDropThrough',
      'AnimationBridge',
      'CameraAssist'
    ]));
    expect(controller.debugDraw.map((command) => command.op)).toEqual(expect.arrayContaining([
      'debug:platformer-input-buffer',
      'debug:platformer-coyote-window',
      'debug:platformer-floor-context',
      'debug:platformer-camera-lookahead'
    ]));
    expect(controller.quality.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'platformer-input-buffer', pass: true }),
      expect.objectContaining({ id: 'platformer-coyote-time', pass: true }),
      expect.objectContaining({ id: 'platformer-variable-jump', pass: true }),
      expect.objectContaining({ id: 'platformer-physics-bridge', pass: true }),
      expect.objectContaining({ id: 'platformer-animation-bridge', pass: true })
    ]));
  });

  it('feeds the existing Arcade 2D plan and is wired into the official demo', () => {
    const controller = createPlatformer2DControllerStep({
      delta: 0.5,
      actor: {
        id: 'hero',
        x: 40,
        y: 46,
        previous: { x: 40, y: 38 },
        width: 12,
        height: 18,
        velocity: { x: 0, y: 120 },
        grounded: true
      },
      input: { axisX: 0, jumpPressed: false },
      floor: { id: 'bridge', type: 'one-way' }
    });
    const plan = createArcade2DGameplayPlan({
      delta: 0.5,
      actors: [controller.physics.actor],
      colliders: [{ id: 'bridge', type: 'one-way', x: 32, y: 60, width: 64, height: 8 }]
    });

    expect(plan.actors.hero.movement.floorType).toBe('one-way');
    expect(plan.contacts).toContainEqual(expect.objectContaining({ actorId: 'hero', colliderId: 'bridge' }));

    const root = join(process.cwd(), 'examples/2d-25d-platformer-demo');
    const main = readFileSync(join(root, 'src/main.js'), 'utf8');
    const readme = readFileSync(join(root, 'README.md'), 'utf8');

    expect(main).toContain('createPlatformer2DControllerStep');
    expect(main).toContain('InputBuffer');
    expect(main).toContain('CoyoteTime');
    expect(main).toContain('VariableJump');
    expect(readme).toContain('input buffer');
    expect(readme).toContain('coyote time');
    expect(readme).toContain('variable jump');
  });
});
