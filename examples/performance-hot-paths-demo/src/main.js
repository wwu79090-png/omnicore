import {
  DirtyFlagTracker,
  createRuntimeObjectPools,
  createWebGPUInstancingDescriptor,
  optimizeRenderQueueForBatching
} from '../../../src/index.js';

const report = document.querySelector('#report');

const batching = optimizeRenderQueueForBatching([
  { id: 'hero-a', layer: 'world', texture: 'hero.png', material: 'sprite' },
  { id: 'crate', layer: 'world', texture: 'props.png', material: 'sprite' },
  { id: 'hero-b', layer: 'world', texture: 'hero.png', material: 'sprite' },
  { id: 'hud', layer: 'ui', texture: 'ui.png', material: 'sprite' }
]);

const pools = createRuntimeObjectPools({ warm: { Sprite: 1, Tween: 1, Particle: 1, Event: 1 } });
const sprite = pools.acquire('Sprite', { id: 'bullet' });
pools.release('Sprite', sprite);
pools.acquire('Sprite', { id: 'bullet-reused' });

const dirty = new DirtyFlagTracker();
const hero = { id: 'hero', x: 0, alpha: 1 };
dirty.track(hero, 'hero');
dirty.set(hero, 'x', 24);
const dirtySync = dirty.syncOnlyDirty({ now: 1 });

const webgpu = createWebGPUInstancingDescriptor({
  instances: Array.from({ length: 64 }, (_, index) => ({
    x: (index % 16) * 16,
    y: Math.floor(index / 16) * 16,
    width: 16,
    height: 16
  }))
});

const cards = [
  ['Saved draw calls', batching.savedDrawCalls, 'optimizeRenderQueueForBatching'],
  ['Pool reuse', pools.report().types.find((type) => type.name === 'Sprite')?.reused || 0, 'createRuntimeObjectPools'],
  ['Dirty records', dirtySync.dirtyCount, 'DirtyFlagTracker'],
  ['WebGPU draw calls', webgpu.drawCalls, 'createWebGPUInstancingDescriptor']
];

report.replaceChildren(...cards.map(([label, value, api]) => {
  const card = document.createElement('article');
  card.className = 'metric';
  card.innerHTML = `<strong>${value}</strong><span>${label}</span><br><code>${api}</code>`;
  return card;
}));
