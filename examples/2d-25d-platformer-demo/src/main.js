import OmniCore, {
  createArcade2DGameplayPlan,
  createAnimationFeedback2D25DDirectorStep,
  createCamera2D25DDirectorStep,
  createCollectible2D25DDirectorStep,
  createEncounter2D25DDirectorStep,
  createHazard2D25DDirectorStep,
  createInteractable2D25DDirectorStep,
  createLevel2D25DGameplayLoop,
  createPlatformer2DControllerStep,
  createProjectile2D25DDirectorStep,
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

const checkpoint = { id: 'checkpoint-start', x: 32, y: 176, width: 40, height: 48, respawn: { x: 72, y: 178 } };
const coin = { id: 'coin-1', x: 192, y: 188, width: 14, height: 14, inventoryKey: 'coins', value: 1 };
const keyPickup = { id: 'key-1', type: 'key', x: 252, y: 292, width: 12, height: 12, inventoryKey: 'keys', amount: 1 };
const xpOrb = { id: 'xp-orb-1', type: 'xp', x: 318, y: 286, width: 10, height: 10, inventoryKey: 'xp', amount: 8 };
const switchAlpha = { id: 'switch-alpha', type: 'switch', x: 126, y: 286, width: 16, height: 16 };
const gateA = { id: 'gate-a', type: 'door', x: 488, y: 240, width: 26, height: 64 };
const treasureChest = { id: 'treasure-chest', type: 'chest', x: 224, y: 294, width: 22, height: 14 };
const npcGuide = { id: 'npc-guide', type: 'npc', x: 356, y: 274, width: 18, height: 30 };
const spikePit = { id: 'spike-pit', type: 'spikes', x: 392, y: 318, width: 64, height: 12 };
const movingSaw = { id: 'moving-saw', type: 'moving-saw', x: 424, y: 286, width: 18, height: 18 };
const enemy = {
  id: 'slime',
  type: 'enemy',
  x: 280,
  y: 286,
  width: 24,
  height: 18,
  health: 3,
  patrol: { from: 248, to: 360, speed: 32, direction: 1 },
  hurtboxes: [{ id: 'body', x: 0, y: 0, width: 24, height: 18 }]
};

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
const inputMemory = {
  lastJumpPressedAt: Number.NEGATIVE_INFINITY,
  lastGroundedAt: performance.now(),
  jumpReleasedFrame: false,
  interactPressedFrame: false
};
const debugOverlay = {
  authoring,
  scenePipeline,
  sensorHits: 0,
  animation: 'idle',
  level: null,
  interactionState: {
    switches: { 'switch-alpha': false },
    doors: { 'gate-a': { locked: true, open: false } },
    chests: { 'treasure-chest': { opened: false } },
    checkpoints: { active: 'checkpoint-start' }
  },
  hazardState: {
    health: 6,
    invulnerabilityMs: 0,
    sawX: movingSaw.x,
    sawDirection: 1
  },
  collectibleState: {
    inventory: { coins: 0, keys: 0, xp: 0 },
    score: 0,
    combo: { streak: 0, multiplier: 1, windowMs: 900 },
    dropSpawned: false
  }
};
const demoProjectiles = [];
const demoCollectibles = [
  { ...coin, type: 'coin', amount: 1, score: 25, pickupRadius: 18, magnetizable: true },
  { ...keyPickup, score: 50, pickupRadius: 16, magnetizable: true },
  { ...xpOrb, score: 10, pickupRadius: 18, magnetizable: true }
];

window.addEventListener('keydown', (event) => {
  if (!keys.has(event.code) && isJumpKey(event.code)) {
    inputMemory.lastJumpPressedAt = performance.now();
  }
  if (!keys.has(event.code) && event.code === 'KeyE') {
    inputMemory.interactPressedFrame = true;
  }
  keys.add(event.code);
});
window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
  if (isJumpKey(event.code)) inputMemory.jumpReleasedFrame = true;
});

