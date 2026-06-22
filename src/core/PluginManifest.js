export class PluginManifest {
  constructor(config = {}) {
    this.name = String(config.name || '').trim();
    this.version = String(config.version || '0.0.0');
    this.engines = { ...(config.engines || {}) };
    this.runtimeEntry = config.runtimeEntry || config.entry || config.main || null;
    this.editorEntry = config.editorEntry || config.editor || null;
    this.permissions = [...new Set(config.permissions || [])].sort();
    this.kind = resolveKind(config.kind, this.runtimeEntry, this.editorEntry);
    this.meta = { ...(config.meta || {}) };
  }

  static create(config = {}) {
    return new PluginManifest(config);
  }

  validate() {
    const errors = [];
    const warnings = [];
    if (!this.name) errors.push({ code: 'missing-plugin-name', message: 'Plugin manifest requires a name.' });
    if (!this.runtimeEntry && !this.editorEntry) {
      errors.push({ code: 'missing-plugin-entry', message: 'Plugin manifest requires a runtime or editor entry.' });
    }
    if (!this.engines.omnicore) warnings.push({ code: 'missing-omnicore-engine-range', message: 'Declare engines.omnicore for compatibility checks.' });
    return { ok: errors.length === 0, errors, warnings };
  }

  toJSON() {
    return {
      name: this.name,
      version: this.version,
      kind: this.kind,
      engines: { ...this.engines },
      runtimeEntry: this.runtimeEntry,
      editorEntry: this.editorEntry,
      permissions: [...this.permissions],
      meta: { ...this.meta }
    };
  }
}

function resolveKind(kind, runtimeEntry, editorEntry) {
  if (kind) return kind;
  if (runtimeEntry && editorEntry) return 'hybrid';
  if (editorEntry) return 'editor';
  return 'runtime';
}

export default PluginManifest;
