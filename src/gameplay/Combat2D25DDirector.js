export const COMBAT_2D_25D_SCHEMA = 'omnicore.combat-2d-25d-director.v1';

/**
 * Builds one melee combat resolver step for 2D/2.5D games.
 */
export function createCombat2D25DDirectorStep(config = {}) {
  const delta = Math.max(0, numberOr(config.delta, 1 / 60));
  const attackers = normalizeAttackers(config.attackers || []);
  const defenders = normalizeDefenders(config.defenders || []);
  const hitDetection = buildHitDetectionState({ attackers, defenders });
  const guards = buildGuardState(hitDetection.contacts);
  const damage = buildDamageState(hitDetection.contacts, defenders);
  const response = buildResponseState(hitDetection.contacts, damage.events);
  const combo = buildComboState(config.combo || {}, hitDetection.contacts);
  const effects = buildEffectsState(hitDetection.contacts, damage.events, guards);
  const events = buildEventsState({ hitDetection, damage, guards, combo });
  const editor = buildEditorState();
  const runtimeSync = buildRuntimeSyncState();
  const debugDraw = buildDebugDraw({ attackers, defenders, hitDetection, response });
  const quality = buildQualityChecks({ hitDetection, guards, damage, response, editor, runtimeSync });

  return {
    schema: COMBAT_2D_25D_SCHEMA,
    delta,
    attackers,
    defenders,
    hitDetection,
    guards,
    damage,
    response,
    combo,
    effects,
    events,
    editor,
    runtimeSync,
    debugDraw,
    quality
  };
}

function normalizeAttackers(input) {
  return (Array.isArray(input) ? input : [input]).filter(Boolean).map((attacker, index) => {
    const rect = normalizeRect(attacker);
    return {
      ...attacker,
      id: attacker.id || `attacker-${index}`,
      team: attacker.team || 'neutral',
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      facing: attacker.facing || 'right',
      attacks: normalizeAttacks(attacker.attacks || [])
    };
  });
}

function normalizeAttacks(input) {
  return (Array.isArray(input) ? input : [input]).filter(Boolean).map((attack, index) => ({
    id: attack.id || `attack-${index}`,
    active: attack.active === true,
    frame: Math.max(0, Math.floor(numberOr(attack.frame, 0))),
    hitstopMs: Math.max(0, numberOr(attack.hitstopMs, 40)),
    combo: attack.combo ? { ...attack.combo } : null,
    hitboxes: normalizeHitboxes(attack.hitboxes || [])
  }));
}

function normalizeHitboxes(input) {
  return (Array.isArray(input) ? input : [input]).filter(Boolean).map((hitbox, index) => {
    const rect = normalizeRect(hitbox);
    return {
      id: hitbox.id || `hitbox-${index}`,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      damage: Math.max(0, numberOr(hitbox.damage, 1)),
      knockback: {
        x: numberOr(hitbox.knockback?.x, 0),
        y: numberOr(hitbox.knockback?.y, 0)
      },
      staggerMs: Math.max(0, numberOr(hitbox.staggerMs, 0)),
      tags: Array.isArray(hitbox.tags) ? [...hitbox.tags] : []
    };
  });
}

function normalizeDefenders(input) {
  return (Array.isArray(input) ? input : [input]).filter(Boolean).map((defender, index) => {
    const rect = normalizeRect(defender);
    return {
      ...defender,
      id: defender.id || `defender-${index}`,
      team: defender.team || 'neutral',
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      health: Math.max(0, numberOr(defender.health, 1)),
      guard: normalizeGuard(defender.guard || {}),
      hurtboxes: normalizeHurtboxes(defender)
    };
  });
}

function normalizeGuard(guard = {}) {
  return {
    active: guard.active === true,
    parryWindowMs: Math.max(0, numberOr(guard.parryWindowMs, 0)),
    elapsedMs: Math.max(0, numberOr(guard.elapsedMs, Number.POSITIVE_INFINITY)),
    damageReduction: Math.max(0, numberOr(guard.damageReduction, 0))
  };
}

