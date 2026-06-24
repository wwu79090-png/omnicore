export const ARCADE_2D_GAMEPLAY_SCHEMA = 'omnicore.arcade-2d-gameplay-plan.v1';

/**
 * Creates an editor-ready Arcade 2D gameplay step for platformers and 2.5D scenes.
 */
export function createArcade2DGameplayPlan(config = {}) {
  const delta = Math.max(0, numberOr(config.delta, 1 / 60));
  const gravity = normalizeVector(config.gravity);
  const actors = normalizeActors(config.actors || config.actor || []);
  const colliders = normalizeColliders(config.colliders || []);
  const sensors = normalizeSensors(config.sensors || []);
  const contacts = [];
  const actorEntries = actors.map((actor) => {
    const resolved = resolveActor(actor, colliders, { delta, gravity, contacts });
    return [actor.id, attachSensorEvents(resolved, sensors)];
  });
  const actorState = Object.fromEntries(actorEntries);
  const sensorEvents = Object.values(actorState).flatMap((actor) => actor.sensorEvents);
  const editor = buildEditorState(config.editor, { colliders, sensors });
  const debugDraw = buildDebugDraw(actorState, colliders, sensors, contacts, editor.debugDraw);
  const quality = buildQualityChecks({ colliders, contacts, sensorEvents, editor });

  return {
    schema: ARCADE_2D_GAMEPLAY_SCHEMA,
    delta,
    gravity,
    actors: actorState,
    colliders,
    sensors,
    contacts,
    sensorEvents,
    debugDraw,
    editor,
    quality
  };
}

function normalizeActors(input) {
  const source = Array.isArray(input) ? input : [input];
  const seen = new Set();
  return source.filter(Boolean).map((actor, index) => {
    const baseId = actor.id || actor.name || `actor-${index}`;
    const id = seen.has(baseId) ? `${baseId}-${index}` : baseId;
    seen.add(id);
    const width = numberOr(actor.width ?? actor.w, 0);
    const height = numberOr(actor.height ?? actor.h, 0);
    const x = numberOr(actor.x, 0);
    const y = numberOr(actor.y, 0);
    const previous = {
      x: numberOr(actor.previous?.x, x),
      y: numberOr(actor.previous?.y, y)
    };
    return {
      ...actor,
      id,
      x,
      y,
      previous,
      width,
      height,
      velocity: normalizeVector(actor.velocity || { x: actor.vx, y: actor.vy }),
      controls: actor.controls || {},
      abilities: actor.abilities || {}
    };
  });
}

function normalizeColliders(input) {
  return (Array.isArray(input) ? input : [input]).filter(Boolean).map((collider, index) => {
    const type = normalizeColliderType(collider.type || (collider.oneWay ? 'one-way' : 'solid'));
    return {
      ...collider,
      id: collider.id || collider.name || `collider-${index}`,
      type,
      x: numberOr(collider.x, 0),
      y: numberOr(collider.y, 0),
      width: numberOr(collider.width ?? collider.w, 0),
      height: numberOr(collider.height ?? collider.h, 0),
      velocity: normalizeVector(collider.velocity || { x: collider.vx, y: collider.vy }),
      slope: collider.slope || null,
      oneWay: collider.oneWay === true || type === 'one-way'
    };
  });
}

function normalizeSensors(input) {
  return (Array.isArray(input) ? input : [input]).filter(Boolean).map((sensor, index) => ({
    ...sensor,
    id: sensor.id || sensor.name || `sensor-${index}`,
    channel: sensor.channel || 'default',
    x: numberOr(sensor.x, 0),
    y: numberOr(sensor.y, 0),
    width: numberOr(sensor.width ?? sensor.w, 0),
    height: numberOr(sensor.height ?? sensor.h, 0)
  }));
}

function resolveActor(actor, colliders, context) {
  const velocity = {
    x: actor.velocity.x + context.gravity.x * context.delta,
    y: actor.velocity.y + context.gravity.y * context.delta
  };
  const state = {
    id: actor.id,
    previous: actor.previous,
    start: rectOf(actor),
    next: {
      x: actor.x,
      y: actor.y,
      width: actor.width,
      height: actor.height,
      grounded: false,
      floorId: null
    },
    velocity,
    movement: {
      floorType: null,
      floorId: null,
      grounded: false,
      canJump: false,
      jumpBuffered: Boolean(actor.controls?.jumpPressed),
      platformVelocity: { x: 0, y: 0 },
      slopeAngleDegrees: 0,
      queuedJumpVelocity: null
    },
    contacts: [],
    sensorEvents: []
  };

  for (const collider of colliders) {
    const contact = resolveCollider(state, actor, collider, context.delta);
    if (!contact) continue;
    state.contacts.push(contact);
    context.contacts.push(contact);
  }

  const canJump = state.next.grounded || numberOr(actor.groundedAgeMs, Number.POSITIVE_INFINITY) <= numberOr(actor.abilities.coyoteTimeMs, 0);
  state.movement.grounded = state.next.grounded;
  state.movement.canJump = canJump;
  state.movement.queuedJumpVelocity = state.movement.jumpBuffered && canJump
    ? -Math.abs(numberOr(actor.abilities.jumpVelocity, 0))
    : null;
  return state;
}

