import { describe, expect, it, vi } from 'vitest';
import { createEditorApp } from 'omnicore-editor/src/editor-app.js';
import { createEditorState } from 'omnicore-editor/src/live-sync-protocol.js';

function mountIndustrialEditor() {
  document.body.innerHTML = '<main id="app"></main>';
  const root = document.querySelector('#app');
  const app = createEditorApp(root, {
    autoCheckRecovery: false,
    state: createEditorState({
      scene: {
        name: 'authoring',
        entities: [
          {
            id: 'hero',
            name: 'Hero',
            type: 'sprite',
            sprite: 'assets/hero.webp',
            texture: 'assets/hero.webp',
            x: 24,
            y: 32,
            width: 64,
            height: 64
          }
        ]
      },
      selectedEntityId: 'hero',
      selectedEntityIds: ['hero'],
      prefabs: [
        { id: 'skeleton', name: '标准骷髅怪', sprite: 'skeleton.webp', damage: 8, hp: 100 }
      ],
      assets: [
        { path: 'assets/ui/panel.webp', type: 'image', url: 'file:///project/assets/ui/panel.webp' },
        { path: 'scenes/cave.json', type: 'scene', data: { name: 'cave', entities: [{ id: 'torch', x: 8, y: 8 }] } }
      ],
      animations: {
        jump: {
          id: 'jump',
          duration: 24,
          tracks: {
            y: {
              keyframes: [
                { frame: 0, value: 0, easing: 'Linear' },
                { frame: 12, value: 48, easing: 'EaseOutBack' }
              ]
            }
          },
          events: []
        }
      },
      dockLayout: {
        left: ['assets', 'prefabs'],
        center: ['scene-view'],
        right: ['inspector'],
        bottom: ['animation-timeline', 'profiler']
      }
    })
  });
  return { root, app };
}

