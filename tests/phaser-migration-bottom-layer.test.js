import { describe, expect, it, vi } from 'vitest';
import {
  BitmapText,
  InputManager,
  Physics,
  Sprite,
  Tween
} from '../src/index.js';

describe('Phaser migration bottom layer adapters', () => {
  it('loads AngelCode bitmap font data and emits glyph draw commands', () => {
    const font = BitmapText.parseFnt(`
info face="Arcade" size=16
common lineHeight=18 base=14 scaleW=128 scaleH=128 pages=1 packed=0
page id=0 file="arcade.png"
char id=65 x=1 y=2 width=8 height=10 xoffset=0 yoffset=2 xadvance=9 page=0 chnl=0
char id=66 x=10 y=2 width=7 height=10 xoffset=1 yoffset=2 xadvance=8 page=0 chnl=0
`);
    const text = new BitmapText('AB', {
      x: 12,
      y: 20,
      font,
      texture: { id: 'arcade.png' }
    });
    const ctx = { drawImage: vi.fn() };

    text.render(ctx);

    expect(font).toMatchObject({
      face: 'Arcade',
      lineHeight: 18,
      pages: [{ id: 0, file: 'arcade.png' }]
    });
    expect(text.measure()).toEqual({ width: 17, height: 18 });
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    expect(text.toJSON()).toMatchObject({ type: 'bitmapText', text: 'AB' });
  });

  it('provides Arcade-style collider and overlap contact callbacks', () => {
    const arcade = new Physics.ArcadeAdapter();
    const player = { id: 'player', x: 0, y: 0, width: 16, height: 16 };
    const wall = { id: 'wall', x: 8, y: 0, width: 16, height: 16 };
    const coin = { id: 'coin', x: 80, y: 0, width: 8, height: 8 };
    const collider = vi.fn();
    const overlap = vi.fn();

    arcade.addCollider(player, wall, collider);
    arcade.addOverlap(player, coin, overlap);
    let result = arcade.step();
    coin.x = 10;
    result = arcade.step();

    expect(result.collisions).toHaveLength(1);
    expect(result.overlaps).toHaveLength(1);
    expect(collider).toHaveBeenCalledWith(player, wall, expect.objectContaining({ type: 'collider' }));
    expect(overlap).toHaveBeenCalledWith(player, coin, expect.objectContaining({ type: 'overlap' }));
  });

  it('adds chainable Tween.onComplete callbacks', () => {
    const target = { x: 0 };
    const complete = vi.fn();
    const tween = new Tween(target, { x: 10, duration: 100, ease: 'linear', autoplay: false });

    expect(tween.onComplete(complete)).toBe(tween);
    tween.play().update(100);

    expect(target.x).toBe(10);
    expect(complete).toHaveBeenCalledWith(tween);
  });

  it('adds Sprite setMask and setCrop descriptors consumed by render', () => {
    const mask = { x: 2, y: 3, width: 12, height: 14 };
    const sprite = new Sprite({ width: 32, height: 32 }, {
      x: 10,
      y: 20,
      width: 16,
      height: 16
    }).setMask(mask).setCrop(4, 5, 8, 9);
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      drawImage: vi.fn()
    };

    sprite.render(ctx);

    expect(sprite.mask).toBe(mask);
    expect(sprite.crop).toEqual({ x: 4, y: 5, width: 8, height: 9 });
    expect(ctx.clip).toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalledWith(sprite.texture, 4, 5, 8, 9, 0, 0, 16, 16);
  });

  it('emits pointer pinch and swipe gestures', () => {
    const target = createEventTarget();
    const input = new InputManager({ target });
    const pinch = vi.fn();
    const swipe = vi.fn();
    input.pointer.on('pinch', pinch);
    input.pointer.on('swipe', swipe);

    dispatchTouch(target, 'touchstart', [
      { identifier: 1, clientX: 10, clientY: 10 },
      { identifier: 2, clientX: 30, clientY: 10 }
    ]);
    dispatchTouch(target, 'touchmove', [
      { identifier: 1, clientX: 0, clientY: 10 },
      { identifier: 2, clientX: 40, clientY: 10 }
    ]);
    dispatchPointer(target, 'pointerdown', 10, 10);
    dispatchPointer(target, 'pointermove', 74, 14);
    dispatchPointer(target, 'pointerup', 74, 14);

    expect(pinch).toHaveBeenCalledWith(expect.objectContaining({
      scale: 2,
      distance: 40,
      previousDistance: 20
    }));
    expect(swipe).toHaveBeenCalledWith(expect.objectContaining({
      direction: 'right',
      dx: 64
    }));
  });
});

function createEventTarget() {
  const listeners = new Map();
  return {
    width: 100,
    height: 100,
    style: {},
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    removeEventListener(type, handler) {
      listeners.set(type, (listeners.get(type) || []).filter((item) => item !== handler));
    },
    dispatchEvent(event) {
      for (const handler of listeners.get(event.type) || []) handler(event);
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 })
  };
}

function dispatchPointer(target, type, clientX, clientY) {
  target.dispatchEvent(createEvent(type, { clientX, clientY, button: 0, pointerId: 1 }));
}

function dispatchTouch(target, type, touches) {
  target.dispatchEvent(createEvent(type, {
    touches,
    changedTouches: touches,
    cancelable: true
  }));
}

function createEvent(type, props = {}) {
  return {
    type,
    cancelable: true,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    timeStamp: performance.now(),
    ...props
  };
}
