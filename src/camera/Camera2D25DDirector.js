export const CAMERA_2D_25D_DIRECTOR_SCHEMA = 'omnicore.camera-2d-25d-director.v1';

/**
 * Builds one production camera director step for 2D/2.5D games.
 */
export function createCamera2D25DDirectorStep(config = {}) {
  const delta = Math.max(0, numberOr(config.delta, 1 / 60));
  const camera = normalizeCamera(config.camera || {});
  const target = normalizeTarget(config.target || {});
  const deadzone = normalizeRect(config.deadzone, {
    x: camera.viewport.width * 0.35,
    y: camera.viewport.height * 0.3,
    width: camera.viewport.width * 0.3,
    height: camera.viewport.height * 0.3
  });
  const smoothing = normalizeSmoothing(config.smoothing || {});
  const assistedTarget = buildAssistedTarget(target, smoothing);
  const rooms = normalizeRooms(config.rooms || [], camera);
  const room = resolveRoom(rooms, assistedTarget);
  const view = buildView({ camera, assistedTarget, room, deadzone, smoothing });
  const shake = buildShakeState(config.shake || {}, delta);
  const parallax = buildParallaxState(config.parallax || [], view);
  const editor = buildEditorState();
  const runtimeSync = buildRuntimeSyncState();
  const debugDraw = buildDebugDraw({ view, target, assistedTarget, room, deadzone, shake, parallax });
  const quality = buildQualityChecks({ view, target, room, deadzone, shake, parallax, editor, runtimeSync });

  return {
    schema: CAMERA_2D_25D_DIRECTOR_SCHEMA,
    delta,
    camera,
    target: {
      id: target.id,
      center: target.center,
      assistedCenter: assistedTarget.center,
      velocity: target.velocity
    },
    room,
    view,
    deadzone: {
      local: deadzone,
      world: {
        x: round(view.x + deadzone.x),
        y: round(view.y + deadzone.y),
        width: round(deadzone.width),
        height: round(deadzone.height)
      }
    },
    shake,
    parallax,
    editor,
    runtimeSync,
    debugDraw,
    quality
  };
}

function normalizeCamera(camera = {}) {
  const viewport = normalizeRect(camera.viewport, { x: 0, y: 0, width: 320, height: 180 });
  return {
    x: numberOr(camera.x, 0),
    y: numberOr(camera.y, 0),
    viewport: {
      width: Math.max(1, viewport.width),
      height: Math.max(1, viewport.height)
    },
    zoom: Math.max(0.01, numberOr(camera.zoom ?? camera.zoomLevel, 1)),
    pixelSnap: camera.pixelSnap === true,
    bounds: camera.bounds ? normalizeRect(camera.bounds) : null
  };
}

function normalizeTarget(target = {}) {
  const width = numberOr(target.width ?? target.w, 0);
  const height = numberOr(target.height ?? target.h, 0);
  const x = numberOr(target.x, 0);
  const y = numberOr(target.y, 0);
  return {
    id: target.id || target.name || 'target',
    x,
    y,
    width,
    height,
    center: {
      x: round(x + width / 2),
      y: round(y + height / 2)
    },
    velocity: normalizeVector(target.velocity || { x: target.vx, y: target.vy }),
    lookAhead: normalizeVector(target.lookAhead || {})
  };
}

function normalizeSmoothing(smoothing = {}) {
  return {
    follow: clamp(numberOr(smoothing.follow, 1), 0, 1),
    lookAhead: clamp(numberOr(smoothing.lookAhead, 1), 0, 1)
  };
}

function buildAssistedTarget(target, smoothing) {
  return {
    ...target,
    center: {
      x: target.center.x + target.lookAhead.x * smoothing.lookAhead,
      y: target.center.y + target.lookAhead.y * smoothing.lookAhead
    }
  };
}

