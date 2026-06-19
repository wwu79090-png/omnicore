import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(moduleDir, '..', '..');
export const defaultGoldenPath = path.join(root, 'tests', 'contract', 'golden', 'omnicore-core-api.json');

/**
 * @param {object} OmniCore Public OmniCore namespace.
 * @returns {object} Stable API contract snapshot.
 */
export function buildApiContract(OmniCore) {
  const rendererNamespace = OmniCore.Renderer || {};

  return sortObject({
    schemaVersion: 1,
    package: 'omnicore',
    defaultExport: {
      keys: sortedKeys(OmniCore),
      functions: describeFunctionMap(OmniCore)
    },
    Game: describeClass(OmniCore.Game, () => new OmniCore.Game({
      headless: true,
      autoStart: false,
      autoAttach: false,
      renderer: 'canvas'
    })),
    Store: describeClass(OmniCore.Store, () => new OmniCore.Store({ score: 0 })),
    Renderer: {
      keys: sortedKeys(rendererNamespace),
      functions: describeFunctionMap(rendererNamespace),
      RendererManager: describeClass(rendererNamespace.RendererManager, () => new rendererNamespace.RendererManager()),
      PixiRenderer: describeClass(rendererNamespace.PixiRenderer, () => new rendererNamespace.PixiRenderer({
        backend: 'canvas',
        canvas: null,
        width: 320,
        height: 180
      })),
      RenderLayerManager: describeClass(rendererNamespace.RenderLayerManager, () => new rendererNamespace.RenderLayerManager())
    }
  });
}

/**
 * @param {string} filePath Golden contract path.
 * @returns {object} Parsed golden contract.
 */
export function loadGoldenContract(filePath = defaultGoldenPath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

export function writeGoldenContract(contract, filePath = defaultGoldenPath) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(sortObject(contract), null, 2)}\n`);
}

/**
 * @param {object} actual Actual contract.
 * @param {object} expected Golden contract.
 * @returns {object[]} Contract differences.
 */
export function diffContracts(actual, expected) {
  const diffs = [];
  walkDiff('', sortObject(actual), sortObject(expected), diffs);
  return diffs;
}

function describeClass(Ctor, createInstance) {
  if (typeof Ctor !== 'function') return null;
  const instance = createInstance();
  return {
    name: Ctor.name,
    arity: Ctor.length,
    staticMethods: describeFunctionMap(Ctor, ['length', 'name', 'prototype']),
    prototypeMethods: describePrototype(Ctor),
    instanceProperties: describeOwnProperties(instance)
  };
}

function describePrototype(Ctor) {
  return Object.getOwnPropertyNames(Ctor.prototype || {})
    .filter((name) => name !== 'constructor')
    .sort()
    .map((name) => describeDescriptor(name, Object.getOwnPropertyDescriptor(Ctor.prototype, name)));
}

function describeFunctionMap(target, excluded = []) {
  const excludedSet = new Set(excluded);
  return Object.getOwnPropertyNames(target || {})
    .filter((name) => !excludedSet.has(name))
    .filter((name) => typeof target[name] === 'function')
    .sort()
    .map((name) => describeFunction(name, target[name]));
}

function describeOwnProperties(instance) {
  return Object.getOwnPropertyNames(instance || {})
    .sort()
    .map((name) => {
      const descriptor = Object.getOwnPropertyDescriptor(instance, name);
      return {
        name,
        kind: descriptorKind(descriptor),
        valueType: valueType(descriptor?.value)
      };
    });
}

function describeDescriptor(name, descriptor) {
  return {
    name,
    kind: descriptorKind(descriptor),
    arity: typeof descriptor?.value === 'function' ? descriptor.value.length : null,
    async: typeof descriptor?.value === 'function' && descriptor.value.constructor.name === 'AsyncFunction'
  };
}

function describeFunction(name, value) {
  return {
    name,
    arity: value.length,
    async: value.constructor.name === 'AsyncFunction'
  };
}

function descriptorKind(descriptor) {
  if (!descriptor) return 'missing';
  if (typeof descriptor.value === 'function') return 'method';
  if ('value' in descriptor) return 'property';
  if (descriptor.get && descriptor.set) return 'accessor:get-set';
  if (descriptor.get) return 'accessor:get';
  if (descriptor.set) return 'accessor:set';
  return 'descriptor';
}

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Map) return 'Map';
  if (value instanceof Set) return 'Set';
  if (typeof value === 'object') return value.constructor?.name || 'object';
  return typeof value;
}

function sortedKeys(value) {
  return Object.keys(value || {}).sort();
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = sortObject(value[key]);
      return result;
    }, {});
}

function walkDiff(pointer, actual, expected, diffs) {
  if (Object.is(actual, expected)) return;
  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) {
      diffs.push({ path: pointer || '/', actual, expected });
      return;
    }
    const max = Math.max(actual.length, expected.length);
    for (let index = 0; index < max; index += 1) {
      walkDiff(`${pointer}/${index}`, actual[index], expected[index], diffs);
    }
    return;
  }
  if (isPlainObject(actual) && isPlainObject(expected)) {
    const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
    for (const key of [...keys].sort()) {
      walkDiff(`${pointer}/${key}`, actual[key], expected[key], diffs);
    }
    return;
  }
  diffs.push({ path: pointer || '/', actual, expected });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--output');
  const goldenPath = outputIndex >= 0 ? path.resolve(args[outputIndex + 1]) : defaultGoldenPath;
  const OmniCore = (await import('../../src/index.js')).default;
  const contract = buildApiContract(OmniCore);

  if (args.includes('--update')) {
    writeGoldenContract(contract, goldenPath);
    console.log(`[OmniCore] API contract snapshot updated: ${path.relative(root, goldenPath)}`);
    process.exit(0);
  }

  const expected = loadGoldenContract(goldenPath);
  const diff = diffContracts(contract, expected);
  if (diff.length) {
    console.error(JSON.stringify(diff, null, 2));
    process.exit(1);
  }
  console.log('[OmniCore] API contract snapshot matches golden file.');
}
