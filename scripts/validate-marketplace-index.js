#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const PRIVILEGED_PLUGIN_PERMISSIONS = new Set(['filesystem', 'network', 'payment', 'native', 'process']);
const SHA256_PATTERN = /^[a-f0-9]{64}$/iu;
const LIFECYCLE_SCRIPTS = new Set(['preinstall', 'install', 'postinstall', 'prepare']);

function parseArgs(argv) {
  const options = {
    website: path.join('website', 'plugins'),
    packages: [],
    out: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--website') {
      index += 1;
      options.website = argv[index];
    } else if (arg === '--package') {
      index += 1;
      options.packages.push(argv[index]);
    } else if (arg === '--out') {
      index += 1;
      options.out = argv[index];
    }
  }
  if (options.packages.length === 0) {
    options.packages.push(path.join('packages', 'omnicore-plugin-wechat-monetization', 'package.json'));
  }
  return options;
}

export function validateMarketplaceIndex({
  website = path.join('website', 'plugins'),
  packages = [path.join('packages', 'omnicore-plugin-wechat-monetization', 'package.json')]
} = {}) {
  const indexPath = path.join(website, 'index.html');
  const html = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
  const errors = [];
  const plugins = packages.map((packagePath) => {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const demo = demoPathForPackage(pkg.name);
    const installSnippet = `npm install ${pkg.name}`;
    const listed = html.includes(installSnippet) && html.includes(demo);
    if (!html.includes(installSnippet)) {
      errors.push({
        code: 'missing-marketplace-install',
        packageName: pkg.name,
        expected: installSnippet
      });
    }
    if (!html.includes(demo)) {
      errors.push({
        code: 'missing-marketplace-demo',
        packageName: pkg.name,
        expected: demo
      });
    }
    const security = validatePluginSecurity(pkg, packagePath);
    errors.push(...security.errors.map((error) => ({
      ...error,
      packageName: pkg.name
    })));
    return {
      packageName: pkg.name,
      version: pkg.version,
      demo,
      installSnippet,
      listed,
      security
    };
  });
  return {
    ok: errors.length === 0,
    errors,
    plugins
  };
}

function validatePluginSecurity(pkg, packagePath) {
  const errors = [];
  const warnings = [];
  const metadata = pkg.omnicorePlugin || pkg.omnicore?.plugin || null;
  const pluginPackage = isOmniPluginPackage(pkg);
  const packageDir = path.dirname(path.resolve(packagePath));
  const permissions = Array.isArray(metadata?.permissions) ? metadata.permissions : [];
  const permissionJustifications = metadata?.permissionJustifications || {};
  const mainFile = metadata?.main || pkg.main || 'src/index.js';
  const expectedSha256 = String(metadata?.sha256 || metadata?.integrity?.sha256 || '').toLowerCase();
  let actualSha256 = null;
  let matched = false;

  if (pluginPackage && !metadata) {
    errors.push({
      code: 'missing-plugin-security-metadata',
      message: 'OmniCore plugin packages must declare omnicorePlugin security metadata.'
    });
  }

  for (const [scriptName, command] of Object.entries(pkg.scripts || {})) {
    if (LIFECYCLE_SCRIPTS.has(scriptName)) {
      errors.push({
        code: 'dangerous-plugin-lifecycle-script',
        path: `package.json:scripts.${scriptName}`,
        message: `Marketplace plugins cannot declare lifecycle script "${scriptName}".`,
        command
      });
    }
  }

  for (const permission of permissions) {
    if (typeof permission !== 'string' || !permission.trim()) {
      errors.push({
        code: 'invalid-plugin-permission',
        path: 'omnicorePlugin.permissions',
        message: 'Plugin permissions must be non-empty strings.'
      });
      continue;
    }
    if (PRIVILEGED_PLUGIN_PERMISSIONS.has(permission) && !String(permissionJustifications[permission] || '').trim()) {
      errors.push({
        code: 'unsafe-plugin-permission',
        path: `omnicorePlugin.permissionJustifications.${permission}`,
        message: `Privileged permission "${permission}" must include a marketplace justification.`
      });
    }
  }

  if (pluginPackage && permissions.length === 0) {
    errors.push({
      code: 'missing-plugin-permissions',
      path: 'omnicorePlugin.permissions',
      message: 'Marketplace plugins must explicitly declare permissions, even when empty.'
    });
  }

  if (!SHA256_PATTERN.test(expectedSha256)) {
    errors.push({
      code: 'invalid-plugin-sha256',
      path: 'omnicorePlugin.sha256',
      message: 'Marketplace plugins must declare a lowercase sha256 for the main file.'
    });
  } else {
    const mainPath = path.resolve(packageDir, mainFile);
    if (!mainPath.startsWith(`${packageDir}${path.sep}`)) {
      errors.push({
        code: 'dangerous-plugin-main-path',
        path: mainFile,
        message: 'Plugin main file must stay inside the package directory.'
      });
    } else if (!fs.existsSync(mainPath)) {
      errors.push({
        code: 'missing-plugin-main',
        path: mainFile,
        message: 'Plugin main file referenced by package metadata does not exist.'
      });
    } else {
      actualSha256 = createHash('sha256').update(fs.readFileSync(mainPath)).digest('hex');
      matched = actualSha256 === expectedSha256;
      if (!matched) {
        errors.push({
          code: 'plugin-sha256-mismatch',
          path: mainFile,
          message: 'Plugin main file sha256 does not match omnicorePlugin.sha256.',
          expected: expectedSha256,
          actual: actualSha256
        });
      }
    }
  }

  return {
    ok: errors.length === 0,
    required: pluginPackage,
    permissions,
    permissionJustifications,
    integrity: {
      algorithm: 'sha256',
      expected: expectedSha256 || null,
      actual: actualSha256,
      matched
    },
    errors,
    warnings
  };
}

function isOmniPluginPackage(pkg) {
  return String(pkg.name || '').startsWith('@omnicore/plugin-')
    || String(pkg.name || '').startsWith('@omnicore/omni-')
    || (Array.isArray(pkg.keywords) && pkg.keywords.includes('omnicore-plugin'));
}

function demoPathForPackage(packageName) {
  if (packageName === '@omnicore/plugin-wechat-monetization') {
    return 'examples/plugins/WechatMiniGameMonetization/demo/index.html';
  }
  return `examples/plugins/${packageName.split('/').pop()}/demo/index.html`;
}

function run() {
  const options = parseArgs(process.argv.slice(2));
  const report = validateMarketplaceIndex({
    website: options.website,
    packages: options.packages
  });
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (options.out) {
    fs.mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true });
    fs.writeFileSync(options.out, output, 'utf8');
  } else {
    process.stdout.write(output);
  }
  if (!report.ok) {
    process.stderr.write(report.errors.map((error) => error.code).join('\n'));
    process.stderr.write('\n');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) run();

export default validateMarketplaceIndex;
