#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const NPMJS_REGISTRY = 'https://registry.npmjs.org/';
const CHINA_MIRROR_REGISTRY = 'https://registry.npmmirror.com/';
const MIRROR_COMMAND = `npm config set registry ${CHINA_MIRROR_REGISTRY}`;

export async function inspectNpmRegistry({
  registry,
  ping = defaultPing,
  timeoutMs = 2500
} = {}) {
  const currentRegistry = normalizeRegistry(registry || await readCurrentRegistry());
  const result = {
    registry: currentRegistry,
    needsMirrorHint: false,
    command: MIRROR_COMMAND,
    reason: 'ok'
  };
  if (!isNpmjsRegistry(currentRegistry)) return result;
  try {
    await ping(`${currentRegistry.replace(/\/$/, '')}/-/ping`, { timeoutMs });
    return result;
  } catch (error) {
    return {
      ...result,
      needsMirrorHint: true,
      reason: error?.code || error?.name || error?.message || 'registry-unreachable'
    };
  }
}

export function buildRegistryGuidance(result = {}) {
  return [
    '[OmniCore] 检测到当前 npm registry 可能连接超时。',
    `当前 registry: ${result.registry || NPMJS_REGISTRY}`,
    '中国大陆网络环境建议执行：',
    `  ${MIRROR_COMMAND}`,
    '然后重新运行 npm install。'
  ].join('\n');
}

async function readCurrentRegistry() {
  try {
    const { stdout } = await execFileAsync('npm', ['config', 'get', 'registry'], { timeout: 1500 });
    return stdout.trim() || NPMJS_REGISTRY;
  } catch {
    return NPMJS_REGISTRY;
  }
}

async function defaultPing(url, { timeoutMs } = {}) {
  if (typeof fetch !== 'function') return;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller?.signal });
    if (!response.ok) throw Object.assign(new Error(`registry ping failed: ${response.status}`), { code: `HTTP_${response.status}` });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeRegistry(value = '') {
  return value.endsWith('/') ? value : `${value}/`;
}

function isNpmjsRegistry(value = '') {
  return /registry\.npmjs\.org\/?$/i.test(value);
}

async function main() {
  const result = await inspectNpmRegistry();
  if (result.needsMirrorHint) console.warn(buildRegistryGuidance(result));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.warn(`[OmniCore] npm registry 检查失败：${error?.message || error}`);
  });
}
