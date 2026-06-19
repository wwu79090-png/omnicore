import { performance } from 'node:perf_hooks';
import { Scene, Sprite } from '../src/scene/Scene.js';

const FRAME_COUNT = 300;
const SCENARIOS = [
  {
    count: 2000,
    budgetMs: 2,
    label: '2000'
  },
  {
    count: 5000,
    budgetMs: 5,
    label: '5000'
  }
];

class Position {
  constructor(owner, options = {}) {
    this.owner = owner;
    this.vx = options.vx || 0;
    this.vy = options.vy || 0;
  }

  update(delta) {
    this.owner.x += this.vx * delta;
    this.owner.y += this.vy * delta;
    if (this.owner.x > 1024) this.owner.x = 0;
    if (this.owner.y > 1024) this.owner.y = 0;
  }
}

class Renderable {
  constructor(owner) {
    this.owner = owner;
    this._accumulated = 0;
  }

  update() {
    this._accumulated += this.owner.x + this.owner.y;
    if (this._accumulated > 1e6) this._accumulated = 0;
  }
}

function createEntityScene(count) {
  const scene = new Scene(`heavy-${count}`);
  for (let index = 0; index < count; index += 1) {
    const sprite = new Sprite(null, {
      x: index % 256,
      y: Math.floor(index / 256),
      width: 4,
      height: 4,
      zIndex: index % 8
    });
    sprite.addComponent(Position, {
      vx: (index % 3) * 0.8,
      vy: ((index % 5) - 2) * 0.7
    });
    sprite.addComponent(Renderable);
    scene.add(sprite);
  }
  return scene;
}

function measureFrameMs(scene, frames = FRAME_COUNT) {
  const delta = 1 / 60;
  const costs = [];
  for (let index = 0; index < frames; index += 1) {
    const start = performance.now();
    scene.update(delta, index * delta);
    costs.push(performance.now() - start);
  }
  const warmed = costs.slice(Math.floor(frames * 0.25));
  const avg = warmed.reduce((sum, cost) => sum + cost, 0) / warmed.length;
  const max = Math.max(...costs);
  return {
    frames,
    avg: Number(avg.toFixed(4)),
    max: Number(max.toFixed(4))
  };
}

function printResult(scenario, result) {
  const status = result.ok ? 'PASS' : 'FAIL';
  console.log(`[heavy-bench] ${scenario.label} entity frame avg=${result.avg}ms max=${result.max}ms budget=${scenario.budgetMs}ms ${status}`);
}

function runScenario(scenario) {
  const scene = createEntityScene(scenario.count);
  const result = measureFrameMs(scene);
  result.ok = result.avg <= scenario.budgetMs;
  printResult(scenario, result);
  scene.destroy();
  return result;
}

const failures = [];
for (const scenario of SCENARIOS) {
  const result = runScenario(scenario);
  if (!result.ok) failures.push({ ...scenario, ...result });
}

if (failures.length > 0) {
  console.error('[heavy-bench] 任务未通过：', JSON.stringify(failures, null, 2));
  process.exit(1);
}

console.log('[heavy-bench] 全部通过');