function update(delta) {
  const now = performance.now();
  if (hero.grounded) inputMemory.lastGroundedAt = now;
  hero.previous = { x: hero.x, y: hero.y };
  const floor = debugOverlay.physics?.actors?.hero?.movement || null;
  const controller = createPlatformer2DControllerStep({
    delta,
    actor: {
      ...hero,
      velocity: { x: hero.velocity.x, y: hero.velocity.y + 680 * delta },
      lastGroundedAgoMs: hero.grounded ? 0 : now - inputMemory.lastGroundedAt
    },
    input: {
      axisX: (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0),
      jumpPressedAgoMs: now - inputMemory.lastJumpPressedAt,
      jumpHeld: keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW'),
      jumpReleased: inputMemory.jumpReleasedFrame,
      down: keys.has('ArrowDown') || keys.has('KeyS'),
      attackPressed: keys.has('KeyJ')
    },
    floor: floor?.floorId ? {
      id: floor.floorId,
      type: floor.floorType,
      velocity: floor.platformVelocity,
      slopeAngleDegrees: floor.slopeAngleDegrees
    } : null,
    tuning: {
      maxSpeed: 150,
      acceleration: 900,
      deceleration: 1100,
      airAcceleration: 540,
      jumpVelocity: 330,
      coyoteTimeMs: 100,
      jumpBufferMs: 120,
      variableJumpCut: 0.5,
      lookAhead: 48
    }
  });
  hero.velocity = { ...controller.movement.velocity };
  hero.x += hero.velocity.x * delta;
  hero.y += hero.velocity.y * delta;
  hero.grounded = false;

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
    actors: [{
      ...controller.physics.actor,
      x: hero.x,
      y: hero.y,
      previous: hero.previous
    }],
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
  debugOverlay.animation = controller.animation.state;
  debugOverlay.level = createLevel2D25DGameplayLoop({
    delta,
    world: { bounds: { x: 0, y: 0, width: canvas.width, height: canvas.height }, frameBudgetMs: 16.67 },
    camera: {
      target: 'hero',
      viewport: { width: canvas.width, height: canvas.height },
      zones: [
        { id: 'CameraZones-start', x: 0, y: 0, width: canvas.width, height: canvas.height, deadzone: { x: 220, y: 120, width: 180, height: 120 } }
      ]
    },
    actors: [
      {
        ...hero,
        health: 6,
        facing: hero.velocity.x < 0 ? 'left' : 'right',
        state: { attacking: keys.has('KeyJ') },
        hitboxes: keys.has('KeyJ') ? [{ id: 'hero-sword', x: 18, y: 8, width: 28, height: 12, damage: 1 }] : [],
        hurtboxes: [{ id: 'body', x: 0, y: 0, width: hero.width, height: hero.height }]
      },
      enemy
    ],
    collectibles: [coin],
    checkpoints: [checkpoint],
    triggers: [{ id: 'exit-door', x: 568, y: 248, width: 32, height: 72, event: 'scene:transition', target: 'next-level' }],
    render: { visibleBounds: { x: 0, y: 0, width: canvas.width, height: canvas.height }, maxDrawCalls: 64 }
  });
  debugOverlay.encounter = createEncounter2D25DDirectorStep({
    delta,
    player: { ...hero, health: 6 },
    enemies: [{
      ...enemy,
      threat: 2,
      perception: { radius: 128, attackRange: 42 },
      attack: { damage: 1, cooldownMs: 0 },
      loot: [{ id: 'coin', chance: 1, amount: 1 }]
    }],
    spawners: [{
      id: 'SpawnWaves-demo',
      prefab: 'slime',
      count: 1,
      cooldownMs: 0,
      trigger: { x: 40, y: 140, width: 260, height: 180 },
      spawnPoints: [{ x: 420, y: 286 }]
    }],
    director: { threatLimit: 5, difficulty: 1, leashDistance: 180 }
  });
  const worldBounds = {
    x: 0,
    y: 0,
    width: Math.max(canvas.width, 20 * tileSize),
    height: Math.max(canvas.height, 12 * tileSize)
  };
  const facing = hero.velocity.x < 0 ? -1 : 1;
  debugOverlay.projectiles = createProjectile2D25DDirectorStep({
    delta,
    bounds: worldBounds,
    emitters: [{
      id: 'ProjectileDirector-hero-blaster',
      ownerId: hero.id,
      prefab: 'bolt',
      fire: keys.has('KeyK'),
      muzzle: { x: hero.x + (facing > 0 ? hero.width : -8), y: hero.y + 12 },
      direction: { x: facing, y: 0 },
      speed: 260,
      damage: 1,
      pierce: 1,
      bounce: 1,
      poolSize: 12,
      cooldownMs: 0
    }],
    projectiles: demoProjectiles,
    targets: [enemy],
    colliders: [
      { id: 'projectile-left-wall', type: 'solid', x: -8, y: 0, width: 8, height: worldBounds.height },
      { id: 'projectile-right-wall', type: 'solid', x: worldBounds.width, y: 0, width: 8, height: worldBounds.height }
    ],
    pool: { budget: 12, active: demoProjectiles.length }
  });
  const despawnIds = new Set(debugOverlay.projectiles.lifetime.despawnCommands.map((command) => command.projectileId));
  const nextProjectiles = [
    ...debugOverlay.projectiles.motion.updates
      .filter((projectile) => !despawnIds.has(projectile.id))
      .map((projectile) => ({
        ...projectile,
        bounce: projectile.bounceRemaining
      })),
    ...debugOverlay.projectiles.spawning.spawnCommands.map((command, index) => ({
      ...command,
      id: `${command.id}:${Math.round(now)}:${index}`,
      ageMs: 0
    }))
  ].slice(-12);
  demoProjectiles.splice(0, demoProjectiles.length, ...nextProjectiles);
  const dropTriggered = !debugOverlay.collectibleState.dropSpawned
    && debugOverlay.projectiles.collisions.hitEvents.some((hit) => hit.targetId === enemy.id);
  debugOverlay.collectibles = createCollectible2D25DDirectorStep({
    delta,
    actor: {
      ...hero,
      inventory: debugOverlay.collectibleState.inventory,
      score: debugOverlay.collectibleState.score
    },
    magnet: { enabled: true, radius: 72, strength: 180 },
    combo: debugOverlay.collectibleState.combo,
    collectibles: demoCollectibles,
    dropSources: [{
      id: 'slime-drop',
      defeated: dropTriggered,
      x: enemy.x,
      y: enemy.y,
      drops: [{ id: 'slime-coin', type: 'coin', inventoryKey: 'coins', amount: 2, chance: 1, score: 40 }]
    }]
  });
  applyCollectibleState(debugOverlay.collectibles);
  debugOverlay.interactables = createInteractable2D25DDirectorStep({
    delta,
    player: { ...hero, inventory: { keys: 1, coins: 0 } },
    input: {
      interactPressed: inputMemory.interactPressedFrame,
      interactTargetIds: debugOverlay.interactables?.prompts.nearest
        ? [debugOverlay.interactables.prompts.nearest.interactableId]
        : []
    },
    worldState: debugOverlay.interactionState,
    interactables: [
      {
        ...switchAlpha,
        radius: 42,
        prompt: 'Pull switch',
        priority: 10,
        effects: [
          { type: 'set-state', targetId: gateA.id, domain: 'doors', key: 'locked', value: false },
          { type: 'emit-event', event: 'gate:unlock', targetId: gateA.id }
        ]
      },
      {
        ...gateA,
        radius: 54,
        prompt: 'Open gate',
        locked: debugOverlay.interactionState.doors['gate-a'].locked,
        transition: { scene: 'next-level', spawn: 'entry' }
      },
      {
        ...treasureChest,
        radius: 40,
        prompt: 'Open chest',
        loot: [{ id: 'coins', amount: 5 }]
      },
      {
        ...npcGuide,
        radius: 48,
        prompt: 'Talk',
        dialogue: 'intro-guide'
      },
      {
        id: 'checkpoint-hill',
        type: 'checkpoint',
        x: checkpoint.x,
        y: checkpoint.y,
        width: checkpoint.width,
        height: checkpoint.height,
        radius: 36,
        auto: true,
        respawn: checkpoint.respawn
      }
    ]
  });
  applyInteractableState(debugOverlay.interactables);
  debugOverlay.hazards = createHazard2D25DDirectorStep({
    delta,
    actor: {
      ...hero,
      health: debugOverlay.hazardState.health,
      invulnerabilityMs: debugOverlay.hazardState.invulnerabilityMs,
      velocity: hero.velocity
    },
    checkpoint,
    hazards: [
      {
        ...spikePit,
        damage: 1,
        knockback: { x: -120, y: -260 },
        invulnerabilityMs: 900,
        respawnOnHit: true,
        cooldownMs: 700
      },
      {
        ...movingSaw,
        x: debugOverlay.hazardState.sawX,
        damage: 1,
        path: { from: 360, to: 500, speed: 48, direction: debugOverlay.hazardState.sawDirection },
        knockback: { x: hero.x < debugOverlay.hazardState.sawX ? -150 : 150, y: -220 },
        invulnerabilityMs: 700,
        respawnOnHit: false,
        cooldownMs: 500
      }
    ]
  });
  applyHazardState(debugOverlay.hazards);
  debugOverlay.feedback = createAnimationFeedback2D25DDirectorStep({
    delta,
    timeMs: now % 320,
    actor: { id: 'hero', facing: hero.velocity.x < 0 ? 'left' : 'right' },
    animation: { state: controller.animation.state, elapsedMs: now % 320, previousState: debugOverlay.animation },
    clips: {
      idle: 'hero_idle',
      run: 'hero_run',
      jump: 'hero_jump',
      fall: 'hero_fall',
      attack: 'hero_attack_01',
      'attack-2': 'hero_attack_02',
      hurt: 'hero_hurt'
    },
    locks: { attack: 240 },
    combat: debugOverlay.level.combat,
    combo: {
      actorId: 'hero',
      currentIndex: 1,
      inputBuffered: keys.has('KeyJ'),
      windows: [{ fromState: 'attack', nextState: 'attack-2', openMs: 120, closeMs: 240 }]
    },
    feedback: {
      hitstopMsPerDamage: 6,
      maxHitstopMs: 24,
      hurtFlashMs: 90,
      cameraTraumaPerDamage: 0.08,
      particlePreset: 'slash-sparks',
      audioCue: 'sword-hit'
    }
  });
  const previousCamera = debugOverlay.cameraDirector?.view || { x: 0, y: 0 };
  const impactTrauma = debugOverlay.feedback.camera.impulses[0]?.trauma || 0;
  debugOverlay.cameraDirector = createCamera2D25DDirectorStep({
    delta,
    camera: {
      x: previousCamera.x,
      y: previousCamera.y,
      viewport: { width: canvas.width, height: canvas.height },
      zoom: 1,
      pixelSnap: true
    },
    target: {
      ...hero,
      lookAhead: controller.camera.lookAhead
    },
    rooms: [
      {
        id: 'CameraDirector-world',
        x: 0,
        y: 0,
        width: Math.max(canvas.width, 20 * tileSize),
        height: Math.max(canvas.height, 12 * tileSize)
      }
    ],
    deadzone: { x: 220, y: 120, width: 180, height: 120 },
    smoothing: { follow: 0.18, lookAhead: 1 },
    shake: { trauma: Math.min(1, (keys.has('KeyJ') ? 0.35 : 0) + impactTrauma), decay: 0.08, maxOffset: 10, seed: Math.round(platformPhase * 60) },
    parallax: [
      { id: 'sky', factorX: 0.2, factorY: 0.08 },
      { id: 'mid', factorX: 0.55, factorY: 0.25 }
    ]
  });
  debugOverlay.controller = controller;
  debugOverlay.physics = physics;
  debugOverlay.liveColliders = liveColliders;
  inputMemory.jumpReleasedFrame = false;
  inputMemory.interactPressedFrame = false;
}

