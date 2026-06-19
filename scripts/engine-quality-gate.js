#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runEngineQualityGate } from '../src/quality/EngineQualityHarness.js';

export function createDefaultEngineQualityReport(options = {}) {
  const seed = Number(options.seed || 20260619);
  const steps = Number(options.steps || 120);
  const world = createSampleWorld({ seed });

  return runEngineQualityGate({
    determinism: {
      createWorld: createSampleWorld,
      steps,
      seed
    },
    world,
    metrics: {
      frameMs: Number(options.frameMs || 12.5),
      memoryMB: Number(options.memoryMB || 192),
      drawCalls: Number(options.drawCalls || 420),
      entityCount: world.entities.length
    },
    budgets: {
      frameMs: Number(options.maxFrameMs || 16.7),
      memoryMB: Number(options.maxMemoryMB || 512),
      drawCalls: Number(options.maxDrawCalls || 1200),
      entityCount: Number(options.maxEntityCount || 5000)
    }
  });
}

export default createDefaultEngineQualityReport;

function createSampleWorld({ seed = 1 } = {}) {
  let state = normalizeSeed(seed);
  const entities = Array.from({ length: 48 }, (_, index) => ({
    id: `entity-${index}`,
    x: (index * 17) % 640,
    y: (index * 23) % 360,
    width: 16,
    height: 16,
    rotation: 0,
    alpha: 1,
    components: index % 3 === 0 ? ['sprite', 'body'] : ['sprite']
  }));

  return {
    entities,
    step(frame) {
      for (const entity of entities) {
        state = nextSeed(state);
        entity.x += ((state % 5) - 2) * 0.25;
        entity.y += frame % 2 === 0 ? 0.5 : -0.5;
        entity.rotation = Number((entity.rotation + 0.01).toFixed(4));
      }
    },
    snapshot() {
      return entities.map((entity) => ({
        id: entity.id,
        x: Number(entity.x.toFixed(4)),
        y: Number(entity.y.toFixed(4)),
        rotation: entity.rotation,
        components: entity.components
      }));
    }
  };
}

function normalizeSeed(seed) {
  const normalized = Math.abs(Math.trunc(Number(seed) || 1)) % 2147483647;
  return normalized === 0 ? 1 : normalized;
}

function nextSeed(seed) {
  return (seed * 48271) % 2147483647;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') {
      index += 1;
      options.out = argv[index];
    } else if (arg === '--seed') {
      index += 1;
      options.seed = Number(argv[index]);
    } else if (arg === '--steps') {
      index += 1;
      options.steps = Number(argv[index]);
    } else if (arg === '--frame-ms') {
      index += 1;
      options.frameMs = Number(argv[index]);
    } else if (arg === '--memory-mb') {
      index += 1;
      options.memoryMB = Number(argv[index]);
    } else if (arg === '--draw-calls') {
      index += 1;
      options.drawCalls = Number(argv[index]);
    } else if (arg === '--max-frame-ms') {
      index += 1;
      options.maxFrameMs = Number(argv[index]);
    } else if (arg === '--max-memory-mb') {
      index += 1;
      options.maxMemoryMB = Number(argv[index]);
    } else if (arg === '--max-draw-calls') {
      index += 1;
      options.maxDrawCalls = Number(argv[index]);
    }
  }
  return options;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const options = parseArgs(process.argv.slice(2));
  const report = createDefaultEngineQualityReport(options);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.out) {
    const outFile = path.resolve(options.out);
    mkdirSync(path.dirname(outFile), { recursive: true });
    writeFileSync(outFile, json, 'utf8');
  }
  console.log(json);
  if (!report.ok) process.exitCode = 1;
}
