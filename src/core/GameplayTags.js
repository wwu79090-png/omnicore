export class GameplayTagContainer {
  constructor(tags = []) {
    this.tags = new Set(normalizeTags(tags));
  }

  has(query) {
    const normalized = normalizeTag(query);
    for (const tag of this.tags) {
      if (tag === normalized || tag.startsWith(`${normalized}.`) || normalized.startsWith(`${tag}.`)) return true;
    }
    return false;
  }

  matchesAny(queries = []) {
    return normalizeTags(queries).some((query) => this.has(query));
  }

  matchesAll(queries = []) {
    return normalizeTags(queries).every((query) => this.has(query));
  }

  add(tag) {
    this.tags.add(normalizeTag(tag));
    return this;
  }

  toArray() {
    return [...this.tags].sort();
  }
}

export const GameplayTags = {
  create(tags = []) {
    return new GameplayTagContainer(tags);
  },

  filter(query, items = []) {
    return items.filter((item) => GameplayTags.create(item.tags || []).has(query));
  },

  normalize: normalizeTag
};

function normalizeTags(tags = []) {
  return (Array.isArray(tags) ? tags : [tags]).map(normalizeTag).filter(Boolean);
}

function normalizeTag(tag = '') {
  return String(tag || '').trim().replace(/\s+/gu, '').replace(/^\.+|\.+$/gu, '');
}

export default GameplayTags;