function render() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  const camera = debugOverlay.cameraDirector || { view: { x: 0, y: 0 }, shake: { offset: { x: 0, y: 0 } } };
  context.save();
  context.translate(
    -camera.view.x + camera.shake.offset.x,
    -camera.view.y + camera.shake.offset.y
  );
  drawTilemap();
  drawColliders(debugOverlay.liveColliders || authoring.collision.colliders);
  drawStamps();
  drawGameplayObjects();
  drawCollectibles();
  drawInteractables();
  drawHazards();
  drawProjectiles();
  drawHero();
  drawLight();
  context.restore();
  drawDebug();
}

function drawGameplayObjects() {
  context.fillStyle = '#34d399';
  context.fillRect(checkpoint.x, checkpoint.y, checkpoint.width, checkpoint.height);
  context.fillStyle = debugOverlay.feedback?.flashes.some((flash) => flash.targetId === enemy.id) ? '#f8fafc' : '#fb7185';
  context.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
}

function drawCollectibles() {
  for (const item of demoCollectibles) {
    context.fillStyle = item.type === 'key' ? '#fde047' : item.type === 'xp' ? '#38bdf8' : '#facc15';
    context.fillRect(item.x, item.y, item.width, item.height);
  }
}

function drawInteractables() {
  context.fillStyle = debugOverlay.interactionState.switches['switch-alpha'] ? '#86efac' : '#f97316';
  context.fillRect(switchAlpha.x, switchAlpha.y, switchAlpha.width, switchAlpha.height);
  context.fillStyle = debugOverlay.interactionState.doors['gate-a'].locked ? '#7c2d12' : '#22c55e';
  context.fillRect(gateA.x, gateA.y, gateA.width, gateA.height);
  context.fillStyle = debugOverlay.interactionState.chests['treasure-chest'].opened ? '#a3a3a3' : '#f59e0b';
  context.fillRect(treasureChest.x, treasureChest.y, treasureChest.width, treasureChest.height);
  context.fillStyle = '#c084fc';
  context.fillRect(npcGuide.x, npcGuide.y, npcGuide.width, npcGuide.height);
  const nearest = debugOverlay.interactables?.prompts.nearest;
  if (!nearest) return;
  context.fillStyle = 'rgba(15, 23, 42, 0.82)';
  context.fillRect(hero.x - 10, hero.y - 28, 108, 18);
  context.fillStyle = '#f8fafc';
  context.font = '10px monospace';
  context.fillText(`E: ${nearest.prompt}`, hero.x - 6, hero.y - 16);
}

