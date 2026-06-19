#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OMNICORE_CORE_WASM_BYTES } from './src/generated-minimal-wasm.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, 'dist');
const OUT_WASM = path.join(OUT_DIR, 'omnicore_core.wasm');
const SOURCE = path.join(ROOT, 'src', 'omnicore_core.c');

const EXPORTS = [
  '_omni_version',
  '_omni_store_create',
  '_omni_store_set_i32',
  '_omni_store_get_i32',
  '_omni_store_has',
  '_omni_store_clear',
  '_omni_eventbus_create',
  '_omni_eventbus_emit',
  '_omni_eventbus_pending',
  '_omni_eventbus_drain',
  '_omni_eventbus_last_event',
  '_omni_eventbus_last_payload',
  '_omni_ecs_create',
  '_omni_ecs_create_entity',
  '_omni_ecs_destroy_entity',
  '_omni_ecs_is_alive',
  '_omni_ecs_add_position',
  '_omni_ecs_add_velocity',
  '_omni_ecs_get_position_x',
  '_omni_ecs_get_position_y',
  '_omni_ecs_step_movement'
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  if (hasCommand('emcc')) {
    const result = spawnSync('emcc', [
      SOURCE,
      '-O3',
      '-sSTANDALONE_WASM=1',
      '-sALLOW_MEMORY_GROWTH=0',
      `-sEXPORTED_FUNCTIONS=${JSON.stringify(EXPORTS)}`,
      '-Wl,--no-entry',
      '-o',
      OUT_WASM
    ], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
    console.log(JSON.stringify({ builder: 'emcc', output: relative(OUT_WASM), wasiStyle: true }));
    return;
  }

  await writeFile(OUT_WASM, OMNICORE_CORE_WASM_BYTES);
  console.log(JSON.stringify({
    builder: 'generated-minimal-wasm',
    output: relative(OUT_WASM),
    note: 'emcc not found; emitted dependency-free ABI-compatible test module'
  }));
}

function hasCommand(command) {
  const probe = spawnSync(command, ['--version'], { stdio: 'ignore' });
  return !probe.error && probe.status === 0;
}

function relative(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