function normalizeRooms(roomsInput, camera) {
  const source = Array.isArray(roomsInput) ? roomsInput : [roomsInput];
  const rooms = source.filter(Boolean).map((room, index) => ({
    id: room.id || room.name || `room-${index}`,
    ...normalizeRect(room),
    transition: room.transition || null
  }));
  if (rooms.length > 0) return rooms;
  const bounds = camera.bounds || {
    x: camera.x,
    y: camera.y,
    width: camera.viewport.width,
    height: camera.viewport.height
  };
  return [{ id: 'world', ...bounds, transition: null }];
}

function resolveRoom(rooms, target) {
  const active = rooms.find((room) => containsPoint(room, target.center)) || rooms[0];
  return {
    activeRoomId: active.id,
    bounds: {
      x: active.x,
      y: active.y,
      width: active.width,
      height: active.height
    },
    transition: active.transition || null
  };
}

function buildView({ camera, assistedTarget, room, deadzone, smoothing }) {
  const viewport = {
    width: camera.viewport.width / camera.zoom,
    height: camera.viewport.height / camera.zoom
  };
  const verticalActionBias = assistedTarget.velocity.y < 0 ? deadzone.height / 2 : 0;
  const desired = {
    x: assistedTarget.center.x - viewport.width / 2,
    y: assistedTarget.center.y - viewport.height / 2 - verticalActionBias
  };
  const next = {
    x: room.transition ? desired.x : lerp(camera.x, desired.x, smoothing.follow),
    y: room.transition ? desired.y : lerp(camera.y, desired.y, smoothing.follow)
  };
  const { bounds } = room;
  const clamped = clampView({ ...next, ...viewport }, bounds);
  return {
    x: camera.pixelSnap ? Math.round(clamped.x) : round(clamped.x),
    y: camera.pixelSnap ? Math.round(clamped.y) : round(clamped.y),
    width: round(viewport.width),
    height: round(viewport.height),
    zoom: camera.zoom,
    pixelSnap: camera.pixelSnap
  };
}

function buildShakeState(shake, delta) {
  const source = shake || {};
  const trauma = clamp(numberOr(source.trauma, 0), 0, 1);
  const decay = Math.max(0, numberOr(source.decay, 0));
  const maxOffset = numberOr(source.maxOffset, 0);
  const seed = Math.trunc(numberOr(source.seed, 1));
  const power = trauma * trauma;
  const xNoise = seededNoise(seed);
  const yNoise = seededNoise(seed + 101);
  return {
    active: trauma > 0 && maxOffset > 0,
    trauma,
    nextTrauma: round(clamp(trauma - decay, 0, 1)),
    decay,
    maxOffset,
    offset: {
      x: round(xNoise * maxOffset * power),
      y: round(yNoise * maxOffset * power)
    },
    durationHintMs: round((trauma / Math.max(decay, delta * 0.001 || 0.001)) * 16.67)
  };
}

function buildParallaxState(parallaxInput, view) {
  const layers = (Array.isArray(parallaxInput) ? parallaxInput : Object.entries(parallaxInput || {}).map(([id, value]) => ({
    id,
    ...(typeof value === 'number' ? { factorX: value, factorY: value } : value)
  }))).filter(Boolean).map((layer, index) => {
    const factorX = numberOr(layer.factorX ?? layer.factor, 1);
    const factorY = numberOr(layer.factorY ?? layer.factor, factorX);
    return {
      id: layer.id || layer.name || `parallax-${index}`,
      factorX,
      factorY,
      x: round(numberOr(layer.offsetX, 0) - view.x * factorX),
      y: round(numberOr(layer.offsetY, 0) - view.y * factorY)
    };
  });
  return {
    layers,
    drawOrder: layers.map((layer) => layer.id)
  };
}

