import { describe, expect, it } from 'vitest';
import { Graphics, Sprite, TileSprite, Transform2D } from '../src/index.js';

describe('OmniCore Sprite slicing, tiling, and transforms', () => {
  it('renders 9-sliced sprites without stretching the border cells', () => {
    const calls = [];
    const ctx = createRecordingContext(calls);
    const texture = createTexture(64, 64);
    const panel = new Sprite(texture, { x: 10, y: 20, width: 160, height: 96, label: false });

    panel.slice(8, 12, 10, 14);
    panel.render(ctx);

    expect(panel.slice()).toEqual({ top: 8, bottom: 12, left: 10, right: 14 });
    expect(calls.filter((call) => call === 'drawImage')).toHaveLength(9);
    expect(calls).toEqual(expect.arrayContaining(['translate:10,20']));
  });

  it('renders TileSprite with pattern fill, offset, and tile scale', () => {
    const calls = [];
    const ctx = createRecordingContext(calls);
    const tile = new TileSprite(createTexture(16, 16), {
      x: 4,
      y: 6,
      width: 128,
      height: 64,
      tilePosition: { x: 12, y: 18 },
      tileScale: { x: 2, y: 0.5 }
    });

    tile.render(ctx);

    expect(tile.type).toBe('tile-sprite');
    expect(calls).toEqual(expect.arrayContaining([
      'createPattern',
      'translate:4,6',
      'translate:12,18',
      'scale:2,0.5',
      'fillRect'
    ]));
  });

  it('computes local and world matrices through parent-child hierarchy', () => {
    const root = new Graphics({ x: 10, y: 5 });
    const child = new Sprite('child', { x: 4, y: 3, width: 20, height: 10, label: false });

    root.transform.rotation = Math.PI / 2;
    root.transform.pivot = { x: 2, y: 1 };
    child.transform.scale = { x: 2, y: 3 };
    root.add(child);

    expect(root.children).toContain(child);
    expect(child.parent).toBe(root);
    expect(Transform2D.localMatrix(child)).toHaveLength(6);
    expect(Transform2D.worldMatrix(child)).not.toEqual(Transform2D.localMatrix(child));
    expect(child.bounds()).toMatchObject({ width: 40, height: 30 });
  });
});

function createRecordingContext(calls) {
  const record = (name) => (...args) => {
    calls.push(args.length ? `${name}:${args.join(',')}` : name);
    return args[0];
  };
  return {
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    rotate: record('rotate'),
    scale: record('scale'),
    transform: record('transform'),
    drawImage: (...args) => {
      calls.push('drawImage');
      return args[0];
    },
    fillRect: (...args) => {
      calls.push('fillRect');
      return args[0];
    },
    createPattern: (...args) => {
      calls.push('createPattern');
      return args[0];
    },
    set fillStyle(value) {
      calls.push(`fillStyle:${typeof value === 'string' ? value : 'object'}`);
    },
    set globalAlpha(value) {
      calls.push(`globalAlpha:${value}`);
    }
  };
}

function createTexture(width, height) {
  return {
    width,
    height,
    getContext: () => ({})
  };
}
