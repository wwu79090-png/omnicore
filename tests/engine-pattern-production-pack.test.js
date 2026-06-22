import { describe, expect, it } from 'vitest';
import {
  AssetBuildRecipe,
  BehaviorDefinition,
  GameSettingsProfile,
  ModuleGemManifest,
  RuntimeStateSerializer,
  SceneTransitionStack,
  VirtualAssetFS
} from '../src/index.js';

describe('engine pattern production pack', () => {
  it('resolves centralized game settings with platform overrides and budget validation', () => {
    const settings = new GameSettingsProfile({
      defaults: {
        scene: 'boot',
        rendering: { backend: 'pixi', shadows: true },
        texture: { maxSize: 2048 },
        physics: { fixedStep: 1 / 60 }
      },
      platforms: {
        mobile: {
          rendering: { shadows: false },
          texture: { maxSize: 1024 },
          budgets: { textureMB: 64, drawCalls: 400 }
        }
      }
    });

    const resolved = settings.resolve('mobile');
    expect(resolved.rendering).toEqual({ backend: 'pixi', shadows: false });
    expect(resolved.texture.maxSize).toBe(1024);

    const report = settings.validate('mobile', { textureMB: 96, drawCalls: 300 });
    expect(report.ok).toBe(false);
    expect(report.warnings).toEqual([
      {
        code: 'texture-budget-exceeded',
        metric: 'textureMB',
        limit: 64,
        actual: 96
      }
    ]);
  });

  it('builds deterministic asset products and virtual filesystem manifests', () => {
    const recipe = new AssetBuildRecipe({
      sourceRoot: 'source-assets',
      outputRoot: 'dist/assets',
      builders: {
        image: { outExt: '.webp', bundle: 'textures' },
        audio: { outExt: '.ogg', bundle: 'audio' }
      }
    });
    const plan = recipe.plan([
      { path: 'source-assets/hero.png', type: 'image', deps: ['source-assets/hero.json'] },
      { path: 'source-assets/theme.wav', type: 'audio' }
    ]);

    expect(plan.products.map((product) => product.path)).toEqual([
      'dist/assets/hero.webp',
      'dist/assets/theme.ogg'
    ]);
    expect(plan.bundles.textures).toEqual(['dist/assets/hero.webp']);
    expect(plan.products[0].dependencies).toEqual(['source-assets/hero.json']);

    const vfs = new VirtualAssetFS();
    vfs.mount('/cart/sprites/hero.png', { type: 'image', bytes: 128 });
    vfs.mount('/cart/data/level.json', { type: 'json', bytes: 64 });
    expect(vfs.resolve('cart/sprites/hero.png').type).toBe('image');
    expect(vfs.pack({ cartridge: 'demo' })).toEqual({
      cartridge: 'demo',
      totalBytes: 192,
      files: [
        { path: '/cart/data/level.json', type: 'json', bytes: 64 },
        { path: '/cart/sprites/hero.png', type: 'image', bytes: 128 }
      ]
    });
  });

  it('serializes runtime state snapshots, diffs, and patches', () => {
    const serializer = new RuntimeStateSerializer({
      include: ['id', 'x', 'y', 'props.hp', 'components']
    });
    const before = serializer.snapshot({
      id: 'enemy',
      x: 4,
      y: 8,
      props: { hp: 10, hidden: true },
      components: [{ type: 'AI' }]
    });
    const after = serializer.snapshot({
      id: 'enemy',
      x: 6,
      y: 8,
      props: { hp: 4, hidden: true },
      components: [{ type: 'AI' }]
    });

    const patch = serializer.diff(before, after);
    expect(patch.changes).toEqual([
      { path: 'props.hp', before: 10, after: 4 },
      { path: 'x', before: 4, after: 6 }
    ]);
    expect(serializer.apply(before, patch).state).toEqual(after.state);
  });

  it('attaches reusable behavior definitions and dispatches event actions', () => {
    const behavior = new BehaviorDefinition({
      id: 'health',
      properties: { hp: 3, maxHp: 3 },
      events: {
        damage: [
          { op: 'add', path: 'hp', value: -1 },
          { op: 'emit', event: 'health:changed', payload: { key: 'hp' } }
        ],
        heal: [
          { op: 'set', path: 'hp', value: '$maxHp' }
        ]
      }
    });
    const events = [];
    const actor = { id: 'player' };
    const runtime = behavior.attach(actor, {
      properties: { hp: 2 },
      emit: (event, payload) => events.push({ event, payload })
    });

    runtime.dispatch('damage');
    expect(runtime.properties.hp).toBe(1);
    expect(actor.behaviors.health.hp).toBe(1);
    expect(events).toEqual([{ event: 'health:changed', payload: { key: 'hp' } }]);

    runtime.dispatch('heal');
    expect(runtime.properties.hp).toBe(3);
  });

  it('manages scene transition stacks with lifecycle events', () => {
    const calls = [];
    const stack = new SceneTransitionStack({
      hooks: {
        enter: (entry) => calls.push(`enter:${entry.name}`),
        pause: (entry) => calls.push(`pause:${entry.name}`),
        resume: (entry) => calls.push(`resume:${entry.name}`),
        exit: (entry) => calls.push(`exit:${entry.name}`)
      }
    });

    stack.push('menu');
    stack.push('game', { level: 1 });
    expect(stack.current()).toMatchObject({ name: 'game', params: { level: 1 } });
    stack.pop();
    stack.replace('credits');

    expect(calls).toEqual([
      'enter:menu',
      'pause:menu',
      'enter:game',
      'exit:game',
      'resume:menu',
      'exit:menu',
      'enter:credits'
    ]);
  });

  it('validates module gem manifests and computes activation order', () => {
    const manifest = new ModuleGemManifest({
      modules: [
        { id: 'core', version: '1.0.0' },
        { id: 'render', dependsOn: ['core'] },
        { id: 'gameplay', dependsOn: ['core', 'render'], permissions: ['assets:read'] }
      ]
    });

    expect(manifest.activationOrder()).toEqual(['core', 'render', 'gameplay']);
    expect(manifest.validate().ok).toBe(true);

    const broken = new ModuleGemManifest({
      modules: [{ id: 'editor', dependsOn: ['missing'] }]
    });
    expect(broken.validate().errors).toEqual([
      {
        code: 'missing-dependency',
        module: 'editor',
        dependency: 'missing',
        message: 'Module editor depends on missing module missing.'
      }
    ]);
  });
});