function drawHazards() {
  context.fillStyle = '#ef4444';
  context.beginPath();
  context.moveTo(spikePit.x, spikePit.y + spikePit.height);
  context.lineTo(spikePit.x + spikePit.width / 2, spikePit.y);
  context.lineTo(spikePit.x + spikePit.width, spikePit.y + spikePit.height);
  context.closePath();
  context.fill();
  context.fillStyle = debugOverlay.hazardState.invulnerabilityMs > 0 ? '#fca5a5' : '#dc2626';
  context.fillRect(debugOverlay.hazardState.sawX, movingSaw.y, movingSaw.width, movingSaw.height);
}

function applyCollectibleState(step) {
  for (const command of step.magnet.motionCommands) {
    const item = demoCollectibles.find((collectible) => collectible.id === command.collectibleId);
    if (!item) continue;
    item.x = command.next.x;
    item.y = command.next.y;
  }
  const pickedIds = new Set(step.lifetime.despawnCommands.map((command) => command.collectibleId));
  for (let index = demoCollectibles.length - 1; index >= 0; index -= 1) {
    if (pickedIds.has(demoCollectibles[index].id)) demoCollectibles.splice(index, 1);
  }
  for (const command of step.drops.spawnCommands) {
    demoCollectibles.push({
      id: `${command.id}:${Math.round(performance.now())}`,
      type: command.type,
      x: command.x,
      y: command.y,
      width: command.width,
      height: command.height,
      inventoryKey: command.inventoryKey,
      amount: command.amount,
      score: command.score,
      pickupRadius: 18,
      magnetizable: true
    });
  }
  if (step.drops.spawnCommands.length > 0) debugOverlay.collectibleState.dropSpawned = true;
  debugOverlay.collectibleState.inventory = { ...step.inventory.totals };
  debugOverlay.collectibleState.score = step.score.total;
  debugOverlay.collectibleState.combo = {
    streak: step.combo.nextStreak,
    multiplier: Math.min(2.5, step.combo.multiplier + step.pickups.events.length * 0.1),
    windowMs: 900
  };
}

