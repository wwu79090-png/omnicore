import { warnMessage } from './OmniError.js';

/**
 * Deprecated API registry and forwarding helpers.
 *
 * @example
 * await Deprecation.forward({
 *   api: 'OmniCore.Backend.use',
 *   since: '0.2.0',
 *   removeIn: '1.0.0',
 *   replacement: 'OmniCore.Backend.switch',
 *   target: () => OmniCore.Backend.switch('canvas')
 * });
 */
export const DEPRECATED_APIS = [
  {
    api: 'OmniCore.Game',
    since: '0.3.0',
    removeIn: '2.0.0',
    replacement: 'OmniCore.createGame',
    pattern: 'new OmniCore.Game('
  },
  {
    api: 'Store.set',
    since: '0.3.0',
    removeIn: '2.0.0',
    replacement: 'Store.setValue',
    pattern: 'Store.set('
  },
  {
    api: 'Entity.create',
    since: '0.3.0',
    removeIn: '2.0.0',
    replacement: 'Entity.createEntity',
    pattern: 'Entity.create('
  },
  {
    api: 'OmniCore.Backend.use',
    since: '0.2.0',
    removeIn: '1.0.0',
    replacement: 'OmniCore.Backend.switch',
    pattern: 'OmniCore.Backend.use('
  },
  {
    api: 'OmniCore.Storage.read',
    since: '0.2.0',
    removeIn: '1.0.0',
    replacement: 'OmniCore.Storage.get',
    pattern: 'OmniCore.Storage.read('
  },
  {
    api: 'OmniCore.Storage.write',
    since: '0.2.0',
    removeIn: '1.0.0',
    replacement: 'OmniCore.Storage.set',
    pattern: 'OmniCore.Storage.write('
  }
];

export class Deprecation {
  static registry = DEPRECATED_APIS;

  static message({ api, since, removeIn, replacement }) {
    return warnMessage('Deprecation', `已废弃 API ${api}，自 ${since} 起废弃，将在 ${removeIn} 移除；请改用 ${replacement}。`);
  }

  static warn(entry) {
    const message = Deprecation.message(entry);
    console.warn(message);
    return message;
  }

  static async forward(entry) {
    Deprecation.warn(entry);
    return entry.target(...(entry.args || []));
  }

  static find(api) {
    return Deprecation.registry.find((entry) => entry.api === api);
  }
}

export default Deprecation;
