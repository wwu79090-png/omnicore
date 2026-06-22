import { describe, expect, it } from 'vitest';
import {
  AbilitySystem,
  AddressableCatalog,
  CollectionFactory,
  DataAsset,
  EventSheet,
  GameplayTags,
  ObjectEventMap,
  QueryFilter,
  Scene,
  SystemSchedule,
  World,
  createSceneServices
} from '../src/index.js';

describe('cross-engine foundation pack', () => {
  it('creates Unity-style data assets with variant overrides and stable references', () => {
    const base = DataAsset.create({
      id: 'weapon.sword',
      type: 'WeaponConfig',
      data: { damage: 10, tags: ['weapon.melee'] },
      resourcePath: 'data/weapons/sword.asset.json'
    });
    const variant = base.variant('weapon.sword.fire', {
      data: { damage: 14, element: 'fire', tags: ['weapon.melee', 'element.fire'] }
    });

    expect(base.uid).toBe('dataasset:data/weapons/sword.asset.json');
    expect(variant.parent).toBe(base.uid);
    expect(variant.resolve()).toMatchObject({
      id: 'weapon.sword.fire',
      type: 'WeaponConfig',
      data: { damage: 14, element: 'fire', tags: ['weapon.melee', 'element.fire'] }
    });
  });

  it('matches Unreal-style hierarchical gameplay tags and filters objects', () => {
    const tags = GameplayTags.create(['Character.Enemy.Zombie', 'State.Burning']);
    const candidates = [
      { id: 'a', tags: ['Character.Enemy.Zombie.Brute'] },
      { id: 'b', tags: ['Character.NPC.Shopkeeper'] }
    ];

    expect(tags.has('Character.Enemy')).toBe(true);
    expect(tags.matchesAny(['State.Frozen', 'State.Burning'])).toBe(true);
    expect(GameplayTags.filter('Character.Enemy', candidates)).toEqual([candidates[0]]);
  });

  it('builds an addressable catalog with platform variants and bundle loader entries', () => {
    const catalog = AddressableCatalog.create({
      baseUrl: '/game',
      entries: [
        { address: 'hero', path: 'sprites/hero.png', bundle: 'startup', variants: { wechat: 'sprites/hero-min.png' } },
        { address: 'boss', path: 'sprites/boss.png', bundle: 'stage-1' }
      ]
    });

    expect(catalog.resolve('hero', { platform: 'wechat' })).toMatchObject({
      address: 'hero',
      url: '/game/sprites/hero-min.png',
      bundle: 'startup'
    });
    expect(catalog.bundle('startup').map((item) => item.address)).toEqual(['hero']);
    expect(catalog.toLoaderBundle('startup', { platform: 'web' })).toEqual([
      { key: 'hero', url: '/game/sprites/hero.png', type: 'image' }
    ]);
  });

  it('runs Bevy-style staged systems deterministically', () => {
    const schedule = new SystemSchedule();
    const order = [];
    schedule.add('Startup', 'boot', () => order.push('boot'));
    schedule.add('Update', 'move', () => order.push('move'));
    schedule.add('PreUpdate', 'input', () => order.push('input'));
    schedule.add('PostUpdate', 'cleanup', () => order.push('cleanup'));

    const report = schedule.run({ delta: 1 / 60 });

    expect(order).toEqual(['boot', 'input', 'move', 'cleanup']);
    expect(report.stages.map((stage) => stage.name)).toEqual(['Startup', 'PreUpdate', 'Update', 'PostUpdate']);
  });

  it('filters ECS queries by components, tags, and changed state', () => {
    const world = new World({ capacity: 8 });
    world.registerComponent({ name: 'Position', fields: { x: 'f32', y: 'f32' } });
    const enemy = world.createEntity();
    const npc = world.createEntity();
    world.addComponent(enemy, 'Position', { x: 1, y: 2 });
    world.addComponent(npc, 'Position', { x: 3, y: 4 });
    world.addTags(enemy, ['Character.Enemy']);
    world.addTags(npc, ['Character.NPC']);
    world.markChanged(enemy, 'Position');

    const query = QueryFilter.with(world)
      .components(['Position'])
      .tags(['Character.Enemy'])
      .changed(['Position']);

    expect(query.entities()).toEqual([enemy]);
  });

  it('spawns Defold-style collections with addressable child ids', () => {
    const factory = new CollectionFactory({
      scene: {
        name: 'EnemyPack',
        children: [
          { id: 'enemy', type: 'sprite', texture: 'enemy.png', x: 0, y: 0 },
          { id: 'weapon', type: 'sprite', texture: 'blade.png', x: 8, y: 0 }
        ]
      }
    });

    const spawned = factory.create({ idPrefix: 'wave1', position: { x: 100, y: 50 }, properties: { enemy: { props: { hp: 3 } } } });

    expect(spawned.ids).toEqual({ enemy: 'wave1/enemy', weapon: 'wave1/weapon' });
    expect(spawned.entities[0]).toMatchObject({ id: 'wave1/enemy', x: 100, y: 50, props: { hp: 3 } });
  });

  it('dispatches GameMaker-style object events with scene services injected like Phaser plugins', async () => {
    const scene = new Scene('play');
    const events = [];
    const map = new ObjectEventMap({
      create: [(entity) => events.push(`create:${entity.id}`)],
      collision: [(entity, other) => events.push(`hit:${entity.id}:${other.id}`)]
    });
    const services = createSceneServices(scene, {
      loader: { loadBundle: () => Promise.resolve({}) },
      input: { keyboard: true },
      events: { emit: (name) => events.push(name) }
    });
    const player = { id: 'player' };

    expect(services.load).toBeDefined();
    await map.dispatch('create', player, { scene });
    await map.dispatch('collision', player, { id: 'wall' }, { scene });

    expect(events).toEqual(['create:player', 'hit:player:wall']);
  });

  it('supports Construct-style event groups, function events, and trace output', () => {
    const runtime = { state: { score: 1 }, calls: [] };
    const sheet = EventSheet.parse({
      functions: {
        award: [{ op: 'inc', target: 'state.score', value: 4 }]
      },
      events: [
        {
          group: 'enabled-combat',
          enabled: true,
          conditions: [{ op: 'equals', left: 'state.score', right: 1 }],
          actions: [{ op: 'function', name: 'award' }]
        },
        {
          group: 'disabled-debug',
          enabled: false,
          actions: [{ op: 'set', target: 'state.debug', value: true }]
        }
      ]
    });

    const report = sheet.runWithTrace(runtime);

    expect(runtime.state).toEqual({ score: 5 });
    expect(report.events.map((event) => [event.group, event.passed, event.skipped])).toEqual([
      ['enabled-combat', true, false],
      ['disabled-debug', false, true]
    ]);
  });

  it('applies lightweight ability cooldowns and effects with tag requirements', () => {
    const actor = { id: 'mage', mana: 10, tags: ['Character.Player'] };
    const abilities = new AbilitySystem({
      now: () => 1000,
      abilities: [
        {
          id: 'fireball',
          cost: { mana: 3 },
          cooldownMs: 500,
          requiredTags: ['Character.Player'],
          effects: [{ op: 'addTag', tag: 'State.Casting' }, { op: 'inc', path: 'mana', value: -3 }]
        }
      ]
    });

    const first = abilities.cast('fireball', actor);
    const second = abilities.cast('fireball', actor);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('cooldown');
    expect(actor.mana).toBe(7);
    expect(actor.tags).toContain('State.Casting');
  });
});
