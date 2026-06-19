#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import PackageManager from '../src/package/PackageManager.js';

const [, , command, name, ...args] = process.argv;

if (command !== 'install' || !name) {
  console.log('Usage: omni install <package> [--version latest] [--config omni.config.json]');
  process.exit(command ? 1 : 0);
}

const version = readArg(args, '--version') || 'latest';
const configPath = path.resolve(readArg(args, '--config') || 'omni.config.json');
const pluginsDir = path.resolve(readArg(args, '--plugins-dir') || 'plugins');
const registryUrl = process.env.OMNI_REGISTRY_URL || 'https://registry.omnicore.dev';
const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : { plugins: [] };

const manager = new PackageManager({
  registryUrl,
  moduleLoader: async (moduleUrl, manifest) => {
    mkdirSync(path.join(pluginsDir, manifest.name), { recursive: true });
    const response = await fetch(moduleUrl);
    if (!response.ok) throw new Error(`Plugin module download failed: ${moduleUrl}`);
    const code = await response.text();
    writeFileSync(path.join(pluginsDir, manifest.name, 'index.js'), code);
    return {};
  }
});

const record = await manager.install(name, { version, config });
mkdirSync(path.dirname(configPath), { recursive: true });
writeFileSync(configPath, `${JSON.stringify(record.config, null, 2)}\n`);
console.log(`[OmniCore] installed ${record.name}@${record.version}`);

function readArg(values, key) {
  const index = values.indexOf(key);
  return index >= 0 ? values[index + 1] : null;
}