function normalizeHurtboxes(defender) {
  const hurtboxes = Array.isArray(defender.hurtboxes) && defender.hurtboxes.length > 0
    ? defender.hurtboxes
    : [{ id: 'body', x: 0, y: 0, width: defender.width, height: defender.height }];
  return hurtboxes.map((hurtbox, index) => {
    const rect = normalizeRect(hurtbox);
    return {
      id: hurtbox.id || `hurtbox-${index}`,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    };
  });
}

function buildHitDetectionState({ attackers, defenders }) {
  const contacts = [];
  const filtered = [];
  for (const attacker of attackers) {
    for (const attack of attacker.attacks.filter((entry) => entry.active)) {
      for (const hitbox of attack.hitboxes) {
        const worldHitbox = toWorldHitbox(attacker, hitbox);
        for (const defender of defenders) {
          const hurtbox = findIntersectingHurtbox(defender, worldHitbox);
          if (!hurtbox) continue;
          if (attacker.team && attacker.team === defender.team) {
            filtered.push({
              attackerId: attacker.id,
              defenderId: defender.id,
              hitboxId: hitbox.id,
              hurtboxId: hurtbox.id,
              reason: 'same-team'
            });
            continue;
          }
          contacts.push({
            id: `${attacker.id}:${attack.id}:${hitbox.id}:${defender.id}:${hurtbox.id}`,
            attackerId: attacker.id,
            defenderId: defender.id,
            attackId: attack.id,
            hitboxId: hitbox.id,
            hurtboxId: hurtbox.id,
            result: resolveContactResult(defender),
            damage: hitbox.damage,
            knockback: adjustKnockbackForFacing(hitbox.knockback, attacker.facing),
            staggerMs: hitbox.staggerMs,
            hitstopMs: attack.hitstopMs,
            tags: [...hitbox.tags],
            combo: attack.combo ? { ...attack.combo } : null,
            point: {
              x: round(Math.max(hurtbox.x, Math.min(worldHitbox.x + worldHitbox.width / 2, hurtbox.x + hurtbox.width))),
              y: round(Math.max(hurtbox.y, Math.min(worldHitbox.y + worldHitbox.height / 2, hurtbox.y + hurtbox.height)))
            }
          });
        }
      }
    }
  }
  return { contacts, filtered };
}

function buildGuardState(contacts) {
  return {
    parries: contacts
      .filter((contact) => contact.result === 'parry')
      .map((contact) => ({
        attackerId: contact.attackerId,
        defenderId: contact.defenderId,
        attackId: contact.attackId,
        parryWindowMs: contact.combo?.parryWindowMs || 100
      })),
    blocks: contacts
      .filter((contact) => contact.result === 'block')
      .map((contact) => ({
        attackerId: contact.attackerId,
        defenderId: contact.defenderId,
        attackId: contact.attackId
      }))
  };
}

function buildDamageState(contacts, defenders) {
  const defenderById = new Map(defenders.map((defender) => [defender.id, defender]));
  const events = contacts
    .filter((contact) => contact.result === 'hit')
    .map((contact) => {
      const defender = defenderById.get(contact.defenderId);
      const healthFrom = defender?.health ?? 0;
      const healthTo = Math.max(0, healthFrom - contact.damage);
      return {
        attackerId: contact.attackerId,
        defenderId: contact.defenderId,
        attackId: contact.attackId,
        hitboxId: contact.hitboxId,
        hurtboxId: contact.hurtboxId,
        damage: contact.damage,
        healthFrom,
        healthTo,
        tags: [...contact.tags],
        point: contact.point
      };
    });
  return {
    events,
    healthUpdates: events.map((event) => ({
      defenderId: event.defenderId,
      health: event.healthTo
    }))
  };
}

