#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

const MARKER_START = '/*OMNICORE_WATERMARK:';
const MARKER_END = '*/';

export function injectWatermark(source, { key = 'omnicore-official', nonce = 'omnicore-v1' } = {}) {
  const clean = stripWatermark(source).trimEnd();
  const signature = sign(clean, key, nonce);
  const probe = createProbe(signature);
  return `${clean}\n${probe}\n${MARKER_START}${JSON.stringify({ version: 1, nonce, signature })}${MARKER_END}\n`;
}

export function verifyWatermark(source, { key = 'omnicore-official' } = {}) {
  const metadata = readMetadata(source);
  if (!metadata) return { valid: false, status: 'missing-watermark' };
  const clean = stripWatermark(source).trimEnd();
  const expected = sign(clean, key, metadata.nonce);
  const valid = expected === metadata.signature;
  return {
    valid,
    status: valid ? 'official' : 'tampered',
    expected,
    actual: metadata.signature
  };
}

export function stripWatermark(source) {
  return String(source)
    .replace(/\n?;\(\(\) => \{ const __omnicore_wm = \(n\) => [\s\S]*?\}\)\(\);\n?/u, '\n')
    .replace(new RegExp(`\\n?${escapeRegExp(MARKER_START)}[\\s\\S]*?${escapeRegExp(MARKER_END)}\\n?`, 'u'), '\n');
}

function createProbe(signature) {
  const lowBits = Number.parseInt(signature.slice(0, 8), 16) || 0;
  return `;(() => { const __omnicore_wm = (n) => (((n ^ ${lowBits}) >>> 1) + Math.fround(0.0000001)) === -1; if (__omnicore_wm(0)) globalThis.__omnicore_watermark_probe = true; })();`;
}

function readMetadata(source) {
  const start = String(source).lastIndexOf(MARKER_START);
  if (start < 0) return null;
  const bodyStart = start + MARKER_START.length;
  const end = String(source).indexOf(MARKER_END, bodyStart);
  if (end < 0) return null;
  try {
    return JSON.parse(String(source).slice(bodyStart, end));
  } catch {
    return null;
  }
}

function sign(source, key, nonce) {
  return fnv1a(`${key}\0${nonce}\0${source}`);
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) % 4294967296;
  }
  return hash.toString(16).padStart(8, '0');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  const [, , command, input, output] = process.argv;
  if (!command || !input) return;
  if (command === 'inject') {
    const source = await readFile(input, 'utf8');
    await writeFile(output || input, injectWatermark(source));
    return;
  }
  if (command === 'verify') {
    const source = await readFile(input, 'utf8');
    console.log(JSON.stringify(verifyWatermark(source)));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