describe('industrial editor authoring suite', () => {
  it('edits animation curves and emits frame events from the timeline', () => {
    const { root, app } = mountIndustrialEditor();
    const eventBus = { emit: vi.fn() };

    app.selectAnimationKeyframe('jump', 'y', 12);
    app.setAnimationCurve('jump', 'y', 12, {
      preset: 'Elastic',
      handles: { in: { x: 8, y: 42 }, out: { x: 16, y: 58 } }
    });
    app.addAnimationEvent('jump', 12, 'playLandingSfx');
    app.previewAnimationFrame('jump', 12, { eventBus });

    expect(root.querySelector('[data-animation-curve-graph="jump:y:12"]')).toBeTruthy();
    expect([...root.querySelectorAll('[data-easing-preset]')].map((node) => node.dataset.easingPreset)).toEqual(
      expect.arrayContaining(['Linear', 'EaseInQuad', 'EaseOutBack', 'Elastic'])
    );
    expect(root.querySelector('[data-animation-event-frame="12"]')?.textContent).toContain('playLandingSfx');
    expect(eventBus.emit).toHaveBeenCalledWith('playLandingSfx', expect.objectContaining({ clipId: 'jump', frame: 12 }));
    expect(app.exportAnimationClip('jump')).toMatchObject({
      events: [expect.objectContaining({ frame: 12, name: 'playLandingSfx' })],
      tracks: {
        y: expect.objectContaining({
          keyframes: expect.arrayContaining([
            expect.objectContaining({ frame: 12, easing: 'Elastic' })
          ])
        })
      }
    });
    app.destroy();
  });

  it('creates prefab variants, highlights overrides, writes back, and resets fields', () => {
    const { root, app } = mountIndustrialEditor();

    const variant = app.EditorAPI.createPrefabVariant('skeleton', {
      id: 'fire-skeleton',
      name: '火焰骷髅怪',
      sprite: 'fire-skeleton.webp',
      damage: 20
    }, { asVariant: true });
    app.selectPrefab('fire-skeleton');

    expect(variant).toMatchObject({
      id: 'fire-skeleton',
      extends: 'skeleton',
      overrides: expect.objectContaining({ sprite: 'fire-skeleton.webp', damage: 20 })
    });
    expect(root.querySelector('[data-prefab-override="sprite"]')?.textContent).toContain('fire-skeleton.webp');
    expect(root.querySelector('[data-prefab-override="damage"]')?.className).toContain('override');

    app.writePrefabOverrideToBase('fire-skeleton', 'damage');
    expect(app.getState().prefabs.find((prefab) => prefab.id === 'skeleton').damage).toBe(20);
    app.resetPrefabOverride('fire-skeleton', 'sprite');
    expect(app.getState().prefabs.find((prefab) => prefab.id === 'fire-skeleton')).toMatchObject({
      sprite: 'skeleton.webp',
      overrides: expect.not.objectContaining({ sprite: expect.anything() })
    });
    app.destroy();
  });

  it('authors particles visually and exports stable particle_config.json payloads', () => {
    const { root, app } = mountIndustrialEditor();

    app.openParticleEditor();
    app.setParticleParameter('emissionRate', 120);
    app.setParticleParameter('lifetime', 0.7);
    app.setParticleParameter('initialVelocity', 260);
    app.setParticleParameter('gravity', 380);
    app.setParticleCurve('size', [{ t: 0, value: 1 }, { t: 1, value: 0 }]);
    app.setParticleGradient([{ t: 0, color: '#ffffff' }, { t: 1, color: '#ff6b00' }]);

    expect(root.querySelector('[data-particle-editor]')).toBeTruthy();
    expect(root.querySelector('[data-particle-slider="emissionRate"]').value).toBe('120');
    expect(root.querySelector('[data-particle-preview]')).toBeTruthy();
    expect(app.exportParticleConfig()).toMatchObject({
      fileName: 'particle_config.json',
      config: {
        emissionRate: 120,
        lifetime: 0.7,
        initialVelocity: 260,
        gravity: 380,
        curves: { size: [{ t: 0, value: 1 }, { t: 1, value: 0 }] },
        gradient: [{ t: 0, color: '#ffffff' }, { t: 1, color: '#ff6b00' }]
      }
    });
    app.destroy();
  });

  it('opens webp sprites, edits nine-slice/colliders, and applies material tint on selected sprites', () => {
    const { root, app } = mountIndustrialEditor();

    app.openSpriteEditor('assets/ui/panel.webp');
    app.setNineSliceGuides({ left: 8, right: 56, top: 10, bottom: 54 });
    app.autoGenerateSpriteCollider();
    app.setSpriteMaterial('hero', {
      alphaClip: 0.35,
      colorTint: '#00ff66',
      normalMap: 'assets/hero_n.webp'
    });

    expect(root.querySelector('[data-sprite-editor="assets/ui/panel.webp"]')).toBeTruthy();
    expect(root.querySelector('[data-nine-slice-guide="left"]')?.style.left).toBe('8px');
    expect(root.querySelector('[data-collider-outline]')).toBeTruthy();
    expect(root.querySelector('[data-material-panel]')).toBeTruthy();
    expect(root.querySelector('[data-material-field="colorTint"]').value).toBe('#00ff66');
    expect(app.exportSpriteMeta()).toMatchObject({
      fileName: 'panel.sprite.json',
      meta: {
        source: 'assets/ui/panel.webp',
        nineSlice: { left: 8, right: 56, top: 10, bottom: 54 },
        collider: expect.objectContaining({ points: expect.any(Array) })
      }
    });
    expect(app.getState().scene.entities.find((entity) => entity.id === 'hero').material).toMatchObject({
      alphaClip: 0.35,
      colorTint: '#00ff66',
      normalMap: 'assets/hero_n.webp'
    });
    app.destroy();
  });

  it('renders a profiler flame graph with memory and draw-call streams', () => {
    const { root, app } = mountIndustrialEditor();

    app.openProfiler();
    app.recordProfilerFrame({
      frame: 7,
      totalMs: 18,
      sections: [
        { name: 'Update', duration: 3 },
        { name: 'Collision', duration: 12 },
        { name: 'Renderer', duration: 3 }
      ],
      memoryMB: 128,
      drawCalls: 42
    });

    expect(root.querySelector('[data-profiler-flamegraph]')).toBeTruthy();
    expect(root.querySelector('[data-profiler-section="Collision"]')?.textContent).toContain('12.00ms');
    expect(root.querySelector('[data-profiler-memory]')?.textContent).toContain('128MB');
    expect(root.querySelector('[data-profiler-draw-calls]')?.textContent).toContain('42');
    app.destroy();
  });

  it('opens multiple scene tabs and instantiates nested scene assets from JSON', () => {
    const { root, app } = mountIndustrialEditor();

    app.openSceneTab({ path: 'scenes/town.json', scene: { name: 'town', entities: [{ id: 'npc', x: 20, y: 20 }] } });
    app.openSceneTab({ path: 'scenes/cave.json', scene: { name: 'cave', entities: [{ id: 'bat', x: 4, y: 8 }] } });
    app.switchSceneTab('scenes/town.json');
    const nested = app.instantiateSubScene('scenes/cave.json', { x: 160, y: 96 });

    expect([...root.querySelectorAll('[data-scene-tab]')].map((node) => node.dataset.sceneTab)).toEqual([
      'scenes/town.json',
      'scenes/cave.json'
    ]);
    expect(app.getState().activeSceneTabPath).toBe('scenes/town.json');
    expect(nested).toMatchObject({
      type: 'subscene',
      scenePath: 'scenes/cave.json',
      x: 160,
      y: 96
    });
    expect(app.getState().scene.entities).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: expect.stringContaining('subscene-cave'), scenePath: 'scenes/cave.json' })
    ]));
    app.destroy();
  });
});
