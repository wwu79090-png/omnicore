import { createOmniError } from '../core/OmniError.js';

export class SaveGameArchive {
  constructor() {
    this.schemas = new Map();
    this.records = new Map();
  }

  registerSchema(name, { version = 1, migrate = null } = {}) {
    this.schemas.set(String(name), {
      name: String(name),
      version: Number(version || 1),
      migrate
    });
    return this;
  }

  save(slot, { userId = 'default', schema = 'default', version = 1, data = {} } = {}) {
    const record = {
      slot: String(slot),
      userId: String(userId),
      schema: String(schema),
      version: Number(version || 1),
      data: clone(data)
    };
    this.records.set(recordKey(record.slot, record.userId), record);
    return clone(record);
  }

  load(slot, { userId = 'default' } = {}) {
    const key = recordKey(slot, userId);
    const record = this.records.get(key);
    if (!record) throw createOmniError('SaveGameArchive', `Save slot is not registered: ${slot}`);
    return this._migrate(clone(record));
  }

  listSlots(userId = 'default') {
    const owner = String(userId);
    return [...this.records.values()]
      .filter((record) => record.userId === owner)
      .map((record) => record.slot)
      .sort();
  }

  _migrate(record) {
    const schema = this.schemas.get(record.schema);
    if (!schema || record.version >= schema.version) return record;
    if (typeof schema.migrate !== 'function') {
      throw createOmniError('SaveGameArchive', `Save schema requires migration: ${record.schema}`);
    }
    const migrated = schema.migrate(clone(record));
    if (!migrated || migrated.version < schema.version) {
      throw createOmniError('SaveGameArchive', `Save schema migration did not reach version ${schema.version}: ${record.schema}`);
    }
    this.records.set(recordKey(migrated.slot, migrated.userId), clone(migrated));
    return clone(migrated);
  }
}

function recordKey(slot, userId) {
  return `${String(userId)}::${String(slot)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default SaveGameArchive;
