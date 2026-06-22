import GameplayTags from '../core/GameplayTags.js';

export class AbilitySystem {
  constructor({ abilities = [], now = () => Date.now() } = {}) {
    this.now = now;
    this.abilities = new Map(abilities.map((ability) => [ability.id, normalizeAbility(ability)]));
    this.cooldowns = new Map();
  }

  cast(id, actor = {}, context = {}) {
    const ability = this.abilities.get(id);
    if (!ability) return { ok: false, reason: 'missing-ability' };
    if (!GameplayTags.create(actor.tags || []).matchesAll(ability.requiredTags)) {
      return { ok: false, reason: 'missing-tags' };
    }
    const readyAt = this.cooldowns.get(cooldownKey(actor, id)) || 0;
    const currentTime = Number(this.now());
    if (currentTime < readyAt) return { ok: false, reason: 'cooldown', readyAt };
    for (const [resource, cost] of Object.entries(ability.cost)) {
      if (Number(actor[resource] || 0) < Number(cost || 0)) return { ok: false, reason: 'cost', resource };
    }
    for (const effect of ability.effects) applyEffect(actor, effect, context);
    this.cooldowns.set(cooldownKey(actor, id), currentTime + ability.cooldownMs);
    return { ok: true, ability, actor };
  }
}

function normalizeAbility(ability = {}) {
  return {
    id: ability.id,
    cost: { ...(ability.cost || {}) },
    cooldownMs: Number(ability.cooldownMs || 0),
    requiredTags: [...(ability.requiredTags || [])],
    effects: [...(ability.effects || [])]
  };
}

function cooldownKey(actor, id) {
  return `${actor.id || 'actor'}:${id}`;
}

function applyEffect(actor, effect = {}) {
  if (effect.op === 'addTag') {
    actor.tags = [...new Set([...(actor.tags || []), effect.tag])];
    return;
  }
  if (effect.op === 'removeTag') {
    actor.tags = (actor.tags || []).filter((tag) => tag !== effect.tag);
    return;
  }
  if (effect.op === 'inc') {
    actor[effect.path] = Number(actor[effect.path] || 0) + Number(effect.value || 0);
    return;
  }
  if (effect.op === 'set') actor[effect.path] = effect.value;
}

export default AbilitySystem;
