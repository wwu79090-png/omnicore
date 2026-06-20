/**
 * Translates legacy JSON/config shapes into OmniCore-friendly data.
 */
export class DataAdapter {
  constructor({ fields = {} } = {}) {
    this.fields = new Map();
    Object.entries(fields || {}).forEach(([from, rule]) => {
      if (typeof rule === 'string') this.mapField(from, rule);
      else this.mapField(from, rule?.to || from, rule?.transform || null);
    });
  }

  mapField(from, to, transform = null) {
    this.fields.set(String(from), {
      to: String(to || from),
      transform: typeof transform === 'function' ? transform : null
    });
    return this;
  }

  adapt(value) {
    if (Array.isArray(value)) return value.map((item) => this.adapt(item));
    if (!value || typeof value !== 'object') return value;
    const output = {};
    Object.entries(value).forEach(([key, raw]) => {
      const rule = this.fields.get(key);
      const nextKey = rule?.to || key;
      const nextValue = rule?.transform ? rule.transform(raw, { key, value }) : this.adapt(raw);
      output[nextKey] = nextValue;
    });
    return output;
  }

  static adapt(value, fields = {}) {
    return new DataAdapter({ fields }).adapt(value);
  }

  static fromPhaserSave(save = {}) {
    return {
      player: normalizePhaserPlayer(save.player || save.players?.[0] || {}),
      store: {
        ...(save.registry?.values || {}),
        ...(save.store || {})
      },
      scene: save.scene?.key || save.sceneKey || save.currentScene || null
    };
  }
}

function normalizePhaserPlayer(player = {}) {
  const output = { ...player };
  if (output.health != null && output.hp == null) {
    output.hp = output.health;
    delete output.health;
  }
  return output;
}

export default DataAdapter;
