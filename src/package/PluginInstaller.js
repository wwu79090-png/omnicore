import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createOmniError } from '../core/OmniError.js';

const execFileAsync = promisify(execFile);
const REQUIRED_PLUGIN_FIELDS = ['name', 'displayName', 'version', 'main', 'author', 'license'];
const PRIVILEGED_PLUGIN_PERMISSIONS = new Set(['filesystem', 'network', 'payment', 'native', 'process']);
const BLOCKED_PLUGIN_FILE_PATTERNS = [
  /^\.github\/workflows\//iu,
  /^\.npmrc$/iu,
  /^\.yarnrc(?:\.yml)?$/iu,
  /^\.pnpmfile\.cjs$/iu,
  /(^|\/)(preinstall|postinstall|install)\.(?:js|cjs|mjs|sh|ps1|bat|cmd)$/iu
];
const SHA256_PATTERN = /^[a-f0-9]{64}$/iu;

export class PluginInstaller {
  constructor({
    root = process.cwd(),
    addonsDir = path.join(root, 'addons'),
    downloader = null,
    unzipper = null,
    payment = null,
    decryptor = null,
    execFileImpl = execFileAsync,
    now = () => Date.now()
  } = {}) {
    this.root = path.resolve(root);
    this.addonsDir = path.resolve(addonsDir);
    this.downloader = downloader || ((request) => this.download(request));
    this.unzipper = unzipper;
    this.payment = payment || new ConsolePaymentGateway();
    this.decryptor = decryptor || new PassthroughDecryptor();
    this.execFileImpl = execFileImpl;
    this.now = now;
  }

  async install(name, { source = null, version = 'latest', manifest = null } = {}) {
    const request = {
      name,
      source: source || inferSource(name),
      version
    };
    let bundle = await this.downloader(request);
    let pluginManifest = normalizeManifest(bundle?.manifest || manifest || manifestFromFiles(bundle?.files), name);
    let manifestReview = auditPluginManifest(pluginManifest);
    if (!manifestReview.ok) throw dangerousBundleError(reviewWithAvailableFiles(manifestReview, bundle));

    let receipt = null;
    if (pluginManifest.isPaid) {
      receipt = await this.payment.requestPayment({
        plugin: pluginManifest.name,
        amountCents: Number(pluginManifest.priceCents || 0),
        provider: pluginManifest.paymentProvider || 'qrcode',
        manifest: pluginManifest
      });
      if (!receipt?.ok) throw pluginInstallerError(`Paid plugin install cancelled: ${pluginManifest.name}`);
      if (bundle?.encrypted) {
        bundle = await this.decryptor.decrypt(bundle, receipt.licenseKey);
      }
      pluginManifest = normalizeManifest(bundle?.manifest || pluginManifest, name);
      manifestReview = auditPluginManifest(pluginManifest);
      if (!manifestReview.ok) throw dangerousBundleError(reviewWithAvailableFiles(manifestReview, bundle));
      receipt = sanitizeReceipt(receipt);
    }

    const files = await resolveBundleFiles(bundle, {
      name: pluginManifest.name,
      unzipper: this.unzipper
    });
    const fileReview = auditPluginFiles(files);
    const combinedReview = combineReviews(manifestReview, fileReview);
    if (!combinedReview.ok) throw dangerousBundleError(combinedReview);

    const addonPath = path.join(this.addonsDir, pluginManifest.name);
    writeBundleFiles(addonPath, files);
    updatePackageDependencies(this.root, pluginManifest, request);

    return {
      name: pluginManifest.name,
      addonPath,
      manifest: pluginManifest,
      receipt,
      audit: combinedReview,
      installedAt: this.now()
    };
  }

  async download(request) {
    if (request.source?.startsWith('git:')) return this.downloadFromGit(request);
    return this.downloadFromNpm(request);
  }

  async downloadFromNpm(request) {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'omnicore-npm-plugin-'));
    try {
      const packageSpec = npmPackageSpec(request);
      const { stdout } = await this.execFileImpl('npm', ['pack', packageSpec, '--pack-destination', tempRoot, '--json'], {
        cwd: this.root
      });
      const packResult = JSON.parse(stdout || '[]');
      const tarball = path.resolve(tempRoot, packResult[0]?.filename || '');
      if (!existsSync(tarball)) throw pluginInstallerError(`npm pack did not produce an archive for ${packageSpec}`);
      const unpacked = path.join(tempRoot, 'unpacked');
      mkdirSync(unpacked, { recursive: true });
      await this.execFileImpl('tar', ['-xzf', tarball, '-C', unpacked]);
      const packageDir = path.join(unpacked, 'package');
      return bundleFromDirectory(packageDir, request.source);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }

  async downloadFromGit(request) {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'omnicore-git-plugin-'));
    try {
      const repository = request.source.replace(/^git:/u, '');
      await this.execFileImpl('git', ['clone', '--depth', '1', repository, tempRoot], { cwd: this.root });
      return bundleFromDirectory(tempRoot, request.source);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}