function buildResponseState(contacts, damageEvents) {
  const damagedIds = new Set(damageEvents.map((event) => event.defenderId));
  const hitContacts = contacts.filter((contact) => contact.result === 'hit' && damagedIds.has(contact.defenderId));
  const durationMs = hitContacts.reduce((max, contact) => Math.max(max, contact.hitstopMs), 0);
  return {
    knockbacks: hitContacts.map((contact) => ({
      targetId: contact.defenderId,
      sourceId: contact.attackerId,
      velocity: { ...contact.knockback }
    })),
    staggers: hitContacts.map((contact) => ({
      targetId: contact.defenderId,
      sourceId: contact.attackerId,
      durationMs: contact.staggerMs
    })),
    hitstop: {
      active: durationMs > 0,
      durationMs,
      actors: unique(hitContacts.flatMap((contact) => [contact.attackerId, contact.defenderId]))
    }
  };
}

function buildComboState(comboInput, contacts) {
  const hit = contacts.find((contact) => contact.result === 'hit' && contact.combo);
  const currentState = comboInput.currentState || hit?.attackId || null;
  const nextState = hit?.combo?.nextState || null;
  const bufferedInput = comboInput.bufferedInput === true;
  const windowOpen = Boolean(hit?.combo && numberOr(hit.combo.inputWindowMs, 0) > 0);
  return {
    actorId: comboInput.actorId || hit?.attackerId || null,
    currentState,
    nextState,
    chainIndex: Math.max(0, Math.floor(numberOr(comboInput.chainIndex, 0))) + (windowOpen && bufferedInput ? 1 : 0),
    windowOpen,
    inputWindowMs: numberOr(hit?.combo?.inputWindowMs, 0),
    bufferedInput
  };
}

function buildEffectsState(contacts, damageEvents) {
  const parries = contacts.filter((contact) => contact.result === 'parry');
  return {
    applied: [
      ...damageEvents.map((event) => ({
        type: 'hit-spark',
        targetId: event.defenderId,
        sourceId: event.attackerId,
        point: event.point
      })),
      ...parries.map((contact) => ({
        type: 'parry-spark',
        targetId: contact.defenderId,
        sourceId: contact.attackerId,
        point: contact.point
      })),
      ...(damageEvents.length > 0 ? [{ type: 'attack-audio', cue: 'slash-hit' }] : []),
      ...(parries.length > 0 ? [{ type: 'attack-audio', cue: 'parry' }] : [])
    ]
  };
}

function buildEventsState({ hitDetection, damage, guards, combo }) {
  return {
    queue: [
      ...damage.events.map((event) => ({
        type: 'combat:hit',
        attackerId: event.attackerId,
        defenderId: event.defenderId,
        damage: event.damage
      })),
      ...guards.parries.map((event) => ({
        type: 'combat:parry',
        attackerId: event.attackerId,
        defenderId: event.defenderId
      })),
      ...hitDetection.filtered.map((event) => ({
        type: 'combat:filtered',
        attackerId: event.attackerId,
        defenderId: event.defenderId,
        reason: event.reason
      })),
      ...(combo.windowOpen && combo.bufferedInput ? [{
        type: 'combat:combo-buffer',
        actorId: combo.actorId,
        nextState: combo.nextState
      }] : [])
    ]
  };
}

function buildEditorState() {
  return {
    format: 'omnicore.combat-2d25d-editor.v1',
    panels: [
      'CombatDirector',
      'Hitboxes',
      'Hurtboxes',
      'TeamFilters',
      'ParryWindows',
      'Knockback',
      'ComboChains',
      'RuntimeDebug'
    ],
    tools: [
      'HitboxFrameEditor',
      'HurtboxPreview',
      'TeamFilterMatrix',
      'ParryWindowTimeline',
      'KnockbackVectorTool',
      'ComboChainGraph'
    ],
    hotReloadTopics: [
      'combat:hitbox-changed',
      'combat:hurtbox-changed',
      'combat:team-filter-changed',
      'combat:parry-window-changed',
      'combat:combo-chain-changed'
    ]
  };
}

function buildRuntimeSyncState() {
  return {
    protocol: 'omnicore.runtime-sync.combat-2d25d/v1',
    payloads: [
      'hitDetection',
      'guards',
      'damage',
      'response',
      'combo',
      'effects',
      'events',
      'editor'
    ],
    events: [
      'combat:hit',
      'combat:parry',
      'combat:block',
      'combat:damage',
      'combat:knockback',
      'combat:combo-buffer'
    ]
  };
}

