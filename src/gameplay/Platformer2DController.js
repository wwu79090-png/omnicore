export const PLATFORMER_2D_CONTROLLER_SCHEMA = 'omnicore.platformer-2d-controller.v1';

/**
 * Builds one platformer controller step for 2D/2.5D projects.
 */
export function createPlatformer2DControllerStep(config = {}) {
  const delta = Math.max(0, numberOr(config.delta, 1 / 60));
  const actor = normalizeActor(config.actor || {});
  const tuning = normalizeTuning(config.tuning || {});
  const input = normalizeInput(config.input || {}, tuning);
  const floorContext = normalizeFloorContext(config.floor || actor.floor || null);
  const movement = buildMovementState({ actor, input, floorContext, tuning, delta });
  const physics = buildPhysicsBridge({ actor, input, movement, floorContext, tuning });
  const animation = buildAnimationBridge({ actor, input, movement });
  const camera = buildCameraHints({ actor, input, movement, tuning });
  const editor = buildEditorState(tuning);
  const runtimeSync = buildRuntimeSyncState();
  const debugDraw = buildDebugDraw({ actor, input, movement, floorContext, camera, tuning });
  const quality = buildQualityChecks({ input, movement, physics, animation });

  return {
    schema: PLATFORMER_2D_CONTROLLER_SCHEMA,
    delta,
    actor: {
      id: actor.id,
      x: actor.x,
      y: actor.y,
      width: actor.width,
      height: actor.height
    },
    input,
    tuning,
    movement,
    physics,
    animation,
    camera,
    editor,
    runtimeSync,
    debugDraw,
    quality
  };
}

function normalizeActor(actor = {}) {
  const width = numberOr(actor.width ?? actor.w, 0);
  const height = numberOr(actor.height ?? actor.h, 0);
  const x = numberOr(actor.x, 0);
  const y = numberOr(actor.y, 0);
  return {
    ...actor,
    id: actor.id || actor.name || 'actor',
    x,
    y,
    previous: {
      x: numberOr(actor.previous?.x, x),
      y: numberOr(actor.previous?.y, y)
    },
    width,
    height,
    velocity: normalizeVector(actor.velocity || { x: actor.vx, y: actor.vy }),
    facing: actor.facing || (numberOr(actor.velocity?.x ?? actor.vx, 0) < 0 ? 'left' : 'right'),
    grounded: actor.grounded === true,
    lastGroundedAgoMs: numberOr(actor.lastGroundedAgoMs ?? actor.groundedAgeMs, Number.POSITIVE_INFINITY),
    health: numberOr(actor.health, 1)
  };
}

function normalizeTuning(tuning = {}) {
  return {
    maxSpeed: numberOr(tuning.maxSpeed, 160),
    acceleration: numberOr(tuning.acceleration, 900),
    deceleration: numberOr(tuning.deceleration, 1000),
    airAcceleration: numberOr(tuning.airAcceleration, 520),
    jumpVelocity: numberOr(tuning.jumpVelocity, 320),
    coyoteTimeMs: numberOr(tuning.coyoteTimeMs, 100),
    jumpBufferMs: numberOr(tuning.jumpBufferMs, 120),
    variableJumpCut: clamp(numberOr(tuning.variableJumpCut, 0.5), 0, 1),
    lookAhead: numberOr(tuning.lookAhead, 36),
    landingPeek: numberOr(tuning.landingPeek, 0)
  };
}

function normalizeInput(input, tuning) {
  const source = input || {};
  const moveAxis = clamp(numberOr(source.axisX ?? source.moveAxis, axisFromButtons(source)), -1, 1);
  const jumpPressedAgoMs = source.jumpPressedAgoMs == null
    ? (source.jumpPressed ? 0 : Number.POSITIVE_INFINITY)
    : numberOr(source.jumpPressedAgoMs, Number.POSITIVE_INFINITY);
  const jumpBuffered = source.jumpPressed === true || jumpPressedAgoMs <= tuning.jumpBufferMs;
  const jumpHeld = source.jumpHeld !== false && (source.jumpHeld === true || source.jumpPressed === true || jumpBuffered);
  const jumpReleased = source.jumpReleased === true;
  const down = source.down === true || source.downHeld === true || source.axisY > 0.5;
  return {
    moveAxis,
    left: source.left === true,
    right: source.right === true,
    down,
    jumpPressed: source.jumpPressed === true,
    jumpPressedAgoMs,
    jumpBuffered,
    jumpHeld,
    jumpReleased,
    attackPressed: source.attackPressed === true || source.attack === true,
    dashPressed: source.dashPressed === true || source.dash === true,
    dropThroughRequested: source.dropThrough === true || (down && jumpBuffered)
  };
}

