import { describe, expect, it, vi } from 'vitest';
import EventBus from '../src/core/EventBus.js';
import {
  EventListenerRegistry,
  attachEntityEventTracking,
  getEntityListenerCount
} from '../src/core/EventListenerRegistry.js';
import {
  PixiTextureLifecycle,
  attachTexture,
  cleanupUnusedTextures,
  detachTexture,
  getTextureRefCount
} from '../src/renderer/PixiTextureLifecycle.js';
import {
  PhysicsCollisionSync,
  syncPhysicsBodyToEntity
} from '../src/physics/PhysicsCollisionSync.js';

describe('EventListenerRegistry leak guard', () => {
  it('auto-unbinds entity EventBus listeners during 20 learning cabin cycles without warnings', () => {
    const bus = new EventBus();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = new EventListenerRegistry({ warn: console.warn });
    const trackedBus = registry.trackEventBus(bus);

    for (let index = 0; index < 20; index += 1) {
      const entity = {
        id: `learner-${index}`,
        destroy: vi.fn()
      };
      registry.trackEntity(entity);
      const handler = vi.fn();
      trackedBus.on('learning:cabin:enter', handler, { entity });
      trackedBus.emit('learning:cabin:enter', { index });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(registry.count(entity)).toBe(1);

      entity.destroy();
      trackedBus.emit('learning:cabin:enter', { index });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(registry.count(entity)).toBe(0);
    }

    expect(bus.listeners.get('learning:cabin:enter')?.size || 0).toBe(0);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('未解绑'));
    warn.mockRestore();
  });

  it('warns only when external destroy cleanup leaves registry entries behind', () => {
    const warn = vi.fn();
    const registry = new EventListenerRegistry({ warn });
    const entity = { id: 'broken', destroy: vi.fn() };
    const bus = new EventBus();

    registry.trackEntity(entity);
    registry.trackEventBus(bus).on('broken:event', () => {}, { entity });
    registry.cleanupEntity(entity, { forceLeakWarning: true });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[OmniCore] 实体销毁未解绑事件，潜在泄漏风险'));
    expect(registry.count(entity)).toBe(0);
  });

  it('supports standalone helpers for entity tracking', () => {
    const bus = new EventBus();
    const entity = { destroy: vi.fn() };
    const tracked = attachEntityEventTracking(entity, bus);
    tracked.on('ready', () => {}, { entity });

    expect(getEntityListenerCount(entity)).toBe(1);
    entity.destroy();
    expect(getEntityListenerCount(entity)).toBe(0);
  });
});

describe('PixiTextureLifecycle reference counting', () => {
  it('releases unreferenced textures over 15 scene switches and logs cleaned count', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const lifecycle = new PixiTextureLifecycle({ log: console.info });
    const textures = Array.from({ length: 15 }, (_, index) => ({
      id: `texture-${index}`,
      destroy: vi.fn()
    }));

    textures.forEach((texture) => {
      const sprite = { texture };
      lifecycle.attachTexture(texture, sprite);
      expect(lifecycle.getRefCount(texture)).toBe(1);
      lifecycle.cleanupScene({ sprites: [sprite] });
      expect(lifecycle.getRefCount(texture)).toBe(0);
      expect(texture.destroy).toHaveBeenCalledWith(true);
    });

    expect(textures.every((texture) => texture.destroy.mock.calls.length === 1)).toBe(true);
    expect(info).toHaveBeenCalledWith(expect.stringMatching(/^\[OmniCore\] 已清理未使用纹理 1 张$/));
    info.mockRestore();
  });

  it('does not destroy textures still referenced by another sprite', () => {
    const texture = { id: 'shared', destroy: vi.fn() };
    const first = { texture };
    const second = { texture };
    const lifecycle = new PixiTextureLifecycle({ log: vi.fn() });

    lifecycle.attachTexture(texture, first);
    lifecycle.attachTexture(texture, second);
    lifecycle.cleanupScene({ sprites: [first] });

    expect(lifecycle.getRefCount(texture)).toBe(1);
    expect(texture.destroy).not.toHaveBeenCalled();

    lifecycle.cleanupScene({ sprites: [second] });
    expect(texture.destroy).toHaveBeenCalledWith(true);
  });

  it('exposes module-level texture reference helpers', () => {
    const texture = { destroy: vi.fn() };
    const sprite = { texture };

    attachTexture(texture, sprite);
    expect(getTextureRefCount(texture)).toBe(1);
    detachTexture(texture, sprite);
    expect(getTextureRefCount(texture)).toBe(0);
    expect(cleanupUnusedTextures()).toBeGreaterThanOrEqual(1);
  });
});

describe('PhysicsCollisionSync drift correction', () => {
  it('aligns Matter body position to sprite position when drift exceeds 0.5px', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const body = { position: { x: 10, y: 10 } };
    const entity = { x: 10.75, y: 9.25, body };

    const result = syncPhysicsBodyToEntity(entity, body);

    expect(result.corrected).toBe(true);
    expect(body.position).toEqual({ x: 10.75, y: 9.25 });
    expect(warn).toHaveBeenCalledWith('[OmniCore] 物理与渲染坐标漂移，已自动修正');
    warn.mockRestore();
  });

  it('does not warn or adjust below the 0.5px threshold and checks once per frame', () => {
    const warn = vi.fn();
    const sync = new PhysicsCollisionSync({ warn, threshold: 0.5 });
    const body = { position: { x: 20, y: 20 } };
    const entity = { x: 20.25, y: 20.5, body };

    expect(sync.sync(entity, body, { frame: 1 }).corrected).toBe(false);
    entity.x = 40;
    expect(sync.sync(entity, body, { frame: 1 }).skipped).toBe(true);
    expect(body.position.x).toBe(20);
    expect(warn).not.toHaveBeenCalled();

    expect(sync.sync(entity, body, { frame: 2 }).corrected).toBe(true);
    expect(body.position.x).toBe(40);
  });
});
