import OmniCore, {
  createArcade2DGameplayPlan,
  createScene2D25DPipeline,
  createTilemap2D25DAuthoringLoop
} from 'omnicore-runtime';

const canvas = document.querySelector('#stage');
const context = canvas.getContext('2d');
const keys = new Set();
const tileSize = 32;
const hero = {
  id: 'hero',
  type: 'player',
  x: 72,
  y: 178,
  width: 22,
  height: 30,
  previous: { x: 72, y: 178 },
  velocity: { x: 0, y: 0 },
  grounded: false
};

const authoring = createTilemap2D25DAuthoringLoop({
  tilemap: {
    width: 20,
    height: 12,
    tileWidth: tileSize,
    tileHeight: tileSize,
    layers: [
      { name: 'Ground', type: 'tilelayer', width: 20, height: 12, data: new Array(240).fill(0) }
    ]
  },
  tileOperations: [
    { tool: 'rect-fill', layer: 'Ground', x: 0, y: 10, width: 20, height: 2, tile: 1 },
    { tool: 'terrain-rule', layer: 'Ground', x: 10, y: 9, tile: 2, rule: { id: 'grass-edge', edgeTile: 3 } }
  ],
  collisionPaint: [
    { kind: 'one-way', x: 3, y: 7, width: 4, height: 1 },
    { kind: 'slope', x: 9, y: 8, width: 2, height: 2, direction: 'ascending' },
    { kind: 'moving-platform', x: 13, y: 6, width: 3, height: 1, velocity: { x: 20, y: 0 } }
  ],
  stampPalette: [
    { id: 'coin-trigger', type: 'trigger', prefab: 'prefabs/coin-trigger.prefab.json' },
    { id: 'torch', type: 'light', prefab: 'prefabs/torch-light.prefab.json', light: { radius: 90 } }
  ],
  stampPlacements: [
    { stamp: 'coin-trigger', tile: { x: 6, y: 6 } },
    { stamp: 'torch', tile: { x: 2, y: 5 } }
  ],
  animation: {
    actorId: 'hero',
    arcadeState: { grounded: false, velocity: hero.velocity },
    ySortPreview: true,
    entities: [hero]
  },
  playtest: { runInEditor: true, hotReload: true, debug: ['collisions', 'sensors', 'animation', 'y-sort'] }
});

const scenePipeline = createScene2D25DPipeline({
  tilemap: {
    width: 20,
    height: 12,
    tileWidth: tileSize,
    tileHeight: tileSize,
    layers: [{ name: 'Collision', type: 'tilelayer', width: 20, height: 12, data: new Array(240).fill(0) }]
  },
  entities: [hero],
  camera: { follow: 'hero', viewport: { width: canvas.width, height: canvas.height } },
  arcade2D: {
    actors: [hero],
    colliders: authoring.collision.colliders,
    sensors: authoring.stamps.placements.filter((item) => item.type === 'trigger')
  }
});

let lastTime = performance.now();
let platformPhase = 0;
const debugOverlay = {
  authoring,
  scenePipeline,
  sensorHits: 0,
  animation: 'idle'
};

window.addEventListener('keydown', (event) => keys.add(event.code));
window.addEventListener('keyup', (event) => keys.delete(event.code));

function update(delta) {
  hero.previous = { x: hero.x, y: hero.y };
  hero.velocity.x = (keys.has('ArrowRight') ? 130 : 0) - (keys.has('ArrowLeft') ? 130 : 0);
  hero.velocity.y += 680 * delta;
  if ((keys.has('Space') || keys.has('ArrowUp')) && hero.grounded) {
    hero.velocity.y = -320;
    hero.grounded = false;
  }
  hero.x += hero.velocity.x * delta;
  hero.y += hero.velocity.y * delta;

  platformPhase += delta;
  const liveColliders = authoring.collision.colliders.map((collider) => {
    if (collider.type !== 'moving-platform') return collider;
    return {
      ...collider,
      x: collider.x + Math.sin(platformPhase) * 48,
      velocity: { x: Math.cos(platformPhase) * 48, y: 0 }
    };
  });
  const physics = createArcade2DGameplayPlan({
    delta,
    actors: [hero],
    colliders: liveColliders,
    sensors: authoring.stamps.placements
      .filter((item) => item.type === 'trigger')
      .map((item) => ({ id: item.id, channel: 'pickup', x: item.x, y: item.y, width: item.width, height: item.height }))
  });
  const next = physics.actors.hero.next;
  hero.x = next.x;
  hero.y = next.y;
  hero.grounded = next.grounded;
  if (hero.grounded && hero.velocity.y > 0) hero.velocity.y = 0;
  debugOverlay.sensorHits += physics.sensorEvents.length;
  debugOverlay.animation = resolveAnimation(hero);
  debugOverlay.physics = physics;
  debugOverlay.liveColliders = liveColliders;
}

