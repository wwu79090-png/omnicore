import { describe, expect, it, vi } from 'vitest';
import { PixiFrameworkBridge, createPixiFrameworkAdoptionPlan } from '../src/renderer/PixiFrameworkBridge.js';

describe('Pixi framework layer bridge', () => {
  it('mounts Pixi-style display objects into an OmniCore scene and tracks lifecycle evidence', () => {
    const texture = { id: 'hero-texture', destroy: vi.fn() };
    const displayObject = {
      name: 'Hero',
      texture,
      x: 12,
      y: 18,
      width: 32,
      height: 48,
      filters: [{ name: 'GlowFilter' }],
      destroy: vi.fn()
    };
    const scene = { name: 'play', children: [], add(child) { this.children.push(child); return child; } };
    const bridge = new PixiFrameworkBridge({ scene, log: null });

    const mounted = bridge.mountDisplayObject(displayObject, { id: 'hero' });
    bridge.applyFilterPreset(mounted, 'bloom', { intensity: 0.7 });
    const report = bridge.createFrameworkReport();
    const cleanup = bridge.cleanup();

    expect(mounted).toMatchObject({
      id: 'hero',
      name: 'Hero',
      texture,
      x: 12,
      y: 18,
      width: 32,
      height: 48
    });
    expect(scene.children).toContain(mounted);
    expect(report).toMatchObject({
      pixiObjectsMounted: 1,
      filterPresetCount: 1,
      textureRefs: [{ id: 'hero', refCount: 1 }],
      recommendations: expect.arrayContaining([expect.stringContaining('OmniCore scene')])
    });
    expect(cleanup.destroyedDisplayObjects).toBe(1);
    expect(displayObject.destroy).toHaveBeenCalled();
  });

  it('returns a Pixi-to-OmniCore adoption plan covering filters, lifecycle, and renderer boundaries', () => {
    const plan = createPixiFrameworkAdoptionPlan({
      usesFilters: true,
      usesTicker: true,
      usesTextureCache: true,
      usesContainers: true
    });

    expect(plan.score).toBeGreaterThanOrEqual(90);
    expect(plan.steps.map((step) => step.id)).toEqual(expect.arrayContaining([
      'replace-pixi-ticker',
      'wrap-display-objects',
      'track-texture-lifecycle',
      'map-filter-presets'
    ]));
  });
});
