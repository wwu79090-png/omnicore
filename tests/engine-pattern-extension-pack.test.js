import { describe, expect, it } from 'vitest';
import {
  DebugProbe,
  DialogueGraph,
  LevelValidationReport,
  MaterialPreset,
  NarrativeRuntime,
  PrefabVariantRegistry,
  QuestStateMachine,
  RemoteEventContract,
  RenderFeatureProfile
} from '../src/index.js';

describe('engine pattern extension pack', () => {
  it('resolves prefab variants and creates deterministic instance ids', () => {
    const registry = new PrefabVariantRegistry();
    registry.register('enemy.base', {
      type: 'sprite',
      texture: 'enemy.png',
      props: { hp: 10, speed: 40 },
      children: [
        { id: 'weapon', type: 'sprite', texture: 'claw.png', props: { damage: 2 } }
      ]
    });
    registry.variant('enemy.elite', {
      base: 'enemy.base',
      tags: ['elite'],
      overrides: {
        texture: 'elite.png',
        props: { hp: 30 },
        children: {
          weapon: { props: { damage: 8 } }
        }
      }
    });

    const resolved = registry.resolve('enemy.elite');
    expect(resolved.texture).toBe('elite.png');
    expect(resolved.tags).toEqual(['elite']);
    expect(resolved.props).toEqual({ hp: 30, speed: 40 });
    expect(resolved.children[0].props).toEqual({ damage: 8 });

    const instance = registry.instantiate('enemy.elite', {
      idPrefix: 'wave-1',
      overrides: { props: { spawn: 'north' } }
    });
    expect(instance.id).toBe('wave-1/enemy.elite');
    expect(instance.children[0].id).toBe('wave-1/enemy.elite/weapon');
    expect(instance.props).toEqual({ hp: 30, speed: 40, spawn: 'north' });
    expect(registry.manifest().variants).toContain('enemy.elite');
  });

  it('validates remote event contracts before serializing envelopes', () => {
    const contract = new RemoteEventContract({
      events: {
        'player.move': {
          direction: 'clientToServer',
          payload: { x: 'number', y: 'number', action: 'string?' },
          reliable: false
        },
        'state.sync': {
          direction: 'serverToClient',
          payload: { tick: 'number', players: 'array' }
        }
      }
    });

    expect(contract.validate('player.move', { x: 4, y: 2 }, { direction: 'clientToServer' }).ok).toBe(true);
    const invalid = contract.validate('player.move', { x: '4' }, { direction: 'serverToClient' });
    expect(invalid.ok).toBe(false);
    expect(invalid.errors.map((error) => error.code)).toEqual(['invalid-direction', 'invalid-type', 'missing-field']);

    expect(contract.serialize('player.move', { x: 1, y: 2 })).toEqual({
      schema: 'omnicore.remote-event.v1',
      event: 'player.move',
      direction: 'clientToServer',
      reliable: false,
      payload: { x: 1, y: 2 }
    });
  });

  it('runs dialogue choices with variable interpolation and choice filters', () => {
    const graph = new DialogueGraph({
      start: 'intro',
      nodes: {
        intro: {
          speaker: 'guide',
          text: 'Hello {hero}',
          choices: [
            { text: 'Accept', next: 'accepted', set: { acceptedQuest: true } },
            { text: 'Use key', next: 'secret', when: { hasKey: true } }
          ]
        },
        accepted: { text: 'Quest started', end: true },
        secret: { text: 'Hidden room', end: true }
      }
    });

    const state = graph.start({ variables: { hero: 'Mira' } });
    expect(state.current.text).toBe('Hello Mira');
    expect(state.choices.map((choice) => choice.text)).toEqual(['Accept']);

    const next = graph.choose(state, 0);
    expect(next.nodeId).toBe('accepted');
    expect(next.variables.acceptedQuest).toBe(true);
    expect(next.current.end).toBe(true);
  });

  it('tracks staged quest objectives and resolves rewards', () => {
    const quest = new QuestStateMachine({
      id: 'quest.herbs',
      stages: [
        { id: 'collect', objectives: [{ id: 'herb', target: 3 }] },
        { id: 'return', objectives: [{ id: 'talk', target: 1 }], rewards: { xp: 50 } }
      ]
    });

    let state = quest.start();
    state = quest.progress(state, 'herb', 2);
    expect(state.completed).toBe(false);
    expect(state.objectives.herb.current).toBe(2);

    state = quest.progress(state, 'herb', 1);
    expect(state.stageId).toBe('return');
    state = quest.progress(state, 'talk', 1);
    expect(state.completed).toBe(true);
    expect(state.rewards).toEqual({ xp: 50 });
  });

  it('resolves material variants and render feature profiles for platform budgets', () => {
    const material = new MaterialPreset({
      id: 'water',
      parameters: { tint: '#66ccff', roughness: 0.2 },
      features: { reflections: true },
      variants: {
        low: { parameters: { normalMap: null }, features: { reflections: false } },
        mobile: { parameters: { textureScale: 0.5 } }
      }
    });
    const profile = new RenderFeatureProfile({
      id: 'mobile',
      quality: 'medium',
      features: { shadows: false, postProcessing: false },
      budgets: { textureMB: 64, drawCalls: 500 },
      materialVariant: 'mobile'
    });

    expect(material.resolve('low').features.reflections).toBe(false);
    const plan = profile.applyTo({ materials: [material] });
    expect(plan.features).toEqual({ postProcessing: false, shadows: false });
    expect(plan.materials[0].parameters.textureScale).toBe(0.5);

    const report = profile.validate({ estimatedTextureMB: 96, drawCalls: 300 });
    expect(report.ok).toBe(false);
    expect(report.warnings[0].code).toBe('texture-budget-exceeded');
  });

  it('executes lightweight narrative scripts with choices, variables, and jumps', () => {
    const runtime = new NarrativeRuntime({
      variables: { hero: 'Mira' },
      script: `
:: start
Hello {$hero}
[[Take sword|armed]] {set hasSword true}
[[Leave|end]]

:: armed
You have the sword.
-> end

:: end
Done.
`
    });

    let step = runtime.start();
    expect(step.text).toEqual(['Hello Mira']);
    expect(step.choices.map((choice) => choice.text)).toEqual(['Take sword', 'Leave']);

    step = runtime.choose(0);
    expect(step.node).toBe('armed');
    expect(runtime.variables.hasSword).toBe(true);
    expect(step.text).toEqual(['You have the sword.']);

    step = runtime.continue();
    expect(step.node).toBe('end');
    expect(step.text).toEqual(['Done.']);
  });

  it('captures debug probes and validates level authoring issues', () => {
    let now = 10;
    const probe = new DebugProbe({
      clock: () => {
        now += 5;
        return now;
      }
    });
    probe.mark('spawn', { id: 'enemy-1' });
    const result = probe.measure('system.update', () => 'ok');
    probe.captureEntity({ id: 'enemy-1', type: 'sprite', x: 4, components: [{ type: 'AI' }] });

    expect(result).toBe('ok');
    expect(probe.snapshot().events.map((event) => event.name)).toEqual(['spawn', 'system.update']);
    expect(probe.snapshot().entities[0].componentCount).toBe(1);

    const report = LevelValidationReport.validate({
      scene: {
        children: [
          { id: 'player', texture: 'missing.png' },
          { id: 'player', texture: 'hero.png' }
        ]
      },
      assets: { images: ['hero.png'] },
      requiredSpawnPoints: ['playerSpawn']
    });
    expect(report.ok).toBe(false);
    expect(report.errors.map((error) => error.code)).toEqual([
      'duplicate-id',
      'missing-asset',
      'missing-spawn-point'
    ]);
  });
});
