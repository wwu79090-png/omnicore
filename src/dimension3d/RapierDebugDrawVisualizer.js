export function createRapierDebugDrawVisualization(input = {}, options = {}) {
  const overlays = [
    ...createDebugLines(input.buffers || input.debugDraw?.buffers),
    ...createColliderOverlays(input.colliders || input.debugDraw?.colliders),
    ...createJointOverlays(input.constraints || input.joints || input.debugDraw?.constraints),
    ...createRaycastOverlays(input.raycasts || input.debugDraw?.raycasts)
  ];
  const threeObjects = options.THREE ? createThreeObjects(overlays, options.THREE) : [];

  return {
    schema: 'omnicore.rapier-debug-draw-visualization.v1',
    summary: {
      lineCount: overlays.filter((overlay) => overlay.kind === 'debug-line').length,
      colliderOverlayCount: overlays.filter((overlay) => overlay.kind === 'collider-box' || overlay.kind === 'sensor-volume').length,
      sensorOverlayCount: overlays.filter((overlay) => overlay.kind === 'sensor-volume').length,
      jointOverlayCount: overlays.filter((overlay) => overlay.kind === 'joint-link').length,
      raycastOverlayCount: overlays.filter((overlay) => overlay.kind === 'raycast-hit' || overlay.kind === 'raycast-miss').length,
      threeObjectCount: threeObjects.length
    },
    overlays,
    threeObjects
  };
}

function createDebugLines(buffers = {}) {
  const vertices = Array.from(buffers.vertices || []);
  const colors = Array.from(buffers.colors || []);
  const overlays = [];
  for (let index = 0; index + 5 < vertices.length; index += 6) {
    const lineIndex = index / 6;
    overlays.push({
      id: `debug-line-${lineIndex + 1}`,
      kind: 'debug-line',
      from: vectorFromArray(vertices, index),
      to: vectorFromArray(vertices, index + 3),
      color: colorFromArray(colors, lineIndex * 8) || '#ff3355'
    });
  }
  return overlays;
}

function createColliderOverlays(colliders = []) {
  return arrayFromValue(colliders).map((collider, index) => {
    const sensor = Boolean(collider.sensor || collider.isSensor);
    return {
      id: String(collider.id || `collider-${index + 1}`),
      kind: sensor ? 'sensor-volume' : 'collider-box',
      shape: String(collider.shape || collider.type || 'box'),
      sensor,
      modelId: collider.modelId || null,
      position: normalizeVector3(collider.position || collider.translation),
      rotation: normalizeVector3(collider.rotation),
      size: normalizeSize(collider.size || collider.halfExtents || collider),
      color: sensor ? '#33d17a' : '#4f8cff'
    };
  });
}

function createJointOverlays(joints = []) {
  return arrayFromValue(joints).map((joint, index) => ({
    id: String(joint.id || `joint-${index + 1}`),
    kind: 'joint-link',
    jointType: String(joint.type || joint.jointType || 'fixed'),
    bodyA: joint.bodyA || joint.body1 || null,
    bodyB: joint.bodyB || joint.body2 || null,
    anchorA: normalizeVector3(joint.anchorA),
    anchorB: normalizeVector3(joint.anchorB),
    color: '#ffcc33'
  }));
}

function createRaycastOverlays(raycasts = []) {
  return arrayFromValue(raycasts).map((raycast, index) => ({
    id: String(raycast.id || `raycast-${index + 1}`),
    kind: raycast.hit === false ? 'raycast-miss' : 'raycast-hit',
    hit: raycast.hit !== false,
    bodyId: raycast.bodyId || raycast.colliderId || null,
    from: normalizeVector3(raycast.origin || raycast.from),
    to: normalizeVector3(raycast.point || raycast.to),
    normal: raycast.normal ? normalizeVector3(raycast.normal) : null,
    color: raycast.hit === false ? '#999999' : '#ff6633'
  }));
}

function createThreeObjects(overlays, THREE) {
  if (!THREE.Object3D) return [];
  return overlays.map((overlay) => {
    const object = new THREE.Object3D();
    object.name = overlay.id;
    object.userData = { ...overlay };
    return object;
  });
}

function vectorFromArray(values, offset) {
  return {
    x: Number(values[offset] || 0),
    y: Number(values[offset + 1] || 0),
    z: Number(values[offset + 2] || 0)
  };
}

function colorFromArray(values, offset) {
  if (offset + 2 >= values.length) return null;
  const r = toHex(values[offset]);
  const g = toHex(values[offset + 1]);
  const b = toHex(values[offset + 2]);
  return `#${r}${g}${b}`;
}

function toHex(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value || 0) * 255)))
    .toString(16)
    .padStart(2, '0');
}

function normalizeSize(value = {}) {
  return {
    x: positiveNumber(value.x ?? value.width, 1),
    y: positiveNumber(value.y ?? value.height, 1),
    z: positiveNumber(value.z ?? value.depth, 1)
  };
}

function normalizeVector3(value = {}) {
  return {
    x: Number(value?.x || 0),
    y: Number(value?.y || 0),
    z: Number(value?.z || 0)
  };
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function arrayFromValue(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default createRapierDebugDrawVisualization;