function applyInteractableState(step) {
  for (const update of step.stateUpdates.switches) {
    debugOverlay.interactionState.switches[update.switchId] = update.active;
  }
  for (const update of step.stateUpdates.doors) {
    debugOverlay.interactionState.doors[update.doorId] = {
      ...(debugOverlay.interactionState.doors[update.doorId] || {}),
      ...update
    };
  }
  for (const update of step.stateUpdates.chests) {
    debugOverlay.interactionState.chests[update.chestId] = {
      ...(debugOverlay.interactionState.chests[update.chestId] || {}),
      opened: update.opened
    };
  }
  if (step.stateUpdates.checkpoint) {
    debugOverlay.interactionState.checkpoints.active = step.stateUpdates.checkpoint.checkpointId;
  }
}

function applyHazardState(step) {
  const moving = step.motion.hazardUpdates.find((hazard) => hazard.id === movingSaw.id);
  if (moving) {
    debugOverlay.hazardState.sawX = moving.x;
    debugOverlay.hazardState.sawDirection = moving.direction;
  }
  debugOverlay.hazardState.health = step.stateUpdates.actor.health;
  debugOverlay.hazardState.invulnerabilityMs = step.stateUpdates.actor.invulnerabilityMs;
  if (step.contacts.hitEvents.length === 0 && step.response.respawnCommands.length === 0) return;
  hero.x = step.stateUpdates.actor.x;
  hero.y = step.stateUpdates.actor.y;
  hero.velocity = { ...step.stateUpdates.actor.velocity };
}

