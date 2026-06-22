import { beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let createEditorApp;
let createEditorState;

beforeAll(async () => {
  ({ createEditorApp } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/editor-app.js')).href));
  ({ createEditorState } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/live-sync-protocol.js')).href));
});

function mountPolishEditor() {
  document.body.innerHTML = '<main id="app"></main>';
  const root = document.querySelector('#app');
  const app = createEditorApp(root, {
    autoCheckRecovery: false,
    state: createEditorState({
      scene: {
        name: 'polish',
        entities: [
          {
            id: 'hero',
            name: 'Hero',
            type: 'sprite',
            sprite: 'assets/hero.webp',
            texture: 'assets/hero.webp',
            x: 12,
            y: 24,
            width: 64,
            height: 64
          }
        ]
      },
      selectedEntityId: 'hero',
      selectedEntityIds: ['hero'],
      prefabs: [
        { id: 'skeleton', name: 'Skeleton', sprite: 'skeleton.webp', damage: 8, hp: 100 }
      ],
      assets: [
        { path: 'assets/ui/panel.webp', type: 'image', url: 'file:///project/assets/ui/panel.webp' },
        { path: 'scenes/town.json', type: 'scene', data: { name: 'town', entities: [{ id: 'npc', x: 16, y: 16 }] } }
      ],
      animations: {
        jump: {
          id: 'jump',
          duration: 24,
          tracks: {
            y: { keyframes: [{ frame: 0, value: 0, easing: 'Linear' }] }
          },
          events: []
        }
      },
      dockLayout: {
        left: ['prefabs', 'assets'],
        center: ['scene-view'],
        right: ['inspector'],
        bottom: ['animation-timeline', 'profiler']
      }
    })
  });
  return { root, app };
}

describe('industrial editor polish pass', () => {
  it('persists industrial authoring state in editor snapshots and autosave payloads', () => {
    const { app } = mountPolishEditor();

    app.selectAnimationKeyframe('jump', 'y', 0);
    app.addAnimationEvent('jump', 12, 'land');
    app.openParticleEditor();
    app.setParticleParameter('emissionRate', 96);
    app.openSpriteEditor('assets/ui/panel.webp');
    app.setNineSliceGuides({ left: 6, right: 58, top: 8, bottom: 54 });
    app.recordProfilerFrame({ frame: 1, totalMs: 11, sections: [{ name: 'Update', duration: 3 }], memoryMB: 96, drawCalls: 30 });
    app.openSceneTab({ path: 'scenes/town.json', scene: { name: 'town', entities: [{ id: 'npc', x: 16, y: 16 }] } });

    const snapshot = app.saveSnapshot('industrial-polish');

    expect(snapshot.animations.jump.events).toEqual([expect.objectContaining({ name: 'land', frame: 12 })]);
    expect(snapshot.selectedAnimationKeyframe).toMatchObject({ clipId: 'jump', track: 'y', frame: 0 });
    expect(snapshot.particleEditor.config.emissionRate).toBe(96);
    expect(snapshot.spriteEditor.nineSlice).toMatchObject({ left: 6, right: 58, top: 8, bottom: 54 });
    expect(snapshot.profilerHistory).toEqual([expect.objectContaining({ memoryMB: 96, drawCalls: 30 })]);
    expect(snapshot.sceneTabs).toEqual([expect.objectContaining({ path: 'scenes/town.json' })]);
    expect(snapshot.activeSceneTabPath).toBe('scenes/town.json');
    app.destroy();
  });

  it('covers particle and sprite visual edits with undo and redo', () => {
    const { app } = mountPolishEditor();

    app.openParticleEditor();
    app.setParticleParameter('emissionRate', 120);
    expect(app.getState().particleEditor.config.emissionRate).toBe(120);
    app.undo();
    expect(app.getState().particleEditor.config.emissionRate).toBe(30);
    app.redo();
    expect(app.getState().particleEditor.config.emissionRate).toBe(120);

    app.openSpriteEditor('assets/ui/panel.webp');
    app.setNineSliceGuides({ left: 10, right: 50, top: 12, bottom: 48 });
    expect(app.getState().spriteEditor.nineSlice.left).toBe(10);
    app.undo();
    expect(app.getState().spriteEditor.nineSlice.left).toBe(0);
    app.redo();
    expect(app.getState().spriteEditor.nineSlice.left).toBe(10);
    app.destroy();
  });

  it('adds prefab override action buttons for write-back and reset', () => {
    const { root, app } = mountPolishEditor();

    app.EditorAPI.createPrefabVariant('skeleton', {
      id: 'fire-skeleton',
      name: 'Fire Skeleton',
      sprite: 'fire.webp',
      damage: 24
    }, { asVariant: true });
    app.selectPrefab('fire-skeleton');

    root.querySelector('[data-prefab-override-action="damage:write"]').click();
    expect(app.getState().prefabs.find((prefab) => prefab.id === 'skeleton').damage).toBe(24);

    root.querySelector('[data-prefab-override-action="sprite:reset"]').click();
    expect(app.getState().prefabs.find((prefab) => prefab.id === 'fire-skeleton').sprite).toBe('skeleton.webp');
    app.destroy();
  });

  it('renders typed material controls and profiler history streams', () => {
    const { root, app } = mountPolishEditor();

    app.setSpriteMaterial('hero', { alphaClip: 0.25, colorTint: '#00ff66', normalMap: 'assets/hero_n.webp' });
    app.openProfiler();
    app.recordProfilerFrame({ frame: 1, totalMs: 9, sections: [{ name: 'Update', duration: 3 }], memoryMB: 96, drawCalls: 31 });
    app.recordProfilerFrame({ frame: 2, totalMs: 12, sections: [{ name: 'Collision', duration: 6 }], memoryMB: 128, drawCalls: 44 });

    expect(root.querySelector('[data-material-field="colorTint"]').type).toBe('color');
    expect(root.querySelector('[data-material-field="alphaClip"]').type).toBe('number');
    expect(root.querySelector('[data-profiler-history]')?.textContent).toContain('128MB');
    expect(root.querySelector('[data-profiler-history]')?.textContent).toContain('44 次调用');
    app.destroy();
  });
});
