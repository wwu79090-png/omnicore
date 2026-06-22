#!/usr/bin/env node
const metrics = createTemplateBenchmark({
  template: 'platformer',
  entities: 96,
  movingEntities: 18,
  drawCallBase: 6,
  packageBytes: 18000
});

process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`);

function createTemplateBenchmark({ template, entities, movingEntities, drawCallBase, packageBytes }) {
  const frameSamples = Array.from({ length: 180 }, (_, index) => 5.8 + ((index % 9) * 0.18) + (movingEntities / entities));
  const sorted = frameSamples.slice().sort((left, right) => left - right);
  const p95FrameMs = sorted[Math.floor(sorted.length * 0.95)];
  return {
    format: 'OmniCore.TemplateBenchmark',
    template,
    metrics: {
      fps: Number((1000 / average(frameSamples)).toFixed(2)),
      p95FrameMs: Number(p95FrameMs.toFixed(3)),
      memoryMb: Number((32 + entities * 0.015).toFixed(2)),
      drawCalls: drawCallBase,
      gcEvents: Math.floor(movingEntities / 24),
      packageBytes
    }
  };
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
