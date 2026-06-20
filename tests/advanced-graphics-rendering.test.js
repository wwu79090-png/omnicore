import { describe, expect, it, vi } from 'vitest';
import { Graphics, Sprite } from '../src/index.js';

describe('OmniCore.Graphics advanced drawing surface', () => {
  it('records and renders curves, arcs, and polygon paths', () => {
    const calls = [];
    const ctx = createRecordingContext(calls);
    const graphics = new Graphics()
      .lineStyle(4, '#ffffff', 0.8, { cap: 'round', join: 'bevel' })
      .fillStyle('#123456', 0.5)
      .moveTo(0, 0)
      .quadraticCurveTo(20, -12, 40, 0)
      .bezierCurveTo(54, 24, 78, 24, 96, 0)
      .arc(96, 24, 18, 0, Math.PI, true)
      .closePath();

    graphics.render(ctx);

    expect(graphics.commands.map((command) => command.op)).toEqual(expect.arrayContaining([
      'quadraticCurveTo',
      'bezierCurveTo',
      'arc'
    ]));
    expect(calls).toEqual(expect.arrayContaining([
      'quadraticCurveTo',
      'bezierCurveTo',
      'arc',
      'fill',
      'stroke',
      'lineCap:round',
      'lineJoin:bevel'
    ]));
  });

  it('supports linear, radial, and conic gradients plus blend modes', () => {
    const calls = [];
    const ctx = createRecordingContext(calls);
    const linear = Graphics.gradient('linear', { x0: 0, y0: 0, x1: 120, y1: 0 }, [
      [0, '#020617'],
      [1, 'rgba(56,189,248,0.65)']
    ]);
    const radial = Graphics.gradient('radial', { x0: 30, y0: 30, r0: 2, x1: 30, y1: 30, r1: 28 }, [
      { offset: 0, color: '#ffffff' },
      { offset: 1, color: '#38bdf8' }
    ]);
    const conic = Graphics.gradient('conic', { x: 64, y: 64, startAngle: 0 }, [
      [0, '#ff0000'],
      [1, '#0000ff']
    ]);

    new Graphics()
      .setFill(linear)
      .rect(0, 0, 120, 32)
      .setFill(radial)
      .ellipse(30, 30, 28, 16)
      .setFill(conic)
      .blendMode('screen')
      .arc(64, 64, 24, 0, Math.PI * 2)
      .render(ctx);

    expect(calls).toEqual(expect.arrayContaining([
      'createLinearGradient',
      'createRadialGradient',
      'createConicGradient',
      'globalCompositeOperation:screen'
    ]));
    expect(calls.filter((call) => call === 'gradient.addColorStop')).toHaveLength(6);
  });

  it('supports sprite pattern fills, stencil masks, and rectangular clipping', () => {
    const calls = [];
    const ctx = createRecordingContext(calls);
    const sprite = new Sprite(createCanvasLikeTexture(), { width: 16, height: 16 });
    const graphics = new Graphics()
      .beginMask()
      .polygon([{ x: 0, y: 0 }, { x: 80, y: 12 }, { x: 72, y: 80 }, { x: 4, y: 72 }])
      .endMask()
      .clip({ x: 8, y: 8, width: 64, height: 48 })
      .textureFill(sprite, { repetition: 'repeat' })
      .rect(0, 0, 96, 96);

    graphics.render(ctx);

    expect(calls).toEqual(expect.arrayContaining([
      'save',
      'clip',
      'restore',
      'createPattern',
      'fill'
    ]));
    expect(graphics.bounds()).toMatchObject({ x: 0, y: 0, width: 96, height: 96 });
    expect(graphics.containsPoint(24, 24)).toBe(true);
  });

  it('replays supported path commands into Pixi-like Graphics objects', () => {
    const calls = [];
    const graphics = new Graphics()
      .fillStyle('#38bdf8')
      .moveTo(0, 0)
      .lineTo(30, 0)
      .quadraticCurveTo(38, 8, 30, 16)
      .closePath();

    const displayObject = graphics.toPixiObject({ Graphics: createPixiGraphicsClass(calls) });

    expect(displayObject).toBeTruthy();
    expect(calls).toEqual(expect.arrayContaining([
      'clear',
      'moveTo',
      'lineTo',
      'quadraticCurveTo',
      'fill'
    ]));
  });
});

function createRecordingContext(calls) {
  const record = (name) => (...args) => {
    calls.push(name);
    return args[0];
  };
  const gradient = {
    addColorStop: vi.fn(() => calls.push('gradient.addColorStop'))
  };
  return {
    save: record('save'),
    restore: record('restore'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    rect: record('rect'),
    ellipse: record('ellipse'),
    quadraticCurveTo: record('quadraticCurveTo'),
    bezierCurveTo: record('bezierCurveTo'),
    arc: record('arc'),
    fill: record('fill'),
    stroke: record('stroke'),
    clip: record('clip'),
    createPattern: record('createPattern'),
    createLinearGradient: () => {
      calls.push('createLinearGradient');
      return gradient;
    },
    createRadialGradient: () => {
      calls.push('createRadialGradient');
      return gradient;
    },
    createConicGradient: () => {
      calls.push('createConicGradient');
      return gradient;
    },
    set fillStyle(value) {
      calls.push(`fillStyle:${typeof value === 'string' ? value : 'object'}`);
    },
    set strokeStyle(value) {
      calls.push(`strokeStyle:${value}`);
    },
    set globalAlpha(value) {
      calls.push(`globalAlpha:${value}`);
    },
    set globalCompositeOperation(value) {
      calls.push(`globalCompositeOperation:${value}`);
    },
    set lineWidth(value) {
      calls.push(`lineWidth:${value}`);
    },
    set lineCap(value) {
      calls.push(`lineCap:${value}`);
    },
    set lineJoin(value) {
      calls.push(`lineJoin:${value}`);
    }
  };
}

function createCanvasLikeTexture() {
  return {
    width: 16,
    height: 16,
    getContext: () => ({})
  };
}

function createPixiGraphicsClass(calls) {
  return class PixiGraphicsMock {
    clear() { calls.push('clear'); return this; }

    moveTo() { calls.push('moveTo'); return this; }

    lineTo() { calls.push('lineTo'); return this; }

    quadraticCurveTo() { calls.push('quadraticCurveTo'); return this; }

    bezierCurveTo() { calls.push('bezierCurveTo'); return this; }

    arc() { calls.push('arc'); return this; }

    closePath() { calls.push('closePath'); return this; }

    fill() { calls.push('fill'); return this; }

    stroke() { calls.push('stroke'); return this; }
  };
}