function normalizeFloorContext(floor = null) {
  if (!floor) {
    return {
      id: null,
      type: null,
      grounded: false,
      movingPlatform: false,
      velocity: { x: 0, y: 0 },
      slopeAngleDegrees: 0
    };
  }
  const velocity = normalizeVector(floor.velocity || { x: floor.vx, y: floor.vy });
  return {
    id: floor.id || floor.name || null,
    type: normalizeFloorType(floor.type),
    grounded: floor.grounded === true,
    movingPlatform: floor.type === 'moving-platform' || Math.abs(velocity.x) > 0 || Math.abs(velocity.y) > 0,
    velocity,
    slopeAngleDegrees: numberOr(floor.slopeAngleDegrees ?? floor.angle, 0)
  };
}

function buildMovementState({ actor, input, floorContext, tuning, delta }) {
  const grounded = actor.grounded || floorContext.grounded;
  const canUseCoyoteJump = !grounded && actor.lastGroundedAgoMs <= tuning.coyoteTimeMs;
  const canJump = grounded || canUseCoyoteJump;
  const jumpStarted = input.jumpBuffered && canJump;
  const acceleration = selectAcceleration({ actor, input, grounded, tuning });
  const targetX = input.moveAxis * tuning.maxSpeed;
  const velocity = {
    x: moveToward(actor.velocity.x, targetX, acceleration * delta),
    y: actor.velocity.y
  };

  if (jumpStarted) {
    velocity.y = -Math.abs(tuning.jumpVelocity);
  }

  const variableJumpCutApplied = input.jumpReleased && !input.jumpHeld && velocity.y < 0;
  if (variableJumpCutApplied) {
    velocity.y *= tuning.variableJumpCut;
  }

  const facing = resolveFacing(actor, input, velocity);
  return {
    grounded,
    canJump,
    canUseCoyoteJump,
    jumpBuffered: input.jumpBuffered,
    jumpStarted,
    variableJumpCutApplied,
    dropThroughRequested: input.dropThroughRequested,
    targetSpeed: targetX,
    acceleration,
    velocity,
    facing,
    floorId: floorContext.id,
    floorType: floorContext.type,
    platformVelocity: { ...floorContext.velocity },
    slopeAngleDegrees: floorContext.slopeAngleDegrees
  };
}

function buildPhysicsBridge({ actor, input, movement, floorContext, tuning }) {
  const ignoredColliderIds = input.dropThroughRequested && floorContext.type === 'one-way' && floorContext.id
    ? [floorContext.id]
    : [];
  return {
    actor: {
      ...actor,
      velocity: { ...movement.velocity },
      facing: movement.facing,
      groundedAgeMs: actor.grounded ? 0 : actor.lastGroundedAgoMs,
      controls: {
        jumpPressed: movement.jumpStarted,
        jumpHeld: input.jumpHeld,
        dropThrough: input.dropThroughRequested
      },
      abilities: {
        coyoteTimeMs: tuning.coyoteTimeMs,
        jumpBufferMs: tuning.jumpBufferMs,
        jumpVelocity: tuning.jumpVelocity
      }
    },
    ignoredColliderIds,
    floorContext,
    runtimePatch: {
      actorId: actor.id,
      velocity: { ...movement.velocity },
      controls: {
        jumpPressed: movement.jumpStarted,
        dropThrough: input.dropThroughRequested
      }
    }
  };
}

function buildAnimationBridge({ actor, input, movement }) {
  if (input.attackPressed) return animationState('attack', 'attack-input');
  if (actor.health <= 0) return animationState('hurt', 'health-empty');
  if (movement.jumpStarted || movement.velocity.y < -1) return animationState('jump', 'rising');
  if (!movement.grounded && movement.velocity.y >= 1) return animationState('fall', 'falling');
  if (Math.abs(movement.velocity.x) > 1) return animationState('run', 'move-axis');
  return animationState('idle', 'no-input');
}

function buildCameraHints({ actor, input, movement, tuning }) {
  const lookDirection = input.moveAxis !== 0
    ? Math.sign(input.moveAxis)
    : (movement.facing === 'left' ? -1 : 1);
  return {
    followTargetId: actor.id,
    lookAhead: {
      x: lookDirection * tuning.lookAhead,
      y: movement.velocity.y > 120 ? tuning.landingPeek : 0
    },
    focusPoint: {
      x: actor.x + actor.width / 2,
      y: actor.y + actor.height / 2
    },
    deadzoneBias: {
      x: lookDirection,
      y: movement.velocity.y > 120 ? 1 : 0
    }
  };
}

