import { createOmniError as omniError } from '../core/OmniError.js';

const DEFAULT_EDITOR_PLUGIN_STAGES = ['manifest', 'schema', 'panel', 'debug', 'export'];

/**
 * Ordered editor plugin cascade for official editor integrations.
 *
 * Each layer can be installed independently, while full editor hosts can run
 * the complete manifest -> schema -> panel -> debug -> export chain.
 */
export class EditorPluginCascade {
  constructor({ stages = DEFAULT_EDITOR_PLUGIN_STAGES, store = null } = {}) {
    this.stages = [...stages];
    this.store = store;
    this.records = new Map(this.stages.map((stage) => [stage, []]));
    this.activations = [];
  }

  register(stageOrPlugin, maybePlugin = null) {
    const plugin = maybePlugin || stageOrPlugin;
    const stage = maybePlugin ? stageOrPlugin : plugin?.stage || plugin?.type || 'panel';
    if (!this.records.has(stage)) {
      throw omniError('EditorPluginCascade', `Unknown editor plugin stage: ${stage}`);
    }
    const record = {
      id: plugin.id || plugin.name || `${stage}-${this.records.get(stage).length + 1}`,
      stage,
      plugin
    };
    this.records.get(stage).push(record);
    this._publish();
    return record;
  }

  registerMany(plugins = []) {
    return plugins.map((plugin) => this.register(plugin));
  }

  async activate(context = {}) {
    const activations = [];
    for (const stage of this.stages) {
      for (const record of this.records.get(stage) || []) {
        const result = await this._activateRecord(record, context);
        activations.push({ id: record.id, stage, result });
      }
    }
    this.activations = activations;
    this._publish();
    return activations;
  }

  snapshot() {
    return {
      stages: [...this.stages],
      plugins: this.stages.flatMap((stage) => (this.records.get(stage) || []).map((record) => ({
        id: record.id,
        stage: record.stage
      }))),
      activations: this.activations.map((activation) => ({
        id: activation.id,
        stage: activation.stage
      }))
    };
  }

  _publish() {
    this.store?.set?.('editor:pluginCascade', this.snapshot());
  }

  async _activateRecord(record, context) {
    const api = {
      cascade: this,
      stage: record.stage,
      store: context.store || this.store || null,
      editor: context.editor || null,
      game: context.game || null
    };
    if (typeof record.plugin === 'function') return record.plugin(api);
    if (typeof record.plugin.activate === 'function') return record.plugin.activate(api);
    if (typeof record.plugin.install === 'function') return record.plugin.install(api);
    return record.plugin.exports || null;
  }
}

export { DEFAULT_EDITOR_PLUGIN_STAGES };
export default EditorPluginCascade;
