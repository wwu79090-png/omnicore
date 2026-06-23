import { createPhysicsWorld } from '@omnicore/physics';

const canvas = document.querySelector('#debug');
const ctx = canvas.getContext('2d');
const metrics = document.querySelector('#metrics');
const snapshotView = document.querySelector('#snapshot');

const world = createPhysicsWorld({
  backend: 'arcade',
  gravity: { x: 0, y: 0 }
});

world.addBody({
  id: 'hero',
  type: 'dynamic',
  x: 40,
  y: 120,
  width: 36,
  height: 36,
  velocity: { x: 80, y: 0 },
  collider: { shape: 'box', width: 36, height: 36 }
});

world.addBody({
  id: 'crate',
  type: 'static',
  x: 260,
  y: 120,
  width: 56,
  height: 56,
  collider: { shape: 'box', width: 56, height: 56 }
});

world.addSensor({
  id: 'finish-sensor',
  x: 360,
  y: 100,
  width: 70,
  height: 96
});

world.addConstraint({
  id: 'hero-rope',
  type: 'distance',
  bodyA: 'hero',
  bodyB: 'crate',
  limits: { min: 24, max: 260 }
});

const raycastProbe = {
  id: 'forward-probe',
  origin: { x: 16, y: 138 },
  direction: { x: 1, y: 0 },
  maxDistance: 520
};

function resize() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(canvas.clientWidth * ratio);
  canvas.height = Math.floor(canvas.clientHeight * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawRect(collider) {
  ctx.strokeStyle = collider.sensor ? '#22c55e' : '#60a5fa';
  ctx.fillStyle = collider.sensor ? 'rgba(34, 197, 94, 0.12)' : 'rgba(96, 165, 250, 0.1)';
  ctx.lineWidth = 2;
  ctx.fillRect(collider.x, collider.y, collider.width, collider.height);
  ctx.strokeRect(collider.x, collider.y, collider.width, collider.height);
  ctx.fillStyle = '#e6edf3';
  ctx.fillText(collider.id, collider.x + 4, collider.y - 6);
}

function drawConstraint(constraint, colliders) {
  const a = colliders.find((collider) => collider.id === constraint.bodyA);
  const b = colliders.find((collider) => collider.id === constraint.bodyB);
  if (!a || !b) return;
  ctx.strokeStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(a.x + a.width / 2, a.y + a.height / 2);
  ctx.lineTo(b.x + b.width / 2, b.y + b.height / 2);
  ctx.stroke();
}

function drawRaycast(raycast) {
  const endX = raycast.hit?.point?.x || raycast.origin.x + raycast.direction.x * raycast.maxDistance;
  const endY = raycast.hit?.point?.y || raycast.origin.y + raycast.direction.y * raycast.maxDistance;
  ctx.strokeStyle = raycast.hit ? '#ef4444' : '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(raycast.origin.x, raycast.origin.y);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  if (!raycast.hit) return;
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(raycast.hit.point.x, raycast.hit.point.y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function renderMetrics(summary) {
  metrics.innerHTML = '';
  for (const [label, value] of [
    ['Bodies', summary.bodyCount],
    ['Contacts', summary.contactCount],
    ['Sensor events', summary.sensorEventCount],
    ['Raycast hits', summary.raycastHitCount],
    ['Debug colliders', summary.debugColliderCount]
  ]) {
    const row = document.createElement('div');
    row.className = 'metric';
    row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    metrics.appendChild(row);
  }
}

function frame() {
  resize();
  world.step(1 / 60);
  const snapshot = world.createDiagnosticsSnapshot({ raycasts: [raycastProbe] });
  const debugDraw = world.debugDraw();

  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.font = '13px Inter, Microsoft YaHei, sans-serif';
  for (const constraint of debugDraw.constraints) drawConstraint(constraint, debugDraw.colliders);
  for (const collider of debugDraw.colliders) drawRect(collider);
  for (const raycast of snapshot.raycasts) drawRaycast(raycast);

  renderMetrics(snapshot.summary);
  snapshotView.textContent = JSON.stringify(snapshot, null, 2);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
frame();
