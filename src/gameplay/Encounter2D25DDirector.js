export const ENCOUNTER_2D_25D_SCHEMA = 'omnicore.encounter-2d-25d-director.v1';

/**
 * Builds one enemy encounter director step for 2D/2.5D games.
 */
export function createEncounter2D25DDirectorStep(config = {}) {
  const delta = Math.max(0, numberOr(config.delta, 1 / 60));
  const player = normalizeActor(config.player || {}, 'hero');
  const enemies = normalizeEnemies(config.enemies || []);
  const director = normalizeDirector(config.director || {});
  const perception = buildPerception(player, enemies);
  const ai = buildAIState({ player, enemies, perception, director, delta });
  const combat = buildCombatState(ai.decisions);
  const spawning = buildSpawningState(player, config.spawners || []);
  const threat = buildThreatState(enemies, spawning.spawnCommands, director);
  const rewards = buildRewards(enemies);
  const events = buildEvents({ ai, spawning });
  const editor = buildEditorState();
  const runtimeSync = buildRuntimeSyncState();
  const debugDraw = buildDebugDraw({ player, enemies, perception, ai, spawning, threat });
  const quality = buildQualityChecks({ perception, ai, spawning, threat, editor, runtimeSync });

  return {
    schema: ENCOUNTER_2D_25D_SCHEMA,
    delta,
    player,
    enemies,
    perception,
    ai,
    combat,
    spawning,
    threat,
    rewards,
    events,
    editor,
    runtimeSync,
    debugDraw,
    quality
  };
}

function normalizeActor(actor = {}, fallbackId = 'actor') {
  const width = numberOr(actor.width ?? actor.w, 0);
  const height = numberOr(actor.height ?? actor.h, 0);
  const x = numberOr(actor.x, 0);
  const y = numberOr(actor.y, 0);
  return {
    ...actor,
    id: actor.id || actor.name || fallbackId,
    type: actor.type || 'actor',
    x,
    y,
    width,
    height,
    health: numberOr(actor.health, 1),
    center: {
      x: x + width / 2,
      y: y + height / 2
    }
  };
}

function normalizeEnemies(input) {
  return (Array.isArray(input) ? input : [input]).filter(Boolean).map((enemy, index) => ({
    ...normalizeActor(enemy, `enemy-${index}`),
    type: enemy.type || 'enemy',
    threat: numberOr(enemy.threat, 1),
    perception: {
      radius: numberOr(enemy.perception?.radius, 96),
      attackRange: numberOr(enemy.perception?.attackRange, 32)
    },
    patrol: {
      from: numberOr(enemy.patrol?.from, enemy.x),
      to: numberOr(enemy.patrol?.to, enemy.x),
      speed: numberOr(enemy.patrol?.speed, 0),
      direction: numberOr(enemy.patrol?.direction, 1) >= 0 ? 1 : -1
    },
    attack: {
      damage: numberOr(enemy.attack?.damage, 1),
      cooldownMs: numberOr(enemy.attack?.cooldownMs, 0)
    },
    loot: Array.isArray(enemy.loot) ? enemy.loot : []
  }));
}

function normalizeDirector(director = {}) {
  return {
    threatLimit: numberOr(director.threatLimit, 8),
    difficulty: numberOr(director.difficulty, 1),
    leashDistance: numberOr(director.leashDistance, 160)
  };
}

function buildPerception(player, enemies) {
  const detected = [];
  const all = enemies.map((enemy) => {
    const distance = distanceBetween(enemy.center, player.center);
    const lineOfSight = distance <= enemy.perception.radius;
    const inAttackRange = distance <= enemy.perception.attackRange;
    const entry = {
      enemyId: enemy.id,
      targetId: player.id,
      distance: round(distance),
      lineOfSight,
      inAttackRange,
      radius: enemy.perception.radius,
      attackRange: enemy.perception.attackRange
    };
    if (lineOfSight) detected.push(entry);
    return entry;
  });
  return { detected, all };
}

