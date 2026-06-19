import { afterEach, describe, expect, it } from 'vitest';
import { AnimationEditor } from '../src/index.js';

describe('artist animation authoring closed loop', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('builds jump animation across Sprite, Transform, and Color tracks and binds it to Animator transitions', () => {
    const editor = new AnimationEditor({
      frames: ['jump-up', 'jump-fall'],
      animation: 'jump'
    }).attach(document.body);

    expect([...document.querySelectorAll('[data-timeline-track]')].map((node) => node.dataset.timelineTrack)).toEqual([
      'Sprite',
      'Transform',
      'Color'
    ]);
    expect(document.querySelector('[data-curve-name="easeIn"]')).toBeTruthy();
    expect(document.querySelector('[data-curve-name="easeOut"]')).toBeTruthy();
    expect(document.querySelector('[data-curve-name="bounce"]')).toBeTruthy();

    editor.addKeyframe('jump-up', { track: 'Sprite', time: 0, easing: 'easeOut' });
    editor.addKeyframe('jump-up', { track: 'Transform', time: 0.15, y: -64, easing: 'easeOut' });
    editor.addKeyframe('jump-fall', { track: 'Color', time: 0.4, tint: '#dbeafe', alpha: 0.75, easing: 'bounce' });
    editor.addParameter('isGrounded', 'boolean', true);
    editor.addState('idle', { animation: 'idle' });
    editor.addState('walk', { animation: 'walk' });
    editor.addState('attack', { animation: 'attack', loop: false });
    editor.addState('jump', { animation: 'jump', loop: false });
    editor.addTransition('idle', 'jump', { when: { isGrounded: false }, blend: 0.08 });
    editor.addTransition('jump', 'idle', { when: { isGrounded: true }, blend: 0.12 });

    const exported = editor.exportAnimationJson();
    const animator = editor.exportStateMachineJson();

    expect(exported.animations.jump.tracks.Sprite.keyframes).toHaveLength(1);
    expect(exported.animations.jump.tracks.Transform.keyframes[0]).toMatchObject({ y: -64, easing: 'easeOut' });
    expect(exported.animations.jump.tracks.Color.keyframes[0]).toMatchObject({ tint: '#dbeafe', easing: 'bounce' });
    expect(animator.parameters.isGrounded).toMatchObject({ type: 'boolean', default: true });
    expect(animator.transitions).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'idle', to: 'jump', when: { isGrounded: false } }),
      expect.objectContaining({ from: 'jump', to: 'idle', when: { isGrounded: true } })
    ]));
    expect(document.querySelector('[data-animator-edge="idle->jump"]')).toBeTruthy();
  });
});