function buildEditorState() {
  return {
    format: 'omnicore.camera-2d25d-editor.v1',
    panels: [
      'CameraDirector',
      'Deadzone',
      'LookAhead',
      'RoomBounds',
      'ShakeTrauma',
      'ParallaxLayers',
      'PixelSnap',
      'RuntimeDebug'
    ],
    tools: [
      'DeadzonePainter',
      'RoomBoundsEditor',
      'LookAheadHandle',
      'ShakePreview',
      'ParallaxLayerInspector',
      'PixelSnapToggle'
    ],
    hotReloadTopics: [
      'camera:director-changed',
      'camera:deadzone-changed',
      'camera:room-bounds-changed',
      'camera:shake-preview',
      'camera:parallax-changed'
    ]
  };
}

function buildRuntimeSyncState() {
  return {
    protocol: 'omnicore.runtime-sync.camera-2d25d/v1',
    payloads: [
      'camera',
      'target',
      'room',
      'deadzone',
      'shake',
      'parallax',
      'editor'
    ],
    events: [
      'camera:follow-step',
      'camera:room-transition',
      'camera:shake-trauma',
      'camera:parallax-transform',
      'camera:debug-draw'
    ]
  };
}

function buildDebugDraw({ view, target, assistedTarget, room, deadzone, shake, parallax }) {
  return [
    { op: 'debug:camera-view', ...view },
    { op: 'debug:camera-deadzone', x: view.x + deadzone.x, y: view.y + deadzone.y, width: deadzone.width, height: deadzone.height },
    { op: 'debug:camera-room', id: room.activeRoomId, ...room.bounds },
    {
      op: 'debug:camera-lookahead',
      targetId: target.id,
      from: target.center,
      to: assistedTarget.center
    },
    { op: 'debug:camera-shake', active: shake.active, offset: shake.offset, trauma: shake.trauma },
    ...parallax.layers.map((layer) => ({ op: 'debug:camera-parallax-layer', ...layer }))
  ];
}

function buildQualityChecks({ view, target, room, deadzone, shake, parallax, editor, runtimeSync }) {
  return {
    checks: [
      {
        id: 'camera-room-bounds',
        pass: view.x >= room.bounds.x && view.y >= room.bounds.y
          && view.x + view.width <= room.bounds.x + room.bounds.width
          && view.y + view.height <= room.bounds.y + room.bounds.height,
        detail: room.activeRoomId
      },
      {
        id: 'camera-deadzone-follow',
        pass: deadzone.width > 0 && deadzone.height > 0 && Boolean(target.id),
        detail: target.id
      },
      {
        id: 'camera-shake-trauma',
        pass: !shake.active || Math.abs(shake.offset.x) + Math.abs(shake.offset.y) > 0,
        detail: `${shake.trauma}->${shake.nextTrauma}`
      },
      {
        id: 'camera-parallax-layers',
        pass: parallax.layers.length > 0,
        detail: `${parallax.layers.length} layers`
      },
      {
        id: 'camera-editor-runtime-sync',
        pass: editor.panels.length > 0 && runtimeSync.payloads.includes('camera'),
        detail: runtimeSync.protocol
      }
    ]
  };
}

function clampView(view, bounds) {
  const minX = bounds.x;
  const minY = bounds.y;
  const maxX = bounds.x + Math.max(0, bounds.width - view.width);
  const maxY = bounds.y + Math.max(0, bounds.height - view.height);
  return {
    ...view,
    x: clamp(view.x, minX, maxX),
    y: clamp(view.y, minY, maxY)
  };
}

function containsPoint(rect, point) {
  return point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height;
}

function normalizeRect(value = {}, fallback = {}) {
  return {
    x: numberOr(value?.x, fallback.x || 0),
    y: numberOr(value?.y, fallback.y || 0),
    width: numberOr(value?.width ?? value?.w, fallback.width || 0),
    height: numberOr(value?.height ?? value?.h, fallback.height || 0)
  };
}

function normalizeVector(vector = {}) {
  return {
    x: numberOr(vector.x, 0),
    y: numberOr(vector.y, 0)
  };
}

function seededNoise(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function numberOr(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function round(value) {
  return Math.round(numberOr(value, 0) * 1000) / 1000;
}

export default createCamera2D25DDirectorStep;
