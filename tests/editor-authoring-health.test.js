import { afterEach, describe, expect, it } from 'vitest';
import { createEditorApp } from 'omnicore-editor/src/editor-app.js';
import { createEditorState } from 'omnicore-editor/src/live-sync-protocol.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function mountAuthoringHealthEditor(overrides = {}) {
  document.body.innerHTML = '<main id="app"></main>';
  const root = document.querySelector('#app');
  const app = createEditorApp(root, {
    autoCheckRecovery: false,
    state: createEditorState({
      scene: {
        name: 'health-scene',
        entities: [
          {
            id: 'hero',
            type: 'sprite',
            sprite: 'assets/hero.webp',
            texture: 'assets/hero.webp',
            material: {
              alphaClip: 1.4,
              colorTint: '#00ff66',
              normalMap: 'assets/missing_n.webp'
            }
          }
        ]
      },
      selectedEntityId: 'hero',
      selectedEntityIds: ['hero'],
      assets: [
        { path: 'assets/hero.webp', type: 'image' },
        { path: 'assets/ui/panel.webp', type: 'image' }
      ],
      animations: {
        jump: {
          id: 'jump',
          duration: 24,
          tracks: {
            y: { keyframes: [{ frame: 0, value: 0, easing: 'Linear' }] }
          },
          events: [{ frame: 30, name: 'lateLanding' }]
        }
      },
      particleEditor: {
        open: true,
        config: {
          emissionRate: 24,
          lifetime: 0,
          initialVelocity: 120,
          gravity: 0,
          curves: { size: [{ t: 1, value: 0 }, { t: 0, value: 1 }] },
          gradient: [{ t: 0, color: 'orange' }]
        }
      },
      spriteEditor: {
        open: true,
        source: 'assets/ui/panel.webp',
        nineSlice: { left: 50, right: 10, top: 8, bottom: 54 },
        collider: null
      },
      dockLayout: {
        left: ['assets'],
        center: ['scene-view'],
        right: ['inspector'],
        bottom: ['animation-timeline', 'profiler']
      },
      ...overrides
    })
  });
  return { root, app };
}

describe('editor authoring health and export readiness', () => {
  it('reports invalid authoring configs and renders a no-code health panel', () => {
    const { root, app } = mountAuthoringHealthEditor();

    const report = app.validateAuthoringAssets();

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'particle-lifetime-invalid' }),
      expect.objectContaining({ code: 'particle-gradient-color-invalid' }),
      expect.objectContaining({ code: 'particle-curve-order-invalid' }),
      expect.objectContaining({ code: 'sprite-nine-slice-invalid' }),
      expect.objectContaining({ code: 'sprite-alpha-clip-invalid' }),
      expect.objectContaining({ code: 'sprite-normal-map-missing' }),
      expect.objectContaining({ code: 'animation-event-out-of-range' })
    ]));
    expect(root.querySelector('[data-authoring-health]')?.textContent).toContain('particle-lifetime-invalid');
    expect(root.querySelector('[data-authoring-health]')?.textContent).toContain('sprite-normal-map-missing');
    app.destroy();
  });

  it('exports a deterministic authoring bundle for version control and runtime loading', () => {
    const { app } = mountAuthoringHealthEditor({
      scene: {
        name: 'town',
        entities: [{ id: 'hero', type: 'sprite', sprite: 'assets/hero.webp', material: { alphaClip: 0.4, colorTint: '#00ff66' } }]
      },
      animations: {
        jump: {
          id: 'jump',
          duration: 24,
          tracks: { y: { keyframes: [{ frame: 0, value: 0, easing: 'Linear' }] } },
          events: [{ frame: 12, name: 'land' }]
        }
      },
      particleEditor: {
        open: true,
        config: {
          emissionRate: 96,
          lifetime: 0.8,
          initialVelocity: 160,
          gravity: 280,
          curves: { size: [{ t: 0, value: 1 }, { t: 1, value: 0 }] },
          gradient: [{ t: 0, color: '#ffffff' }, { t: 1, color: '#ff6b00' }]
        }
      },
      spriteEditor: {
        open: true,
        source: 'assets/ui/panel.webp',
        nineSlice: { left: 6, right: 58, top: 8, bottom: 54 },
        collider: { type: 'polygon', points: [{ x: 0, y: 0 }, { x: 58, y: 0 }] }
      },
      sceneTabs: [
        { path: 'scenes/town.json', scene: { name: 'town', entities: [{ id: 'npc', x: 16, y: 16 }] } }
      ],
      activeSceneTabPath: 'scenes/town.json'
    });

    const bundle = app.exportAuthoringBundle({ generatedAt: '2026-06-19T00:00:00.000Z' });

    expect(bundle.fileName).toBe('omnicore_authoring_bundle.json');
    expect(bundle.generatedAt).toBe('2026-06-19T00:00:00.000Z');
    expect(bundle.health.ok).toBe(true);
    expect(bundle.manifest).toMatchObject({ animations: 1, particles: 1, sprites: 1, scenes: 1 });
    expect(bundle.files.map((file) => file.path)).toEqual([
      'animations/jump.animation.json',
      'particles/particle_config.json',
      'scenes/town.scene.json',
      'sprites/panel.sprite.json'
    ]);
    app.destroy();
  });

  it('turns profiler frames into sorted hotspot recommendations and health rows', () => {
    const { root, app } = mountAuthoringHealthEditor({
      particleEditor: { open: true, config: { emissionRate: 10, lifetime: 1, initialVelocity: 1, gravity: 0, curves: {}, gradient: [] } },
      spriteEditor: { open: false, source: null, nineSlice: {}, collider: null },
      scene: { name: 'clean', entities: [] },
      animations: {}
    });

    app.recordProfilerFrame({
      frame: 9,
      totalMs: 31,
      sections: [
        { name: 'Update', duration: 4 },
        { name: 'Renderer', duration: 9 },
        { name: 'Collision', duration: 18 }
      ],
      memoryMB: 160,
      drawCalls: 51
    });

    const hotspots = app.getProfilerHotspots({ warningMs: 8, criticalMs: 16 });
    app.validateAuthoringAssets({ profilerWarningMs: 8, profilerCriticalMs: 16 });

    expect(hotspots[0]).toMatchObject({
      name: 'Collision',
      duration: 18,
      severity: 'critical'
    });
    expect(hotspots[0].suggestion).toContain('碰撞耗时');
    expect(hotspots[1]).toMatchObject({ name: 'Renderer', severity: 'warning' });
    expect(root.querySelector('[data-authoring-health-hotspot="Collision"]')?.textContent).toContain('critical');
    app.destroy();
  });
});
