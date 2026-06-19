#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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
    return {
      packageName: pkg.name,
      version: pkg.version,
      demo,
      installSnippet,
      listed
    };
  });
  return {
    ok: errors.length === 0,
    errors,
    plugins
  };
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