function resolveCollider(state, actor, collider, delta) {
  if (collider.type === 'slope') return resolveSlope(state, collider);
  if (collider.type === 'one-way') return resolveOneWay(state, actor, collider);
  if (collider.type === 'moving-platform') return resolveMovingPlatform(state, actor, collider, delta);
  return resolveSolid(state, collider);
}

function resolveOneWay(state, actor, collider) {
  const actorRect = state.next;
  if (!horizontalOverlap(actorRect, collider)) return null;
  const previousBottom = actor.previous.y + actor.height;
  const currentBottom = actorRect.y + actorRect.height;
  const platformTop = collider.y;
  const fallingOntoPlatform = currentBottom >= platformTop && previousBottom <= platformTop + numberOr(collider.snap, 3);
  if (!fallingOntoPlatform || actor.controls?.dropThrough) return null;
  actorRect.y = platformTop - actorRect.height;
  return markGrounded(state, collider, 'one-way', {
    normal: { x: 0, y: -1 },
    platformTop
  });
}

function resolveMovingPlatform(state, actor, collider, delta) {
  const contact = resolveOneWay(state, actor, { ...collider, type: 'one-way' });
  if (!contact) return null;
  state.next.x += collider.velocity.x * delta;
  state.next.y += collider.velocity.y * delta;
  state.movement.platformVelocity = { ...collider.velocity };
  return {
    ...contact,
    kind: 'moving-platform',
    platformVelocity: { ...collider.velocity }
  };
}

function resolveSlope(state, collider) {
  const actorRect = state.next;
  const centerX = actorRect.x + actorRect.width / 2;
  if (centerX < collider.x || centerX > collider.x + collider.width) return null;
  const surfaceY = slopeSurfaceY(collider, centerX);
  const bottom = actorRect.y + actorRect.height;
  const actorTop = actorRect.y;
  if (bottom < surfaceY || actorTop > surfaceY) return null;
  actorRect.y = surfaceY - actorRect.height;
  const angle = slopeAngleDegrees(collider);
  return markGrounded(state, collider, 'slope', {
    surfaceY,
    slopeAngleDegrees: angle,
    normal: slopeNormal(collider)
  });
}

function resolveSolid(state, collider) {
  const actorRect = state.next;
  if (!intersects(actorRect, collider)) return null;
  const actorBottom = actorRect.y + actorRect.height;
  const actorRight = actorRect.x + actorRect.width;
  const overlapLeft = actorRight - collider.x;
  const overlapRight = collider.x + collider.width - actorRect.x;
  const overlapTop = actorBottom - collider.y;
  const overlapBottom = collider.y + collider.height - actorRect.y;
  const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
  if (minOverlap === overlapTop) {
    actorRect.y = collider.y - actorRect.height;
    return markGrounded(state, collider, 'solid', { normal: { x: 0, y: -1 } });
  }
  if (minOverlap === overlapBottom) {
    actorRect.y = collider.y + collider.height;
    return makeContact(state.id, collider, 'ceiling', { normal: { x: 0, y: 1 } });
  }
  if (minOverlap === overlapLeft) {
    actorRect.x = collider.x - actorRect.width;
    return makeContact(state.id, collider, 'wall', { normal: { x: -1, y: 0 } });
  }
  actorRect.x = collider.x + collider.width;
  return makeContact(state.id, collider, 'wall', { normal: { x: 1, y: 0 } });
}

function markGrounded(state, collider, kind, extra = {}) {
  state.next.grounded = true;
  state.next.floorId = collider.id;
  state.movement.floorType = kind;
  state.movement.floorId = collider.id;
  if (extra.slopeAngleDegrees !== undefined) state.movement.slopeAngleDegrees = extra.slopeAngleDegrees;
  return makeContact(state.id, collider, kind, extra);
}

function makeContact(actorId, collider, kind, extra = {}) {
  return {
    actorId,
    colliderId: collider.id,
    kind,
    colliderType: collider.type,
    ...extra
  };
}

function attachSensorEvents(actorState, sensors) {
  const actorRect = actorState.next;
  actorState.sensorEvents = sensors
    .filter((sensor) => intersects(actorRect, sensor))
    .map((sensor) => ({
      actorId: actorState.id,
      sensorId: sensor.id,
      channel: sensor.channel,
      kind: 'sensor-overlap'
    }));
  return actorState;
}

function buildEditorState(editorInput, { colliders, sensors }) {
  const editor = editorInput || {};
  return {
    format: 'omnicore.arcade-2d-editor.v1',
    inspectorSections: editor.inspector === false ? [] : [
      'Arcade2D',
      'OneWayPlatforms',
      'SlopeColliders',
      'MovingPlatforms',
      'Sensors',
      'DebugDraw',
      'Export'
    ],
    debugDraw: editor.debugDraw !== false,
    exportPlan: {
      targets: Array.isArray(editor.exportTargets) && editor.exportTargets.length > 0 ? [...editor.exportTargets] : ['web'],
      steps: [
        'serialize-arcade-actors',
        'bake-one-way-platforms',
        'bake-slope-colliders',
        'write-sensor-channels',
        'emit-debug-draw-layer'
      ]
    },
    colliderSummary: {
      oneWay: colliders.filter((collider) => collider.type === 'one-way').length,
      slopes: colliders.filter((collider) => collider.type === 'slope').length,
      movingPlatforms: colliders.filter((collider) => collider.type === 'moving-platform').length,
      sensors: sensors.length
    }
  };
}