function npmPackageSpec(request) {
  const packageName = request.source?.replace(/^npm:/u, '') || inferNpmPackageName(request.name);
  if (!request.version || request.version === 'latest') return packageName;
  return `${packageName}@${request.version}`;
}

function inferSource(name = '') {
  return `npm:${inferNpmPackageName(name)}`;
}

function inferNpmPackageName(name = '') {
  if (name.startsWith('@')) return name;
  if (name.startsWith('omni-')) return `@omnicore/${name}`;
  return name;
}

function manifestFromFiles(files = {}) {
  if (!files?.['plugin.json']) return null;
  return JSON.parse(files['plugin.json']);
}

function normalizeManifest(manifest, fallbackName) {
  if (!manifest) throw pluginInstallerError(`plugin.json is required for ${fallbackName}`);
  const normalized = {
    ...manifest,
    name: manifest.name || fallbackName,
    version: manifest.version || '0.0.0',
    isPaid: Boolean(manifest.isPaid)
  };
  const missing = REQUIRED_PLUGIN_FIELDS.filter((field) => !normalized[field]);
  if (missing.length > 0) {
    throw pluginInstallerError(`Invalid plugin.json for ${normalized.name}: missing ${missing.join(', ')}`);
  }
  return normalized;
}

function auditPluginManifest(manifest = {}) {
  const errors = [];
  const warnings = [];
  for (const [name, command] of Object.entries(manifest.scripts || {})) {
    if (/^(preinstall|install|postinstall|prepare)$/iu.test(name) && isDangerousCommand(command)) {
      errors.push({
        code: 'dangerous-lifecycle-script',
        path: `plugin.json:scripts.${name}`,
        message: `${name} runs network shell execution.`
      });
    }
  }
  if (manifest.sha256 && !SHA256_PATTERN.test(String(manifest.sha256))) {
    errors.push({
      code: 'invalid-plugin-sha256',
      path: 'plugin.json:sha256',
      message: 'Plugin sha256 must be a 64 character hex digest.'
    });
  }
  if (manifest.signature && typeof manifest.signature !== 'string') {
    errors.push({
      code: 'invalid-plugin-signature',
      path: 'plugin.json:signature',
      message: 'Plugin signature must be a string.'
    });
  }
  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  if (manifest.permissions && !Array.isArray(manifest.permissions)) {
    errors.push({
      code: 'invalid-plugin-permissions',
      path: 'plugin.json:permissions',
      message: 'Plugin permissions must be an array.'
    });
  }
  const justifications = manifest.permissionJustifications || {};
  if (justifications && typeof justifications !== 'object') {
    errors.push({
      code: 'invalid-permission-justifications',
      path: 'plugin.json:permissionJustifications',
      message: 'Permission justifications must be an object.'
    });
  }
  for (const permission of permissions) {
    if (typeof permission !== 'string' || !permission.trim()) {
      errors.push({
        code: 'invalid-plugin-permission',
        path: 'plugin.json:permissions',
        message: 'Plugin permissions must be non-empty strings.'
      });
      continue;
    }
    if (PRIVILEGED_PLUGIN_PERMISSIONS.has(permission) && !String(justifications?.[permission] || '').trim()) {
      errors.push({
        code: 'undeclared-permission-justification',
        path: `plugin.json:permissionJustifications.${permission}`,
        message: `Privileged permission "${permission}" requires a justification.`
      });
    }
  }
  if (manifest.isPaid && !manifest.priceCents) {
    warnings.push({ code: 'missing-price', message: 'Paid plugins should declare priceCents.' });
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

function auditPluginFiles(files = {}) {
  const errors = [];
  for (const [filePath, content] of Object.entries(files)) {
    if (filePath.includes('..') || path.isAbsolute(filePath)) {
      errors.push({ code: 'dangerous-path', path: filePath, message: 'Bundle path escapes addon directory.' });
      continue;
    }
    const normalizedPath = filePath.replace(/\\/gu, '/');
    if (BLOCKED_PLUGIN_FILE_PATTERNS.some((pattern) => pattern.test(normalizedPath))) {
      errors.push({ code: 'dangerous-plugin-file', path: filePath, message: 'Plugin bundle contains a blocked automation or installer file.' });
      continue;
    }
    const text = String(content || '');
    if (/\beval\s*\(/iu.test(text) || /\bFunction\s*\(/u.test(text)) {
      errors.push({ code: 'malicious-dynamic-code', path: filePath, message: 'Dynamic code execution is blocked.' });
    }
    if (/\bchild_process\b/u.test(text) || /\brm\s+-rf\b/iu.test(text) || isDangerousCommand(text)) {
      errors.push({ code: 'dangerous-system-call', path: filePath, message: 'Shell execution pattern is blocked.' });
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings: []
  };
}

function isDangerousCommand(value = '') {
  const command = String(value);
  return /\b(curl|wget|iwr|Invoke-WebRequest)\b/iu.test(command)
    && /(\|\s*(bash|sh|powershell|pwsh|node)|\b(bash|sh|powershell|pwsh)\b\s+-c)/iu.test(command);
}

function combineReviews(...reviews) {
  const errors = reviews.flatMap((review) => review.errors || []);
  const warnings = reviews.flatMap((review) => review.warnings || []);
  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

function dangerousBundleError(review) {
  const detail = review.errors.map((error) => `${error.code}:${error.path || 'manifest'}`).join(', ');
  return pluginInstallerError(`dangerous or malicious plugin bundle blocked: ${detail}`, {
    code: 'plugin-security-audit-failed',
    details: review
  });
}

function reviewWithAvailableFiles(manifestReview, bundle) {
  if (!bundle?.files) return manifestReview;
  return combineReviews(manifestReview, auditPluginFiles(bundle.files));
}

function sanitizeReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object') return receipt;
  const {
    licenseKey,
    privateKey,
    secret,
    token,
    ...safeReceipt
  } = receipt;
  return safeReceipt;
}

async function resolveBundleFiles(bundle = {}, { name, unzipper } = {}) {
  if (bundle.files) return bundle.files;
  if (bundle.directory) return collectFiles(bundle.directory);
  if (bundle.archive && unzipper) return unzipper(bundle.archive, { name });
  throw pluginInstallerError(`Plugin bundle for ${name} does not contain installable files.`);
}

function bundleFromDirectory(directory, source) {
  const files = collectFiles(directory);
  const manifest = manifestFromFiles(files);
  return {
    source,
    manifest,
    files
  };
}

function collectFiles(directory, prefix = '') {
  const files = {};
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    const relative = path.posix.join(prefix, entry);
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      Object.assign(files, collectFiles(absolute, relative));
    } else if (stats.isFile()) {
      files[relative] = readFileSync(absolute, 'utf8');
    }
  }
  return files;
}

function writeBundleFiles(addonPath, files) {
  rmSync(addonPath, { recursive: true, force: true });
  mkdirSync(addonPath, { recursive: true });
  const base = path.resolve(addonPath);
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.resolve(addonPath, relativePath);
    if (!target.startsWith(`${base}${path.sep}`) && target !== base) {
      throw pluginInstallerError(`dangerous or malicious plugin bundle blocked: dangerous-path:${relativePath}`);
    }
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, String(content), 'utf8');
  }
}

function updatePackageDependencies(root, manifest, request) {
  const packagePath = path.join(root, 'package.json');
  const packageJson = existsSync(packagePath)
    ? JSON.parse(readFileSync(packagePath, 'utf8'))
    : { name: path.basename(root), dependencies: {} };
  packageJson.dependencies = {
    ...(packageJson.dependencies || {}),
    [manifest.packageName || inferNpmPackageName(manifest.name)]: dependencyVersion(manifest, request)
  };
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
}

function dependencyVersion(manifest, request) {
  if (manifest.source?.startsWith('git:')) return manifest.source.replace(/^git:/u, 'git+');
  if (request.source?.startsWith('git:')) return request.source.replace(/^git:/u, 'git+');
  return manifest.version || request.version || 'latest';
}

class ConsolePaymentGateway {
  async requestPayment({ plugin }) {
    throw pluginInstallerError(`Paid plugin ${plugin} requires a payment gateway in this host.`);
  }
}

function pluginInstallerError(message, options = {}) {
  return createOmniError('PluginInstaller', message, options);
}

class PassthroughDecryptor {
  async decrypt(bundle) {
    return bundle;
  }
}

export {
  REQUIRED_PLUGIN_FIELDS,
  auditPluginFiles,
  auditPluginManifest
};

export default PluginInstaller;
