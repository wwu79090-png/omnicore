#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OMNICORE_COMPUTE_WASM_BYTES } from '../src/wasm/kernels/omnicore_compute.wasm.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

async function main() {
  const out = path.resolve(ROOT, argValue('--out', 'src/wasm/kernels/omnicore_compute.wasm'));
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, Buffer.from(OMNICORE_COMPUTE_WASM_BYTES));
  console.log(JSON.stringify({
    format: 'wasm',
    source: 'embedded-omnicore-compute-kernel',
    output: path.relative(ROOT, out).replace(/\\/g, '/'),
    bytes: OMNICORE_COMPUTE_WASM_BYTES.byteLength
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