function buildEditorState(tuning) {
  return {
    format: 'omnicore.platformer-2d-controller-editor.v1',
    panels: [
      'ControllerTuning',
      'InputBuffer',
      'CoyoteTime',
      'VariableJump',
      'OneWayDropThrough',
      'AnimationBridge',
      'CameraAssist',
      'RuntimeDebug'
    ],
    tuningControls: [
      { id: 'maxSpeed', type: 'slider', min: 0, max: 400, value: tuning.maxSpeed },
      { id: 'acceleration', type: 'slider', min: 0, max: 2000, value: tuning.acceleration },
      { id: 'airAcceleration', type: 'slider', min: 0, max: 1600, value: tuning.airAcceleration },
      { id: 'jumpVelocity', type: 'slider', min: 0, max: 900, value: tuning.jumpVelocity },
      { id: 'coyoteTimeMs', type: 'number', min: 0, max: 300, value: tuning.coyoteTimeMs },
      { id: 'jumpBufferMs', type: 'number', min: 0, max: 300, value: tuning.jumpBufferMs },
      { id: 'variableJumpCut', type: 'slider', min: 0, max: 1, value: tuning.variableJumpCut },
      { id: 'lookAhead', type: 'slider', min: 0, max: 160, value: tuning.lookAhead }
    ],
    hotReloadTopics: [
      'platformer:controller-tuning-changed',
      'platformer:input-buffer-changed',
      'platformer:animation-bridge-changed',
      'platformer:camera-assist-changed'
    ]
  };
}

function buildRuntimeSyncState() {
  return {
    protocol: 'omnicore.runtime-sync.platformer-2d/v1',
    payloads: [
      'input',
      'movement',
      'physics',
      'animation',
      'camera',
      'editor'
    ],
    events: [
      'platformer:jump-buffered',
      'platformer:coyote-jump',
      'platformer:variable-jump-cut',
      'platformer:drop-through',
      'platformer:animation-state',
      'platformer:camera-assist'
    ]
  };
}

function buildDebugDraw({ actor, input, movement, floorContext, camera, tuning }) {
  const commands = [
    {
      op: 'debug:platformer-input-buffer',
      actorId: actor.id,
      buffered: input.jumpBuffered,
      ageMs: input.jumpPressedAgoMs,
      windowMs: tuning.jumpBufferMs
    },
    {
      op: 'debug:platformer-coyote-window',
      actorId: actor.id,
      active: movement.canUseCoyoteJump,
      ageMs: actor.lastGroundedAgoMs,
      windowMs: tuning.coyoteTimeMs
    },
    {
      op: 'debug:platformer-floor-context',
      actorId: actor.id,
      floorId: floorContext.id,
      floorType: floorContext.type,
      movingPlatform: floorContext.movingPlatform,
      slopeAngleDegrees: floorContext.slopeAngleDegrees
    },
    {
      op: 'debug:platformer-camera-lookahead',
      actorId: actor.id,
      x: camera.focusPoint.x,
      y: camera.focusPoint.y,
      lookAhead: camera.lookAhead
    }
  ];

  if (movement.variableJumpCutApplied) {
    commands.push({
      op: 'debug:platformer-variable-jump-cut',
      actorId: actor.id,
      velocityY: movement.velocity.y
    });
  }
  return commands;
}

function buildQualityChecks({ input, movement, physics, animation }) {
  return {
    checks: [
      {
        id: 'platformer-input-buffer',
        pass: input.jumpBuffered,
        detail: `${input.jumpPressedAgoMs}ms / buffer ${input.jumpBuffered}`
      },
      {
        id: 'platformer-coyote-time',
        pass: movement.canUseCoyoteJump || movement.grounded,
        detail: movement.canUseCoyoteJump ? 'coyote jump available' : `grounded=${movement.grounded}`
      },
      {
        id: 'platformer-variable-jump',
        pass: movement.variableJumpCutApplied || !input.jumpReleased,
        detail: movement.variableJumpCutApplied ? 'cut applied' : 'not requested'
      },
      {
        id: 'platformer-physics-bridge',
        pass: Boolean(physics.actor?.id && physics.actor?.velocity && physics.actor?.controls),
        detail: physics.actor?.id || 'missing actor'
      },
      {
        id: 'platformer-animation-bridge',
        pass: Boolean(animation.state),
        detail: `${animation.state}:${animation.reason}`
      }
    ]
  };
}

function selectAcceleration({ actor, input, grounded, tuning }) {
  if (!grounded) return tuning.airAcceleration;
  if (Math.abs(input.moveAxis) < 0.01 && Math.abs(actor.velocity.x) > 0.01) return tuning.deceleration;
  return tuning.acceleration;
}

function resolveFacing(actor, input, velocity) {
  if (input.moveAxis < 0) return 'left';
  if (input.moveAxis > 0) return 'right';
  if (velocity.x < -0.01) return 'left';
  if (velocity.x > 0.01) return 'right';
  return actor.facing;
}

function animationState(state, reason) {
  return {
    state,
    reason,
    context: {
      [state]: true,
      reason
    }
  };
}

function axisFromButtons(input) {
  const right = input.right === true || input.rightHeld === true ? 1 : 0;
  const left = input.left === true || input.leftHeld === true ? 1 : 0;
  return right - left;
}

function normalizeFloorType(type) {
  if (type === 'oneway' || type === 'oneWay' || type === 'one-way-platform') return 'one-way';
  if (type === 'movingPlatform' || type === 'platform') return 'moving-platform';
  return type || null;
}

function moveToward(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

function normalizeVector(vector = {}) {
  return {
    x: numberOr(vector.x, 0),
    y: numberOr(vector.y, 0)
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function numberOr(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export default createPlatformer2DControllerStep;
