#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function createDependencyInventory({
  generatedAt = new Date().toISOString(),
  packageJson = readJsonFile('package.json'),
  lockfile = readOptionalJsonFile('package-lock.json')
} = {}) {
  const dependencies = [
    ...collectDependencyGroup(packageJson.dependencies, 'dependency', lockfile),
    ...collectDependencyGroup(packageJson.devDependencies, 'devDependency', lockfile)
  ].sort((left, right) => left.type.localeCompare(right.type) || left.name.localeCompare(right.name));
  return {
    format: 'OmniCore.DependencyInventory',
    version: 1,
    generatedAt,
    package: {
      name: packageJson.name,
      version: packageJson.version,
      license: packageJson.license || null
    },
    counts: {
      dependencies: dependencies.filter((item) => item.type === 'dependency').length,
      devDependencies: dependencies.filter((item) => item.type === 'devDependency').length,
      total: dependencies.length
    },
    dependencies
  };
}

export function writeDependencyInventory(
  report,
  out = path.join('docs', 'release-notes', 'dependency-inventory.json')
) {
  const outFile = path.resolve(out);
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return outFile;
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = createDependencyInventory();
  const outFile = writeDependencyInventory(report, options.out);
  console.log(`[OmniCore] dependency inventory written: ${outFile}`);
  return report;
}

function collectDependencyGroup(group, type, lockfile = {}) {
  return Object.entries(group || {}).map(([name, spec]) => {
    const locked = lockfile?.packages?.[`node_modules/${name}`] || {};
    return {
      name,
      type,
      spec,
      version: locked.version || null,
      license: locked.license || null,
      resolved: locked.resolved || null
    };
  });
}

function readJsonFile(file) {
  return JSON.parse(readFileSync(path.resolve(file), 'utf8'));
}

function readOptionalJsonFile(file) {
  const target = path.resolve(file);
  if (!existsSync(target)) return {};
  return readJsonFile(target);
}

function parseArgs(argv = []) {
  const options = {
    out: path.join('docs', 'release-notes', 'dependency-inventory.json')
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--out') {
      index += 1;
      options.out = argv[index];
    }
  }
  return options;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  main();
}

export default main;
