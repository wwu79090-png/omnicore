const CAPABILITY_MODULE = Object.freeze({
  'arcade-physics': 'physics',
  'physics-adapter': 'physics',
  tilemaps: 'tilemap',
  resources: 'assets',
  'asset-db': 'assets',
  'texture-gc': 'renderer',
  materials: 'renderer',
  'component-editor': 'editor',
  'animation-tree': 'animation'
});

const P0_CAPABILITIES = new Set(['arcade-physics', 'physics-adapter', 'tilemaps']);

export class EngineAdvantageAssimilator {
  constructor({ engineModules = {} } = {}) {
    this.engineModules = normalizeModules(engineModules);
  }

  assimilate(missingCapabilities = []) {
    const adoptions = normalizeArray(missingCapabilities).map((item) => {
      const source = String(item.source || 'engine');
      const capability = String(item.capability || item);
      const nativeModule = findNativeModule(this.engineModules, capability);
      const module = nativeModule || CAPABILITY_MODULE[capability] || 'runtime';
      return {
        source,
        capability,
        module,
        strategy: nativeModule ? 'harden-existing' : 'extend-module',
        priority: P0_CAPABILITIES.has(capability) ? 'P0' : 'P1'
      };
    });

    return {
      generatedBy: 'OmniCore engine advantage assimilator',
      summary: {
        adoptionCount: adoptions.length,
        nativeCount: adoptions.filter((adoption) => adoption.strategy === 'harden-existing').length,
        extensionCount: adoptions.filter((adoption) => adoption.strategy === 'extend-module').length
      },
      adoptions
    };
  }
}

function normalizeModules(modules) {
  return Object.fromEntries(
    Object.entries(modules || {}).map(([module, capabilities]) => [
      String(module),
      new Set(normalizeArray(capabilities).map(String))
    ])
  );
}

function findNativeModule(modules, capability) {
  for (const [module, capabilities] of Object.entries(modules)) {
    if (capabilities.has(capability)) return module;
  }
  return null;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default EngineAdvantageAssimilator;
