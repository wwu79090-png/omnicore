import GameplayTags from '../GameplayTags.js';

export class QueryFilter {
  constructor(world) {
    this.world = world;
    this.componentNames = [];
    this.tagQueries = [];
    this.changedComponents = [];
  }

  static with(world) {
    return new QueryFilter(world);
  }

  components(names = []) {
    this.componentNames = Array.isArray(names) ? names : [names];
    return this;
  }

  tags(tags = []) {
    this.tagQueries = Array.isArray(tags) ? tags : [tags];
    return this;
  }

  changed(names = []) {
    this.changedComponents = Array.isArray(names) ? names : [names];
    return this;
  }

  entities() {
    const ids = [];
    this.world.query(this.componentNames).forEach((entityId) => {
      if (!this._tagsMatch(entityId)) return;
      if (!this._changedMatch(entityId)) return;
      ids.push(entityId);
    });
    return ids;
  }

  _tagsMatch(entityId) {
    if (!this.tagQueries.length) return true;
    return GameplayTags.create(this.world.getTags?.(entityId) || []).matchesAll(this.tagQueries);
  }

  _changedMatch(entityId) {
    if (!this.changedComponents.length) return true;
    return this.changedComponents.every((name) => this.world.isChanged?.(entityId, name));
  }
}

export default QueryFilter;
