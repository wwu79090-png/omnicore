import { createOmniError } from '../core/OmniError.js';

/**
 * JSON RPG data center for items, enemies, skills, and states.
 *
 * @example
 * await DB.load({ items: '/config/items.json' });
 * const potion = DB.get('items', 'potion');
 */
export class Database {
  constructor({ fetcher = globalThis.fetch?.bind(globalThis), initialData = {} } = {}) {
    this.fetcher = fetcher;
    this.tables = new Map();
    Object.entries(initialData).forEach(([type, records]) => this.loadConfig(type, records));
  }

  async load(sources = {}) {
    const entries = Object.entries(sources);
    await Promise.all(entries.map(async ([type, source]) => {
      const records = typeof source === 'string' ? await this._fetchJSON(source) : source;
      this.loadConfig(type, records);
    }));
    return this;
  }

  loadConfig(type, records = {}) {
    const table = new Map();
    const list = Array.isArray(records) ? records : Object.values(records);
    list.forEach((record) => {
      if (!record?.id) throw createOmniError('Database', `数据表 "${type}" 中存在缺少 id 的记录。`);
      table.set(record.id, { ...record });
    });
    this.tables.set(type, table);
    return this;
  }

  register(type, id, record) {
    if (!this.tables.has(type)) this.tables.set(type, new Map());
    this.tables.get(type).set(id, { id, ...record });
    return this.tables.get(type).get(id);
  }

  get(type, id) {
    return this.tables.get(type)?.get(id) || null;
  }

  all(type) {
    return [...(this.tables.get(type)?.values() || [])];
  }

  snapshot() {
    const output = {};
    for (const [type, table] of this.tables) {
      output[type] = Object.fromEntries(table);
    }
    return output;
  }

  async _fetchJSON(url) {
    if (!this.fetcher) throw createOmniError('Database', '加载远程数据需要可用的 fetcher。');
    const response = await this.fetcher(url);
    if (!response.ok) throw createOmniError('Database', `数据源加载失败：${url}`);
    return response.json();
  }
}

export const DB = new Database();

export default Database;