function render() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawTilemap();
  drawColliders(debugOverlay.liveColliders || authoring.collision.colliders);
  drawStamps();
  drawHero();
  drawLight();
  drawDebug();
}

function drawBackground() {
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#1d4ed8');
  gradient.addColorStop(1, '#0f172a');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function drawTilemap() {
  context.fillStyle = '#475569';
  context.fillRect(0, 10 * tileSize, canvas.width, 2 * tileSize);
  context.fillStyle = '#64748b';
  context.fillRect(10 * tileSize, 9 * tileSize, tileSize, tileSize);
}

function drawColliders(colliders) {
  for (const collider of colliders) {
    context.fillStyle = collider.type === 'one-way' ? '#22c55e' : collider.type === 'slope' ? '#eab308' : '#38bdf8';
    if (collider.type === 'slope') {
      context.beginPath();
      context.moveTo(collider.x, collider.y + collider.height);
      context.lineTo(collider.x + collider.width, collider.y);
      context.lineTo(collider.x + collider.width, collider.y + collider.height);
      context.closePath();
      context.fill();
    } else {
      context.fillRect(collider.x, collider.y, collider.width, collider.height);
    }
  }
}

function drawStamps() {
  for (const stamp of authoring.stamps.placements) {
    context.fillStyle = stamp.type === 'light' ? '#facc15' : '#f97316';
    context.fillRect(stamp.x, stamp.y, stamp.width, stamp.height);
  }
}

function drawHero() {
  context.fillStyle = debugOverlay.animation === 'run' ? '#60a5fa' : debugOverlay.animation === 'jump' ? '#a78bfa' : '#f8fafc';
  context.fillRect(hero.x, hero.y, hero.width, hero.height);
}

function drawLight() {
  const torch = authoring.stamps.placements.find((stamp) => stamp.type === 'light');
  if (!torch) return;
  const gradient = context.createRadialGradient(torch.x, torch.y, 8, torch.x, torch.y, 100);
  gradient.addColorStop(0, 'rgba(250, 204, 21, 0.45)');
  gradient.addColorStop(1, 'rgba(250, 204, 21, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function drawDebug() {
  context.fillStyle = 'rgba(15, 23, 42, 0.76)';
  context.fillRect(8, 8, 258, 92);
  context.fillStyle = '#e5e7eb';
  context.font = '12px monospace';
  context.fillText(`animation: ${debugOverlay.animation}`, 18, 30);
  context.fillText(`sensor hits: ${debugOverlay.sensorHits}`, 18, 48);
  context.fillText(`debug panels: ${authoring.playtest.debugPanels.join(', ')}`, 18, 66);
  context.fillText(`hot reload: ${authoring.playtest.hotReloadEvents.length} events`, 18, 84);
}

function resolveAnimation(entity) {
  if (!entity.grounded && entity.velocity.y < 0) return 'jump';
  if (!entity.grounded && entity.velocity.y >= 0) return 'fall';
  if (Math.abs(entity.velocity.x) > 1) return 'run';
  return 'idle';
}

function frame(time) {
  const delta = Math.min(0.033, (time - lastTime) / 1000);
  lastTime = time;
  update(delta);
  render();
  requestAnimationFrame(frame);
}

console.log('OmniCore 2D/2.5D platformer demo ready', {
  OmniCore,
  debugOverlay
});

requestAnimationFrame(frame);
