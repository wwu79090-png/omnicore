import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Entity,
  EventBus,
  InputManager,
  Sprite,
  StorageManager,
  Store,
  Text,
  Tween
} from '../src/index.js';

describe('migration runtime primitives', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    StorageManager.unbindStore?.();
  });

  it('gives every Entity visible and active boolean flags', () => {
    const entity = Entity.createEntity('npc', { visible: false });

    expect(entity.visible).toBe(false);
    expect(entity.active).toBe(true);
    entity.active = false;
    entity.visible = true;
    expect(entity.active).toBe(false);
    expect(entity.visible).toBe(true);
  });

  it('allows Sprite scale.x and scale.y mutation including negative flip values', () => {
    const sprite = new Sprite('hero.png');

    sprite.scale.x = -1;
    sprite.scale.y = 2;

    expect(sprite.scaleX).toBe(-1);
    expect(sprite.scaleY).toBe(2);
    expect(sprite.bounds()).toMatchObject({ width: 32, height: 64 });
  });

  it('supports Sprite tint mutation and clearing', () => {
    const sprite = new Sprite('hero.png');

    expect(sprite.setTint('#ff00ff')).toBe(sprite);
    expect(sprite.tint).toBe('#ff00ff');
    expect(sprite.clearTint()).toBe(sprite);
    expect(sprite.tint).toBeNull();
  });

  it('sets pointer/default cursor on Input target', () => {
    const target = document.createElement('canvas');
    const input = new InputManager({ target });

    expect(input.setCursor('pointer')).toBe(input);
    expect(target.style.cursor).toBe('pointer');
    input.setCursor('default');
    expect(target.style.cursor).toBe('default');
    expect(() => input.setCursor('wait')).toThrow(/cursor/);
  });

  it('destroys Entity-bound tweens, EventBus listeners, and physics bodies', () => {
    const entity = Entity.createEntity('actor');
    const bus = new EventBus();
    const body = {
      destroy: vi.fn(),
      world: { removeBody: vi.fn() }
    };
    const target = { x: 0 };
    const tween = new Tween(target, {
      x: 10,
      duration: 100,
      autoplay: false
    });
    const handler = vi.fn();
    entity.body = body;

    entity.bindTween(tween);
    entity.listenTo(bus, 'hit', handler);
    entity.destroy();
    bus.emit('hit', {});

    expect(entity.active).toBe(false);
    expect(entity.visible).toBe(false);
    expect(tween.completed).toBe(true);
    expect(handler).not.toHaveBeenCalled();
    expect(body.destroy).toHaveBeenCalledTimes(1);
    expect(body.world.removeBody).toHaveBeenCalledWith(body);
  });

  it('keeps Text.setText chainable and string-normalized', () => {
    const text = new Text('old');

    expect(text.setText(123)).toBe(text);
    expect(text.text).toBe('123');
  });

  it('syncs Store from browser storage events through StorageManager', () => {
    const store = new Store({ score: 0 });
    const unbind = StorageManager.bindStore(store);

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'omnicore:store:score',
      newValue: JSON.stringify(12)
    }));
    expect(store.get('score')).toBe(12);

    unbind();
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'omnicore:store:score',
      newValue: JSON.stringify(24)
    }));
    expect(store.get('score')).toBe(12);
  });
});
