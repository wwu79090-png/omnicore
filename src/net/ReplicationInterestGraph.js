export class ReplicationInterestGraph {
  constructor({ cellSize = 256 } = {}) {
    this.cellSize = Math.max(1, Number(cellSize) || 256);
    this.actors = new Map();
  }

  addActor(id, config = {}) {
    const key = String(id);
    this.actors.set(key, {
      id: key,
      x: Number(config.x) || 0,
      y: Number(config.y) || 0,
      owner: config.owner == null ? null : String(config.owner),
      team: config.team == null ? null : String(config.team),
      alwaysRelevant: Boolean(config.alwaysRelevant),
      dormant: Boolean(config.dormant)
    });
    return this;
  }

  gatherForClient({ id = '', x = 0, y = 0, radius = this.cellSize, team = null } = {}) {
    const client = {
      id: String(id),
      x: Number(x) || 0,
      y: Number(y) || 0,
      radius: Math.max(0, Number(radius) || 0),
      team: team == null ? null : String(team)
    };
    const buckets = {
      always: [],
      owner: [],
      team: [],
      spatial: []
    };
    const skippedDormant = [];

    for (const actor of [...this.actors.values()].sort((a, b) => a.id.localeCompare(b.id))) {
      const spatiallyRelevant = distance(actor, client) <= client.radius;
      if (actor.dormant) {
        if (spatiallyRelevant) skippedDormant.push(actor.id);
        continue;
      }
      if (actor.alwaysRelevant) buckets.always.push({ id: actor.id, reason: 'always' });
      else if (actor.owner && actor.owner === client.id) buckets.owner.push({ id: actor.id, reason: 'owner' });
      else if (actor.team && actor.team === client.team) buckets.team.push({ id: actor.id, reason: 'team' });
      else if (spatiallyRelevant) buckets.spatial.push({ id: actor.id, reason: 'spatial' });
    }

    return {
      clientId: client.id,
      actors: [...buckets.always, ...buckets.owner, ...buckets.team, ...buckets.spatial],
      skippedDormant: skippedDormant.sort()
    };
  }

  cellFor({ x = 0, y = 0 } = {}) {
    return {
      x: Math.floor((Number(x) || 0) / this.cellSize),
      y: Math.floor((Number(y) || 0) / this.cellSize)
    };
  }
}

function distance(actor, client) {
  return Math.hypot(actor.x - client.x, actor.y - client.y);
}

export default ReplicationInterestGraph;
