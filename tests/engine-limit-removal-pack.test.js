import { describe, expect, it } from 'vitest';
import {
  BottleneckSurfaceAnalyzer,
  EngineLimitRegistry,
  LimitRemovalPlanner,
  World
} from '../src/index.js';
import ComponentStorage from '../src/core/ECS/ComponentStorage.js';

describe('engine limit removal pack', () => {
  it('grows ECS worlds beyond their initial capacity while preserving component data', () => {
    const world = new World({ capacity: 2 });
    world.registerComponent({ name: 'Stats', fields: { hp: 'i32', title: 'object' } });

    const first = world.createEntity();
    const second = world.createEntity();
    world.addComponent(first, 'Stats', { hp: 10, title: 'starter' });
    world.addComponent(second, 'Stats', { hp: 20, title: 'support' });

    const third = world.createEntity();
    world.addComponent(third, 'Stats', { hp: 30, title: 'boss' });

    expect(third).toBe(3);
    expect(world.capacity).toBeGreaterThanOrEqual(3);
    expect(world.isAlive(third)).toBe(true);
    expect(world.getComponent(first, 'Stats')).toEqual({ hp: 10, title: 'starter' });
    expect(world.getComponent(third, 'Stats')).toEqual({ hp: 30, title: 'boss' });
    expect(world.storage('Stats').capacity).toBe(world.capacity);

    world.destroyEntity(second);
    const reused = world.createEntity();
    expect(reused).toBe(second);
  });

  it('keeps explicit ECS maxCapacity as a controlled safety valve', () => {
    const capped = new World({ capacity: 2, maxCapacity: 2 });

    capped.createEntity();
    capped.createEntity();

    expect(() => capped.createEntity()).toThrow(/最大实体容量/);
  });

  it('expands component storage without changing typed-array field semantics', () => {
    const storage = new ComponentStorage({ name: 'Transform', fields: { x: 'f32', label: 'object' } }, 1);

    storage.add(10, { x: 1.5, label: 'first' });
    storage.add(11, { x: 2.5, label: 'second' });

    expect(storage.capacity).toBeGreaterThanOrEqual(2);
    expect(storage.fields.x).toBeInstanceOf(Float32Array);
    expect([...storage.entityIds.slice(0, storage.length)]).toEqual([10, 11]);
    expect(storage.get(10)).toEqual({ x: 1.5, label: 'first' });
    expect(storage.get(11)).toEqual({ x: 2.5, label: 'second' });
  });

  it('turns hidden engine limits into a lifted, monitorable registry report', () => {
    const registry = new EngineLimitRegistry()
      .register({
        id: 'ecs.entities',
        area: 'core',
        kind: 'hard',
        current: 1024,
        ceiling: 1024,
        source: 'World',
        strategy: 'fixed-array'
      })
      .register({
        id: 'renderer.commandBuffer',
        area: 'renderer',
        kind: 'soft',
        current: 3900,
        ceiling: 4096,
        source: 'PixiBatchAdapter',
        strategy: 'preallocated-buffer'
      });

    const report = registry
      .override('ecs.entities', {
        kind: 'soft',
        ceiling: 8192,
        status: 'lifted',
        tunable: true,
        strategy: 'auto-grow-typed-arrays'
      })
      .report();

    expect(report.summary).toMatchObject({
      total: 2,
      hardLimitCount: 0,
      liftedCount: 1,
      tunableCount: 1
    });
    expect(report.limits['ecs.entities']).toMatchObject({
      area: 'core',
      ceiling: 8192,
      status: 'lifted',
      strategy: 'auto-grow-typed-arrays'
    });
    expect(report.recommendations).toEqual([
      'monitor:ecs.entities',
      'monitor:renderer.commandBuffer'
    ]);
  });

  it('ranks bottleneck surfaces and creates executable limit-removal steps', () => {
    const bottlenecks = new BottleneckSurfaceAnalyzer().analyze({
      budgets: [
        { area: 'core', metric: 'entityCount', ratio: 1.8, severity: 'critical' },
        { area: 'renderer', metric: 'drawCalls', ratio: 1.2, severity: 'warning' }
      ],
      limits: [
        { id: 'ecs.entities', area: 'core', kind: 'hard', current: 1024, ceiling: 1024 },
        { id: 'renderer.commandBuffer', area: 'renderer', kind: 'soft', current: 3900, ceiling: 4096 }
      ],
      regressions: [
        { area: 'core', metric: 'frameMs', severity: 'critical', changePercent: 28 }
      ]
    });

    expect(bottlenecks.primaryArea).toBe('core');
    expect(bottlenecks.surfaces[0]).toMatchObject({
      area: 'core',
      score: 12,
      drivers: ['entityCount', 'ecs.entities', 'frameMs']
    });
    expect(bottlenecks.recommendations).toContain('liftLimits:core');

    const plan = new LimitRemovalPlanner().plan(bottlenecks.limits);
    expect(plan.steps).toEqual([
      {
        id: 'ecs.entities',
        area: 'core',
        priority: 'P0',
        action: 'virtualize',
        strategy: 'auto-grow-or-shard',
        verification: 'npm test -- tests/engine-limit-removal-pack.test.js'
      },
      {
        id: 'renderer.commandBuffer',
        area: 'renderer',
        priority: 'P1',
        action: 'raise',
        strategy: 'runtime-tunable-budget',
        verification: 'npm run benchmark:ci'
      }
    ]);
  });
});
