#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import PluginInstaller from '../src/package/PluginInstaller.js';
import { runEngineDoctorCli } from './engine-doctor.js';

const [, , command, name, ...args] = process.argv;

if (command === 'doctor') {
  const report = runEngineDoctorCli([name, ...args].filter(Boolean));
  process.exit(report.ready ? 0 : 1);
}

if (command !== 'install' || !name) {
  console.log('Usage: omni install <plugin-name> [--source npm:@scope/pkg|git:https://repo.git] [--version latest] [--config omni.config.json] [--addons-dir addons]\n       omni doctor [--root <dir>] [--out report.md] [--json report.json]');
  process.exit(command ? 1 : 0);
}

const version = readArg(args, '--version') || 'latest';
const source = readArg(args, '--source') || null;
const configPath = path.resolve(readArg(args, '--config') || 'omni.config.json');
const addonsDir = path.resolve(readArg(args, '--addons-dir') || 'addons');
const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : { plugins: [] };

const installer = new PluginInstaller({
  root: process.cwd(),
  addonsDir,
  payment: {
    async requestPayment({ plugin, amountCents, provider }) {
      const receipt = process.env.OMNI_PAID_PLUGIN_RECEIPT;
      const licenseKey = process.env.OMNI_PAID_PLUGIN_LICENSE;
      console.log(`[OmniCore] paid plugin ${plugin} requires ${provider} payment: ${amountCents} cents`);
      if (!receipt || !licenseKey) {
        throw new Error('Paid plugin payment is not configured. Set OMNI_PAID_PLUGIN_RECEIPT and OMNI_PAID_PLUGIN_LICENSE after completing payment.');
      }
      return { ok: true, receiptId: receipt, licenseKey };
    }
  }
});

const record = await installer.install(name, { version, source });
const pluginConfig = {
  name: record.manifest.name,
  version: record.manifest.version,
  addonPath: path.relative(process.cwd(), record.addonPath).replace(/\\/g, '/'),
  manifest: 'plugin.json'
};
const plugins = [...(config.plugins || [])];
const existingIndex = plugins.findIndex((plugin) => plugin.name === pluginConfig.name);
if (existingIndex >= 0) plugins[existingIndex] = pluginConfig;
else plugins.push(pluginConfig);
const nextConfig = { ...config, plugins };
mkdirSync(path.dirname(configPath), { recursive: true });
writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`);
console.log(`[OmniCore] installed ${record.name}@${record.manifest.version} -> ${pluginConfig.addonPath}`);

function readArg(values, key) {
  const index = values.indexOf(key);
  return index >= 0 ? values[index + 1] : null;
}
