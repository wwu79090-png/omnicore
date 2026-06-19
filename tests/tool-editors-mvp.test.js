import { describe, expect, it } from 'vitest';
import {
  AudioEditor,
  DataTableEditor,
  SkeletonAnimationEditor
} from '../src/index.js';

describe('runtime tool editors MVP', () => {
  it('exports draggable skeleton animation data as .omni-anim', () => {
    const editor = new SkeletonAnimationEditor();

    editor.addBone('hip', { x: 8, y: 12 });
    editor.dragBone('hip', { x: 16, y: 20 });
    editor.addKeyframe('walk', 0, { hip: { x: 16, y: 20 } });
    editor.generateTweenFrames('walk', { hip: { x: 32, y: 20 } }, { frames: 2 });

    expect(editor.exportOmniAnim()).toMatchObject({
      format: 'OmniCore.OmniAnim',
      extension: '.omni-anim',
      bones: [{ id: 'hip', x: 32, y: 20 }],
      animations: {
        walk: expect.arrayContaining([
          expect.objectContaining({ frame: 0 }),
          expect.objectContaining({ frame: 2 })
        ])
      }
    });
  });

  it('imports CSV into JSON config and supports version rollback', () => {
    const editor = new DataTableEditor();

    editor.importCSV('id,hp\nhero,10\nslime,3');
    const firstVersion = editor.commitVersion('initial import');
    editor.importCSV('id,hp\nhero,12\nslime,3');
    editor.commitVersion('balance hero');
    editor.rollback(firstVersion.id);

    expect(editor.exportJSON()).toEqual([
      { id: 'hero', hp: '10' },
      { id: 'slime', hp: '3' }
    ]);
  });

  it('edits audio parameters at runtime and exports a custom audio config', () => {
    const editor = new AudioEditor();

    editor.setSound('jump', { volume: 0.6, pitch: 1.25, reverb: 0.3 });

    expect(editor.exportConfig()).toMatchObject({
      format: 'OmniCore.AudioConfig',
      version: 1,
      sounds: {
        jump: { volume: 0.6, pitch: 1.25, reverb: 0.3 }
      }
    });
  });
});