function buildAIState({ player, enemies, perception, director, delta }) {
  const decisions = enemies.map((enemy) => {
    const seen = perception.all.find((entry) => entry.enemyId === enemy.id);
    const state = resolveEnemyState(enemy, seen, director);
    const targetId = state === 'patrol' ? null : player.id;
    const nextX = state === 'patrol'
      ? stepPatrol(enemy, delta)
      : stepToward(enemy.center.x, player.center.x, enemy.patrol.speed, delta);
    return {
      enemyId: enemy.id,
      state,
      targetId,
      intent: state === 'attack' ? 'melee' : state === 'chase' ? 'pursue' : 'route',
      nextAnimation: state === 'attack' ? 'attack' : enemy.type === 'bat' ? 'fly' : state,
      nextX: round(nextX),
      leashOk: !seen || seen.distance <= director.leashDistance,
      threat: enemy.threat
    };
  });
  const pathRequests = decisions
    .filter((decision) => decision.state === 'attack' || decision.state === 'chase')
    .map((decision) => {
      const enemy = enemies.find((item) => item.id === decision.enemyId);
      return {
        enemyId: decision.enemyId,
        from: { x: round(enemy.center.x), y: round(enemy.center.y) },
        to: { x: round(player.center.x), y: round(player.center.y) }
      };
    });
  return { decisions, pathRequests };
}

function buildCombatState(decisions) {
  return {
    attackEvents: decisions
      .filter((decision) => decision.state === 'attack')
      .map((decision) => ({
        attackerId: decision.enemyId,
        targetId: decision.targetId,
        damage: 1,
        intent: decision.intent
      }))
  };
}

function buildSpawningState(player, spawnersInput) {
  const spawners = (Array.isArray(spawnersInput) ? spawnersInput : [spawnersInput]).filter(Boolean);
  const spawnCommands = [];
  for (const spawner of spawners) {
    const trigger = normalizeRect(spawner.trigger || {});
    const active = spawner.cooldownMs <= 0 && containsPoint(trigger, player.center);
    const spawnPoints = Array.isArray(spawner.spawnPoints) ? spawner.spawnPoints : [];
    if (!active) continue;
    const count = Math.max(0, Math.trunc(numberOr(spawner.count, spawnPoints.length)));
    for (let index = 0; index < count; index += 1) {
      const point = spawnPoints[index % Math.max(1, spawnPoints.length)] || { x: trigger.x, y: trigger.y };
      spawnCommands.push({
        id: `${spawner.id || 'spawner'}-${index}`,
        spawnerId: spawner.id || `spawner-${index}`,
        prefab: spawner.prefab || 'enemy',
        x: numberOr(point.x, 0),
        y: numberOr(point.y, 0)
      });
    }
  }
  return { spawnCommands };
}

function buildThreatState(enemies, spawnCommands, director) {
  const activeThreat = enemies.reduce((sum, enemy) => sum + enemy.threat, 0);
  return {
    activeThreat,
    pendingSpawnCount: spawnCommands.length,
    limit: director.threatLimit,
    overBudget: activeThreat > director.threatLimit,
    difficulty: director.difficulty
  };
}

function buildRewards(enemies) {
  return {
    dropTable: enemies.flatMap((enemy) => enemy.loot
      .filter((loot) => numberOr(loot.chance, 0) >= 1)
      .map((loot) => ({
        enemyId: enemy.id,
        itemId: loot.id || loot.item || 'item',
        amount: numberOr(loot.amount, 1)
      })))
  };
}

function buildEvents({ ai, spawning }) {
  return {
    queue: [
      ...ai.decisions
        .filter((decision) => decision.state === 'attack')
        .map((decision) => ({
          type: 'encounter:enemy-attack',
          enemyId: decision.enemyId,
          targetId: decision.targetId
        })),
      ...spawning.spawnCommands.map((command) => ({
        type: 'encounter:spawn-wave',
        spawnerId: command.spawnerId,
        prefab: command.prefab
      }))
    ]
  };
}

function buildEditorState() {
  return {
    format: 'omnicore.encounter-2d25d-editor.v1',
    panels: [
      'EncounterDirector',
      'EnemyPerception',
      'ThreatBudget',
      'SpawnWaves',
      'LootDrops',
      'AIDebug',
      'RuntimeDebug'
    ],
    tools: [
      'PerceptionRadiusPainter',
      'PatrolRouteEditor',
      'SpawnWaveEditor',
      'ThreatBudgetMeter',
      'LootDropPreview'
    ],
    hotReloadTopics: [
      'encounter:director-changed',
      'encounter:enemy-perception-changed',
      'encounter:spawn-wave-changed',
      'encounter:loot-drop-changed'
    ]
  };
}

