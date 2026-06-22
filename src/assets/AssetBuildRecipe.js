export class AssetBuildRecipe {
  constructor({ sourceRoot = 'source-assets', outputRoot = 'dist/assets', builders = {} } = {}) {
    this.sourceRoot = normalizePath(sourceRoot);
    this.outputRoot = normalizePath(outputRoot);
    this.builders = clone(builders || {});
  }

  plan(sources = []) {
    const products = normalizeArray(sources)
      .map((source) => this._productFor(source))
      .sort((left, right) => left.path.localeCompare(right.path));
    return {
      sourceRoot: this.sourceRoot,
      outputRoot: this.outputRoot,
      products,
      bundles: groupBundles(products)
    };
  }

  _productFor(source = {}) {
    const inputPath = normalizePath(source.path || source.src || source.source || '');
    const builder = this.builders[source.type] || {};
    const relative = stripRoot(inputPath, this.sourceRoot);
    const outExt = builder.outExt || extname(inputPath);
    const outputPath = joinPath(this.outputRoot, replaceExt(relative, outExt));
    return {
      source: inputPath,
      type: source.type || inferType(inputPath),
      path: outputPath,
      bundle: builder.bundle || source.bundle || 'default',
      dependencies: normalizeArray(source.deps || source.dependencies).map(normalizePath).sort(),
      cacheKey: stableHash({
        source: inputPath,
        type: source.type || inferType(inputPath),
        output: outputPath,
        deps: normalizeArray(source.deps || source.dependencies)
      })
    };
  }
}

function groupBundles(products) {
  const bundles = {};
  for (const product of products) {
    if (!bundles[product.bundle]) bundles[product.bundle] = [];
    bundles[product.bundle].push(product.path);
  }
  return Object.fromEntries(Object.entries(bundles).sort(([left], [right]) => left.localeCompare(right)));
}

function stripRoot(inputPath, root) {
  const prefix = `${root.replace(/\/$/u, '')}/`;
  return inputPath.startsWith(prefix) ? inputPath.slice(prefix.length) : inputPath;
}

function replaceExt(file, nextExt) {
  return file.replace(/\.[^/.]+$/u, nextExt.startsWith('.') ? nextExt : `.${nextExt}`);
}

function extname(file) {
  const match = String(file).match(/\.[^/.]+$/u);
  return match ? match[0] : '';
}

function inferType(file) {
  if (/\.(png|jpg|jpeg|webp|gif)$/iu.test(file)) return 'image';
  if (/\.(mp3|ogg|wav|m4a)$/iu.test(file)) return 'audio';
  if (/\.(json|csv|tmx)$/iu.test(file)) return 'data';
  return 'asset';
}

function joinPath(...parts) {
  return parts.map((part) => normalizePath(part).replace(/^\/+|\/+$/gu, '')).filter(Boolean).join('/');
}

function normalizePath(value) {
  return String(value || '').replace(/\\/gu, '/');
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function stableHash(value) {
  const text = stableStringify(value);
  let hash = 0;
  for (const char of text) hash = (hash * 33 + char.charCodeAt(0)) % 4294967291;
  return `asset:${hash.toString(16)}`;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${key}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default AssetBuildRecipe;
