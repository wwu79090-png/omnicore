import { describe, expect, it, vi } from 'vitest';
import OmniCore, {
  AnimationManager,
  AudioManager,
  Camera,
  DataAdapter,
  Geom,
  InputManager,
  Loader,
  Node,
  Shape,
  Sprite,
  Text,
  conicGradientFill
} from '../src/index.js';

describe('fatal runtime foundation gaps', () => {
  it('exposes complex geometry, Shape descriptors, gradients, blend modes, masks, and clips', () => {
    const ring = Geom.ring({ x: 32, y: 32, outerRadius: 16, innerRadius: 8 });
    const sector = Geom.sector({ x: 32, y: 32, radius: 24, startAngle: 0, endAngle: Math.PI / 2 });
    const bezier = Geom.bezier({
      start: { x: 0, y: 0 },
      cp1: { x: 8, y: 24 },
      cp2: { x: 16, y: -12 },
      end: { x: 32, y: 8 }
    });
    const mask = Shape.ring({ x: 16, y: 16, outerRadius: 16, innerRadius: 4 });
    const panel = Shape.polygon({
      points: [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 56, y: 32 }, { x: 4, y: 40 }]
    })
      .fill(Shape.gradient.conic({
        x: 24,
        y: 24,
        stops: [[0, '#ffffff'], [1, '#38bdf8']]
      }))
      .blend('overlay')
      .mask(mask)
      .clip(mask)
      .toJSON();

    expect(ring.containsPoint(32, 44)).toBe(true);
    expect(sector.containsPoint(42, 42)).toBe(true);
    expect(bezier.bounds()).toMatchObject({ x: 0, y: -12, width: 32, height: 36 });
    expect(conicGradientFill({ x: 1, y: 2 }).type).toBe('conic-gradient');
    expect(panel.commands[0]).toMatchObject({
      op: 'polygon',
      blendMode: 'overlay',
      fill: expect.objectContaining({ type: 'conic-gradient' }),
      mask: expect.objectContaining({ type: 'ring' })
    });
    expect(OmniCore.Shape).toBe(Shape);
  });

  it('keeps rich text, Scale9 sprites, input combos, camera bounds, loader fallback, and world positions compatible', async () => {
    const text = new Text('OmniCore overlay panel text')
      .setStroke('#0f172a', 2)
      .setShadow('#000', 4, 1, 2)
      .setWordWrap(64)
      .setLineSpacing(6);
    const sprite = new Sprite('panel.webp').slice(8, 8, 12, 12);
    const input = new InputManager({ target: null });
    input.keyboard.press('ControlLeft');
    input.keyboard.press('KeyZ');
    const camera = new Camera({ x: 500, y: 400 }).setViewport({ width: 100, height: 80 }).setBounds(0, 0, 320, 240);
    camera.update(0);
    const parent = new Node({ x: 40, y: 10 });
    const child = parent.addChild(new Node({ x: 5, y: 6 }));
    const fetcher = vi.fn(async () => ({ ok: false, status: 404, text: async () => 'missing' }));
    const loader = new Loader({ fetcher, preferWebp: false, pathResolver: { 'bad.webp': 'also-bad.webp' } });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let loaded;
    try {
      loaded = await loader.loadBundle([{ key: 'bad', url: 'bad.webp', type: 'image', width: 16, height: 16 }]);
      expect(errorSpy).toHaveBeenCalledWith(
        '资源丢失，请检查路径配置',
        expect.objectContaining({ key: 'bad', url: 'bad.webp', tried: ['bad.webp', 'also-bad.webp'] })
      );
    } finally {
      errorSpy.mockRestore();
    }

    expect(text.style).toMatchObject({
      stroke: { color: '#0f172a', thickness: 2 },
      shadow: { color: '#000', blur: 4, offsetX: 1, offsetY: 2 },
      wordWrap: { width: 64 },
      lineSpacing: 6
    });
    expect(sprite.slice()).toEqual({ top: 8, bottom: 8, left: 12, right: 12 });
    expect(input.keyboard.isCombo(['Ctrl', 'z'])).toBe(true);
    expect(camera.getViewTransform()).toMatchObject({ x: 220, y: 160 });
    expect(child.getWorldPosition()).toEqual({ x: 45, y: 16 });
    expect(loaded.bad).toMatchObject({ type: 'ResourceMissing', color: 'rgba(255,0,0,0.5)' });
  });

  it('manages audio pools, frame animations, UI state transitions, and Phaser save migration', () => {
    const audio = new AudioManager({ context: createAudioContextSpy() });
    audio.buffers.set('boom', { duration: 0.2 });
    audio.setMasterVolume(0.6);
    audio.createPool('boom', { size: 2, volume: 0.4, loop: true });
    const voice = audio.playFromPool('boom', { fadeIn: 0.1 });
    audio.fadeOut(voice, { duration: 0.2 });

    const target = { texture: 'idle-0' };
    const manager = new AnimationManager(target)
      .add('idle', ['idle-0', 'idle-1'], { frameRate: 10, loop: true })
      .play('idle');
    manager.update(100);

    const migrated = DataAdapter.fromPhaserSave({
      player: { x: 12, y: 20, health: 80 },
      registry: { values: { score: 300 } },
      scene: { key: 'level-1' }
    });

    expect(audio.getBus('master')).toMatchObject({ volume: 0.6 });
    expect(voice).toMatchObject({ loop: true, omniPool: { key: 'boom', index: 0 } });
    expect(target.texture).toBe('idle-1');
    expect(migrated).toEqual({
      player: { x: 12, y: 20, hp: 80 },
      store: { score: 300 },
      scene: 'level-1'
    });
  });
});

function createAudioContextSpy() {
  return {
    currentTime: 1,
    destination: {},
    createDynamicsCompressor: vi.fn(() => createNode({
      threshold: { value: 0 },
      knee: { value: 0 },
      ratio: { value: 0 },
      attack: { value: 0 },
      release: { value: 0 }
    })),
    createGain: vi.fn(() => createNode({
      gain: {
        value: 1,
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn()
      }
    })),
    createBufferSource: vi.fn(() => createNode({
      start: vi.fn(),
      stop: vi.fn(),
      loop: false
    }))
  };
}

function createNode(extra = {}) {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    ...extra
  };
}
