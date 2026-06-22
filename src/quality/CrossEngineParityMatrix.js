export const CROSS_ENGINE_SOURCE_DOCS = Object.freeze({
  phaser: { label: 'Phaser', context7: '/phaserjs/phaser' },
  godot: { label: 'Godot', docs: 'https://docs.godotengine.org/' },
  cocosCreator: { label: 'Cocos Creator', docs: 'https://docs.cocos.com/creator/manual/' },
  pixijs: { label: 'PixiJS', context7: '/pixijs/pixijs' },
  threePhysics: { label: 'Three.js + Physics', context7: '/mrdoob/three.js' }
});

export class CrossEngineParityMatrix {
  constructor({ sources = {} } = {}) {
    this.sources = normalizeSources(sources);
  }

  evaluate({ implemented = {} } = {}) {
    const sourceReports = {};
    const missingCapabilities = [];
    let requiredCapabilityCount = 0;
    let coveredCapabilityCount = 0;

    for (const [source, required] of Object.entries(this.sources)) {
      const implementedSet = new Set(normalizeArray(implemented[source]).map(String));
      const covered = required.filter((capability) => implementedSet.has(capability));
      const missing = required.filter((capability) => !implementedSet.has(capability));
      requiredCapabilityCount += required.length;
      coveredCapabilityCount += covered.length;
      sourceReports[source] = {
        source,
        label: CROSS_ENGINE_SOURCE_DOCS[source]?.label || source,
        required: [...required],
        covered,
        missing,
        score: required.length ? Math.round((covered.length / required.length) * 100) : 100
      };
      for (const capability of missing) missingCapabilities.push({ source, capability });
    }

    const coverageScore = requiredCapabilityCount
      ? Math.round((coveredCapabilityCount / requiredCapabilityCount) * 100)
      : 100;

    return {
      generatedBy: 'OmniCore cross-engine parity matrix',
      sourceDocs: clone(CROSS_ENGINE_SOURCE_DOCS),
      summary: {
        sourceCount: Object.keys(this.sources).length,
        requiredCapabilityCount,
        coveredCapabilityCount,
        coverageScore,
        ready: missingCapabilities.length === 0
      },
      sources: sourceReports,
      missingCapabilities
    };
  }
}

function normalizeSources(sources) {
  return Object.fromEntries(
    Object.entries(sources || {}).map(([source, capabilities]) => [
      String(source),
      normalizeArray(capabilities).map(String)
    ])
  );
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default CrossEngineParityMatrix;
