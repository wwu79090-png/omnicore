import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INTERACTABLE_2D_25D_SCHEMA,
  createInteractable2D25DDirectorStep
} from '../src/index.js';

describe('2D/2.5D interactable director', () => {
  it('coordinates prompts, switches, doors, chests, dialogue, checkpoints, state, events, editor, and runtime sync', () => {
    const step = createInteractable2D25DDirectorStep({
      delta: 0.016,
      player: {
        id: 'hero',
        x: 100,
        y: 96,
        width: 20,
        height: 28,
        facing: 'right',
        inventory: { keys: 1, coins: 0 }
      },
      input: {
        interactPressed: true,
        interactTargetIds: ['switch-alpha', 'treasure-chest']
      },
      worldState: {
        switches: { 'switch-alpha': false },
        doors: { 'gate-a': { locked: true, open: false } },
        chests: { 'treasure-chest': { opened: false } },
        checkpoints: { active: 'checkpoint-start' }
      },
      interactables: [
        {
          id: 'switch-alpha',
          type: 'switch',
          x: 124,
          y: 100,
          width: 16,
          height: 16,
          radius: 48,
          prompt: 'Pull switch',
          priority: 10,
          effects: [
            { type: 'set-state', targetId: 'gate-a', domain: 'doors', key: 'locked', value: false },
            { type: 'emit-event', event: 'gate:unlock', targetId: 'gate-a' }
          ]
        },
        {
          id: 'gate-a',
          type: 'door',
          x: 156,
          y: 88,
          width: 26,
          height: 48,
          radius: 64,
          prompt: 'Open gate',
          locked: true,
          transition: { scene: 'room-2', spawn: 'entry' }
        },
        {
          id: 'treasure-chest',
          type: 'chest',
          x: 114,
          y: 122,
          width: 18,
          height: 14,
          radius: 42,
          prompt: 'Open chest',
          loot: [{ id: 'coins', amount: 5 }]
        },
        {
          id: 'npc-guide',
          type: 'npc',
          x: 82,
          y: 96,
          width: 18,
          height: 28,
          radius: 50,
          prompt: 'Talk',
          dialogue: 'intro-guide'
        },
        {
          id: 'checkpoint-hill',
          type: 'checkpoint',
          x: 96,
          y: 116,
          width: 32,
          height: 24,
          radius: 24,
          auto: true,
          respawn: { x: 96, y: 96 }
        }
      ]
    });

    expect(step.schema).toBe(INTERACTABLE_2D_25D_SCHEMA);
    expect(step.prompts.ready).toEqual(expect.arrayContaining([
      expect.objectContaining({ interactableId: 'switch-alpha', type: 'switch', prompt: 'Pull switch', available: true }),
      expect.objectContaining({ interactableId: 'gate-a', type: 'door', prompt: 'Open gate', available: false, locked: true }),
      expect.objectContaining({ interactableId: 'treasure-chest', type: 'chest', prompt: 'Open chest', available: true }),
      expect.objectContaining({ interactableId: 'npc-guide', type: 'npc', prompt: 'Talk', available: true })
    ]));
    expect(step.interactions.activated).toEqual(expect.arrayContaining([
      expect.objectContaining({ interactableId: 'switch-alpha', action: 'toggle-switch' }),
      expect.objectContaining({ interactableId: 'treasure-chest', action: 'open-chest' }),
      expect.objectContaining({ interactableId: 'checkpoint-hill', action: 'save-checkpoint', automatic: true })
    ]));
    expect(step.stateUpdates.switches).toEqual([
      expect.objectContaining({ switchId: 'switch-alpha', active: true })
    ]);
    expect(step.stateUpdates.doors).toEqual([
      expect.objectContaining({ doorId: 'gate-a', locked: false, sourceId: 'switch-alpha' })
    ]);
    expect(step.stateUpdates.chests).toEqual([
      expect.objectContaining({ chestId: 'treasure-chest', opened: true })
    ]);
    expect(step.stateUpdates.inventoryDeltas).toEqual([
      expect.objectContaining({ itemId: 'coins', amount: 5, sourceId: 'treasure-chest' })
    ]);
    expect(step.stateUpdates.checkpoint).toEqual(expect.objectContaining({
      checkpointId: 'checkpoint-hill',
      respawn: { x: 96, y: 96 }
    }));
    expect(step.effects.applied).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'set-state', targetId: 'gate-a', key: 'locked', value: false }),
      expect.objectContaining({ type: 'grant-loot', targetId: 'hero', itemId: 'coins', amount: 5 })
    ]));
    expect(step.events.queue).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'interactable:switch-toggle', interactableId: 'switch-alpha' }),
      expect.objectContaining({ type: 'gate:unlock', targetId: 'gate-a' }),
      expect.objectContaining({ type: 'interactable:chest-open', interactableId: 'treasure-chest' }),
      expect.objectContaining({ type: 'interactable:checkpoint-save', interactableId: 'checkpoint-hill' })
    ]));
    expect(step.editor.panels).toEqual(expect.arrayContaining([
      'InteractableDirector',
      'Prompts',
      'Switches',
      'Doors',
      'Chests',
      'Dialogue',
      'Checkpoints',
      'RuntimeDebug'
    ]));
    expect(step.runtimeSync.payloads).toEqual(expect.arrayContaining([
      'prompts',
      'interactions',
      'stateUpdates',
      'effects',
      'events',
      'editor'
    ]));
    expect(step.debugDraw.map((command) => command.op)).toEqual(expect.arrayContaining([
      'debug:interaction-radius',
      'debug:interaction-prompt',
      'debug:interaction-effect',
      'debug:checkpoint'
    ]));
    expect(step.quality.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'interaction-prompts', pass: true }),
      expect.objectContaining({ id: 'interaction-activation', pass: true }),
      expect.objectContaining({ id: 'interaction-state-updates', pass: true }),
      expect.objectContaining({ id: 'interaction-events', pass: true }),
      expect.objectContaining({ id: 'editor-runtime-interaction-sync', pass: true })
    ]));
  });

  it('is wired into the official 2D/2.5D platformer demo', () => {
    const root = join(process.cwd(), 'examples/2d-25d-platformer-demo');
    const main = readFileSync(join(root, 'src/main.js'), 'utf8');
    const readme = readFileSync(join(root, 'README.md'), 'utf8');

    expect(main).toContain('createInteractable2D25DDirectorStep');
    expect(main).toContain('InteractableDirector');
    expect(main).toContain('Switches');
    expect(main).toContain('Doors');
    expect(main).toContain('Chests');
    expect(readme).toContain('interactable director');
    expect(readme).toContain('switches and doors');
    expect(readme).toContain('chests and checkpoints');
  });
});
