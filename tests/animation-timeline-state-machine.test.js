import { afterEach, describe, expect, it } from 'vitest';
import { AnimationEditor } from '../src/index.js';

describe('animation timeline curve editor and state machine panel', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('exports named easing curves and animation state machine data from the editor UI', () => {
    const storeData = new Map();
    const store = {
      set(key, value) {
        storeData.set(key, value);
      },
      get(key) {
        return storeData.get(key);
      }
    };
    const editor = new AnimationEditor({
      frames: ['idle-0', 'run-0'],
      animation: 'hero',
      store
    }).attach(document.body);

    expect(document.querySelector('[data-curve-editor]')).toBeTruthy();
    expect(document.querySelector('[data-state-machine-panel]')).toBeTruthy();

    editor.setEasingCurve('anticipate', [0, 0, 0.25, -0.1, 0.75, 1.1, 1, 1]);
    editor.addKeyframe('idle-0', { time: 0, easing: 'anticipate', scale: 1 });
    editor.addKeyframe('run-0', { time: 1, easing: 'anticipate', scale: 2 });
    editor.addState('idle', { animation: 'hero-idle', loop: true });
    editor.addState('run', { animation: 'hero-run', loop: true });
    editor.addTransition('idle', 'run', { when: { moving: true }, blend: 0.12 });

    const animationJson = editor.exportAnimationJson();
    const machineJson = editor.exportStateMachineJson();

    expect(animationJson.curves.anticipate.points).toEqual([
      { x: 0, y: 0 },
      { x: 0.25, y: -0.1 },
      { x: 0.75, y: 1.1 },
      { x: 1, y: 1 }
    ]);
    expect(animationJson.animations.hero.keyframes[0]).toMatchObject({
      easing: 'anticipate',
      curve: 'anticipate'
    });
    expect(machineJson).toMatchObject({
      format: 'OmniCore.AnimationStateMachine',
      initial: 'idle',
      states: {
        idle: { animation: 'hero-idle', loop: true },
        run: { animation: 'hero-run', loop: true }
      },
      transitions: [{ from: 'idle', to: 'run', when: { moving: true }, blend: 0.12 }]
    });
    expect(store.get('editor:animationCurves')).toHaveProperty('anticipate');
    expect(store.get('editor:animationStateMachine').states.run.animation).toBe('hero-run');
    expect(document.querySelector('[data-curve-name="anticipate"]')).toBeTruthy();
    expect(document.querySelector('[data-state-id="run"]')).toBeTruthy();
  });
});