function buildDebugDraw(actorState, colliders, sensors, contacts, enabled) {
  if (!enabled) return [];
  return [
    ...Object.values(actorState).map((actor) => ({
      op: 'debug:arcade-actor',
      id: actor.id,
      x: actor.next.x,
      y: actor.next.y,
      width: actor.next.width,
      height: actor.next.height,
      grounded: actor.next.grounded,
      floorId: actor.next.floorId
    })),
    ...colliders.map((collider) => ({
      op: colliderDebugOp(collider.type),
      id: collider.id,
      x: collider.x,
      y: collider.y,
      width: collider.width,
      height: collider.height,
      velocity: collider.velocity
    })),
    ...sensors.map((sensor) => ({
      op: 'debug:arcade-sensor',
      id: sensor.id,
      channel: sensor.channel,
      x: sensor.x,
      y: sensor.y,
      width: sensor.width,
      height: sensor.height
    })),
    ...contacts.map((contact) => ({
      op: 'debug:arcade-contact',
      actorId: contact.actorId,
      colliderId: contact.colliderId,
      kind: contact.kind
    }))
  ];
}

function buildQualityChecks({ colliders, contacts, sensorEvents, editor }) {
  const hasContactKind = (kind) => contacts.some((contact) => contact.kind === kind);
  return {
    checks: [
      {
        id: 'arcade-one-way-platforms',
        pass: colliders.some((collider) => collider.type === 'one-way') && hasContactKind('one-way'),
        detail: `${colliders.filter((collider) => collider.type === 'one-way').length} one-way colliders`
      },
      {
        id: 'arcade-slope-colliders',
        pass: colliders.some((collider) => collider.type === 'slope') && hasContactKind('slope'),
        detail: `${colliders.filter((collider) => collider.type === 'slope').length} slope colliders`
      },
      {
        id: 'arcade-moving-platforms',
        pass: colliders.some((collider) => collider.type === 'moving-platform') && hasContactKind('moving-platform'),
        detail: `${colliders.filter((collider) => collider.type === 'moving-platform').length} moving platforms`
      },
      {
        id: 'arcade-sensor-events',
        pass: sensorEvents.length > 0,
        detail: `${sensorEvents.length} sensor events`
      },
      {
        id: 'arcade-editor-debug-draw',
        pass: editor.debugDraw && editor.inspectorSections.length > 0,
        detail: editor.inspectorSections.join(',')
      }
    ]
  };
}

function slopeSurfaceY(collider, centerX) {
  const progress = (centerX - collider.x) / Math.max(1, collider.width);
  const direction = collider.slope?.direction || collider.slope?.from || 'ascending';
  if (direction === 'descending' || direction === 'top-left') {
    return collider.y + progress * collider.height;
  }
  return collider.y + collider.height - progress * collider.height;
}

function slopeAngleDegrees(collider) {
  const direction = collider.slope?.direction || collider.slope?.from || 'ascending';
  const radians = Math.atan2(collider.height, Math.max(1, collider.width));
  const degrees = (radians * 180) / Math.PI;
  return direction === 'descending' || direction === 'top-left' ? degrees : -degrees;
}

function slopeNormal(collider) {
  const direction = collider.slope?.direction || collider.slope?.from || 'ascending';
  return direction === 'descending' || direction === 'top-left'
    ? { x: -0.7071, y: -0.7071 }
    : { x: 0.7071, y: -0.7071 };
}

function colliderDebugOp(type) {
  if (type === 'one-way') return 'debug:arcade-one-way';
  if (type === 'slope') return 'debug:arcade-slope';
  if (type === 'moving-platform') return 'debug:arcade-moving-platform';
  return 'debug:arcade-solid';
}

function normalizeColliderType(type) {
  if (type === 'oneway' || type === 'oneWay' || type === 'one-way-platform') return 'one-way';
  if (type === 'movingPlatform' || type === 'platform') return 'moving-platform';
  return type || 'solid';
}

function rectOf(value = {}) {
  return {
    x: numberOr(value.x, 0),
    y: numberOr(value.y, 0),
    width: numberOr(value.width ?? value.w, 0),
    height: numberOr(value.height ?? value.h, 0)
  };
}

function horizontalOverlap(left, right) {
  return left.x < right.x + right.width && left.x + left.width > right.x;
}

function intersects(left, right) {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

function normalizeVector(vector = {}) {
  return {
    x: numberOr(vector.x, 0),
    y: numberOr(vector.y, 0)
  };
}

function numberOr(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export default createArcade2DGameplayPlan;
