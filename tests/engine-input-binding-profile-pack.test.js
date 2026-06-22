import { describe, expect, it } from 'vitest';
import { InputBindingProfile } from '../src/index.js';

describe('engine input binding profile pack', () => {
  it('rebounds controls with conflict repair, persistent overrides, and input hints', () => {
    const profile = new InputBindingProfile({
      glyphs: {
        '<Keyboard>/space': 'Space',
        '<Keyboard>/ctrl': 'Ctrl',
        '<Gamepad>/buttonSouth': 'A'
      },
      contexts: {
        gameplay: {
          priority: 0,
          enabled: true,
          actions: {
            jump: [
              { path: '<Keyboard>/space', groups: ['Keyboard&Mouse'] },
              { path: '<Gamepad>/buttonSouth', groups: ['Gamepad'] }
            ],
            crouch: [
              { path: '<Keyboard>/ctrl', groups: ['Keyboard&Mouse'] }
            ]
          }
        }
      }
    });

    const result = profile.rebind('crouch', '<Keyboard>/space', {
      context: 'gameplay',
      group: 'Keyboard&Mouse',
      conflictStrategy: 'unassign'
    });

    expect(result).toMatchObject({
      action: 'crouch',
      context: 'gameplay',
      binding: {
        path: '<Keyboard>/ctrl',
        overridePath: '<Keyboard>/space',
        effectivePath: '<Keyboard>/space',
        display: 'Space'
      },
      conflictsResolved: [
        {
          action: 'jump',
          context: 'gameplay',
          path: '<Keyboard>/space',
          strategy: 'unassign'
        }
      ]
    });
    expect(profile.auditConflicts({ group: 'Keyboard&Mouse' })).toEqual([]);

    const restored = new InputBindingProfile({
      glyphs: {
        '<Keyboard>/space': 'Space',
        '<Keyboard>/ctrl': 'Ctrl',
        '<Gamepad>/buttonSouth': 'A'
      },
      contexts: {
        gameplay: {
          priority: 0,
          enabled: true,
          actions: {
            jump: [
              { path: '<Keyboard>/space', groups: ['Keyboard&Mouse'] },
              { path: '<Gamepad>/buttonSouth', groups: ['Gamepad'] }
            ],
            crouch: [
              { path: '<Keyboard>/ctrl', groups: ['Keyboard&Mouse'] }
            ]
          }
        }
      }
    }).loadOverrides(profile.saveOverrides());

    expect(restored.effectiveBindings('jump', { group: 'Keyboard&Mouse' })).toEqual([]);
    expect(restored.effectiveBindings('crouch', { group: 'Keyboard&Mouse' })).toMatchObject([
      {
        path: '<Keyboard>/ctrl',
        overridePath: '<Keyboard>/space',
        effectivePath: '<Keyboard>/space',
        display: 'Space'
      }
    ]);

    const calls = [];
    restored.applyToInputManager({
      mapAction(action, bindings) {
        calls.push({ action, bindings });
        return () => calls.push({ disposed: action });
      }
    }, { group: 'Keyboard&Mouse' });

    expect(calls).toEqual([
      {
        action: 'crouch',
        bindings: [
          {
            type: 'keyboard',
            combo: 'Space',
            path: '<Keyboard>/space',
            display: 'Space',
            groups: ['Keyboard&Mouse']
          }
        ]
      }
    ]);
    expect(restored.hints({ group: 'Keyboard&Mouse' })).toEqual([
      {
        action: 'crouch',
        context: 'gameplay',
        path: '<Keyboard>/space',
        display: 'Space',
        groups: ['Keyboard&Mouse']
      }
    ]);
  });

  it('resolves active mapping contexts by priority like an enhanced input stack', () => {
    const profile = new InputBindingProfile({
      contexts: {
        gameplay: {
          priority: 0,
          enabled: true,
          actions: {
            interact: [{ path: '<Keyboard>/e', groups: ['Keyboard&Mouse'] }]
          }
        },
        vehicle: {
          priority: 20,
          actions: {
            exitVehicle: [{ path: '<Keyboard>/e', groups: ['Keyboard&Mouse'] }]
          }
        }
      }
    });

    expect(profile.resolve({ path: '<Keyboard>/e', group: 'Keyboard&Mouse' })).toMatchObject({
      action: 'interact',
      context: 'gameplay',
      path: '<Keyboard>/e'
    });

    profile.enableContext('vehicle');

    expect(profile.resolve({ path: '<Keyboard>/e', group: 'Keyboard&Mouse' })).toMatchObject({
      action: 'exitVehicle',
      context: 'vehicle',
      path: '<Keyboard>/e'
    });
    expect(profile.auditConflicts({ group: 'Keyboard&Mouse' })).toEqual([
      {
        path: '<Keyboard>/e',
        group: 'Keyboard&Mouse',
        bindings: [
          { action: 'exitVehicle', context: 'vehicle', display: 'E' },
          { action: 'interact', context: 'gameplay', display: 'E' }
        ]
      }
    ]);
  });
});