function buildDebugDraw({ attackers, defenders, hitDetection, response }) {
  const hitboxes = attackers.flatMap((attacker) => attacker.attacks
    .filter((attack) => attack.active)
    .flatMap((attack) => attack.hitboxes.map((hitbox) => ({
      op: 'debug:combat-hitbox',
      attackerId: attacker.id,
      attackId: attack.id,
      hitboxId: hitbox.id,
      ...toWorldHitbox(attacker, hitbox)
    }))));
  const hurtboxes = defenders.flatMap((defender) => defender.hurtboxes.map((hurtbox) => ({
    op: 'debug:combat-hurtbox',
    defenderId: defender.id,
    hurtboxId: hurtbox.id,
    x: defender.x + hurtbox.x,
    y: defender.y + hurtbox.y,
    width: hurtbox.width,
    height: hurtbox.height
  })));
  return [
    ...hitboxes,
    ...hurtboxes,
    ...hitDetection.contacts.map((contact) => ({ op: 'debug:combat-contact', ...contact })),
    ...response.knockbacks.map((knockback) => ({ op: 'debug:combat-knockback', ...knockback })),
    ...hitDetection.contacts
      .filter((contact) => contact.result === 'parry')
      .map((contact) => ({ op: 'debug:combat-parry', ...contact }))
  ];
}

function buildQualityChecks({ hitDetection, guards, damage, response, editor, runtimeSync }) {
  return {
    checks: [
      {
        id: 'combat-hit-detection',
        pass: hitDetection.contacts.length > 0,
        detail: `${hitDetection.contacts.length} contacts`
      },
      {
        id: 'combat-team-filter',
        pass: hitDetection.filtered.some((entry) => entry.reason === 'same-team'),
        detail: `${hitDetection.filtered.length} filtered`
      },
      {
        id: 'combat-guard-resolution',
        pass: guards.parries.length > 0 || guards.blocks.length > 0,
        detail: `${guards.parries.length} parries`
      },
      {
        id: 'combat-damage-response',
        pass: damage.events.length > 0 && response.knockbacks.length > 0,
        detail: `${damage.events.length} damage events`
      },
      {
        id: 'editor-runtime-combat-sync',
        pass: editor.panels.length > 0 && runtimeSync.payloads.includes('damage'),
        detail: runtimeSync.protocol
      }
    ]
  };
}

function toWorldHitbox(attacker, hitbox) {
  const x = attacker.facing === 'left'
    ? attacker.x - hitbox.x - hitbox.width
    : attacker.x + hitbox.x;
  return {
    x: round(x),
    y: round(attacker.y + hitbox.y),
    width: hitbox.width,
    height: hitbox.height
  };
}

function findIntersectingHurtbox(defender, worldHitbox) {
  for (const hurtbox of defender.hurtboxes) {
    const worldHurtbox = {
      id: hurtbox.id,
      x: defender.x + hurtbox.x,
      y: defender.y + hurtbox.y,
      width: hurtbox.width,
      height: hurtbox.height
    };
    if (rectIntersects(worldHitbox, worldHurtbox)) return worldHurtbox;
  }
  return null;
}

function resolveContactResult(defender) {
  if (!defender.guard.active) return 'hit';
  if (defender.guard.elapsedMs <= defender.guard.parryWindowMs) return 'parry';
  return 'block';
}

function adjustKnockbackForFacing(knockback, facing) {
  return {
    x: facing === 'left' ? -Math.abs(knockback.x) : Math.abs(knockback.x),
    y: knockback.y
  };
}

function normalizeRect(rect = {}) {
  return {
    x: numberOr(rect.x, 0),
    y: numberOr(rect.y, 0),
    width: Math.max(0, numberOr(rect.width ?? rect.w, 0)),
    height: Math.max(0, numberOr(rect.height ?? rect.h, 0))
  };
}

function rectIntersects(left, right) {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

function unique(values) {
  return [...new Set(values)];
}

function numberOr(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function round(value) {
  return Math.round(numberOr(value, 0) * 1000) / 1000;
}

export default createCombat2D25DDirectorStep;