function buildRuntimeSyncState() {
  return {
    protocol: 'omnicore.runtime-sync.encounter-2d25d/v1',
    payloads: [
      'perception',
      'ai',
      'spawning',
      'threat',
      'rewards',
      'events',
      'editor'
    ],
    events: [
      'encounter:enemy-detected',
      'encounter:enemy-decision',
      'encounter:spawn-wave',
      'encounter:threat-budget',
      'encounter:reward-drop'
    ]
  };
}

function buildDebugDraw({ enemies, perception, ai, spawning, threat }) {
  return [
    ...perception.all.flatMap((entry) => {
      const enemy = enemies.find((item) => item.id === entry.enemyId);
      return [
        {
          op: 'debug:enemy-perception',
          enemyId: entry.enemyId,
          x: enemy.center.x,
          y: enemy.center.y,
          radius: entry.radius,
          detected: entry.lineOfSight
        },
        {
          op: 'debug:enemy-attack-range',
          enemyId: entry.enemyId,
          x: enemy.center.x,
          y: enemy.center.y,
          radius: entry.attackRange,
          inRange: entry.inAttackRange
        }
      ];
    }),
    ...ai.decisions.map((decision) => ({
      op: 'debug:enemy-intent',
      enemyId: decision.enemyId,
      state: decision.state,
      intent: decision.intent
    })),
    ...spawning.spawnCommands.map((command) => ({ op: 'debug:spawn-wave', ...command })),
    {
      op: 'debug:threat-budget',
      activeThreat: threat.activeThreat,
      limit: threat.limit,
      overBudget: threat.overBudget
    }
  ];
}

function buildQualityChecks({ perception, ai, spawning, threat, editor, runtimeSync }) {
  return {
    checks: [
      {
        id: 'enemy-perception',
        pass: perception.detected.length > 0,
        detail: `${perception.detected.length} detected`
      },
      {
        id: 'enemy-ai-decision',
        pass: ai.decisions.length > 0,
        detail: `${ai.decisions.length} decisions`
      },
      {
        id: 'spawn-wave',
        pass: spawning.spawnCommands.length > 0,
        detail: `${spawning.spawnCommands.length} commands`
      },
      {
        id: 'threat-budget',
        pass: !threat.overBudget,
        detail: `${threat.activeThreat}/${threat.limit}`
      },
      {
        id: 'editor-runtime-encounter-sync',
        pass: editor.panels.length > 0 && runtimeSync.payloads.includes('ai'),
        detail: runtimeSync.protocol
      }
    ]
  };
}

function resolveEnemyState(enemy, seen, director) {
  if (!seen || !seen.lineOfSight || seen.distance > director.leashDistance) return 'patrol';
  if (seen.inAttackRange && enemy.attack.cooldownMs <= 0) return 'attack';
  return 'chase';
}

function stepPatrol(enemy, delta) {
  const next = enemy.x + enemy.patrol.speed * enemy.patrol.direction * delta;
  if (next < enemy.patrol.from) return enemy.patrol.from;
  if (next > enemy.patrol.to) return enemy.patrol.to;
  return next;
}

function stepToward(from, to, speed, delta) {
  const distance = to - from;
  if (Math.abs(distance) < 0.001) return from;
  return from + Math.sign(distance) * Math.min(Math.abs(distance), Math.max(0, speed * delta));
}

function normalizeRect(rect = {}) {
  return {
    x: numberOr(rect.x, 0),
    y: numberOr(rect.y, 0),
    width: numberOr(rect.width ?? rect.w, 0),
    height: numberOr(rect.height ?? rect.h, 0)
  };
}

function containsPoint(rect, point) {
  return point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height;
}

function distanceBetween(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function numberOr(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function round(value) {
  return Math.round(numberOr(value, 0) * 1000) / 1000;
}

export default createEncounter2D25DDirectorStep;