function drawProjectiles() {
  context.fillStyle = '#fbbf24';
  for (const projectile of demoProjectiles) {
    context.fillRect(projectile.x, projectile.y, projectile.width, projectile.height);
  }
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
  context.fillRect(8, 8, 312, 216);
  context.fillStyle = '#e5e7eb';
  context.font = '12px monospace';
  context.fillText(`animation: ${debugOverlay.animation}`, 18, 30);
  context.fillText(`sensor hits: ${debugOverlay.sensorHits}`, 18, 48);
  context.fillText(`debug panels: ${authoring.playtest.debugPanels.join(', ')}`, 18, 66);
  context.fillText(`CameraZones + FrameBudget: ${debugOverlay.level?.performance.frameBudget.estimatedMs || 0}ms`, 18, 84);
  context.fillText(`InputBuffer / CoyoteTime / VariableJump`, 18, 98);
  context.fillText(`controller panels: ${debugOverlay.controller?.editor.panels.slice(0, 3).join(', ') || '-'}`, 18, 112);
  context.fillText(`CameraDirector / ParallaxLayers / ShakeTrauma`, 18, 126);
  context.fillText(`Hitstop / ComboWindows / ImpactParticles`, 18, 140);
  context.fillText(`EncounterDirector / ThreatBudget / SpawnWaves`, 18, 154);
  context.fillText(`ProjectileDirector / ProjectilePool / PierceBounce`, 18, 168);
  context.fillText(`InteractableDirector / Switches / Doors / Chests`, 18, 182);
  context.fillText(`HazardDirector / DamageZones / InvulnerabilityFrames`, 18, 196);
  context.fillText(`CollectibleDirector / Magnet / InventoryDeltas`, 18, 210);
}

function resolveAnimation(entity) {
  if (!entity.grounded && entity.velocity.y < 0) return 'jump';
  if (!entity.grounded && entity.velocity.y >= 0) return 'fall';
  if (Math.abs(entity.velocity.x) > 1) return 'run';
  return 'idle';
}

function isJumpKey(code) {
  return code === 'Space' || code === 'ArrowUp' || code === 'KeyW';
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
