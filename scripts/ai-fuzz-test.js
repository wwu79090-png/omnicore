#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  generateDeterministicOperations,
  parseCrashReplay,
  replayOperations,
  resolveFuzzProvider,
  serializeCrashReplay
} from './lib/crash-replay.js';

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

async function main() {
  const replayPath = arg('--replay');
  if (replayPath) {
    const replay = parseCrashReplay(await readFile(replayPath, 'utf8'));
    const result = await replayOperations(createNoopTarget(), replay.operations);
    console.log(JSON.stringify({ mode: 'replay', ...result }));
    return;
  }

  const seed = Number(arg('--seed', '1337')) || 1337;
  const iterations = Number(arg('--iterations', '1000')) || 1000;
  const model = arg('--model');
  const provider = resolveFuzzProvider({ model });
  const outDir = path.resolve(arg('--out', 'test-results/fuzz'));
  const operations = generateDeterministicOperations({ seed, count: iterations });
  const target = createNoopTarget();

  try {
    await replayOperations(target, operations);
    console.log(JSON.stringify({
      mode: 'fuzz',
      provider: provider.provider,
      model: provider.model,
      seed,
      operations: operations.length,
      status: 'pass'
    }));
  } catch (error) {
    await mkdir(outDir, { recursive: true });
    const file = path.join(outDir, `omnicore-${seed}.crash-replay`);
    await writeFile(file, serializeCrashReplay({
      seed,
      provider: provider.provider,
      operations,
      error: { message: error.message, stack: error.stack }
    }));
    console.error(JSON.stringify({ status: 'fail', replay: file }));
    process.exitCode = 1;
  }
}

function createNoopTarget() {
  const state = new Map();
  return {
    async dispatch(operation) {
      if (operation.type === 'store') state.set(operation.key, operation.value);
      if (operation.type === 'deadlock') throw new Error('deadlock detected');
      return operation;
    }
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
