import { describe, expect, it, vi } from 'vitest';
import { CanvasRendererAddon } from '../src/addons/CanvasRenderer.js';
import OmniCore, {
  createBezierPrimitive,
  createCapsulePrimitive,
  createCodeLayerPrimitive,
  createHousePrimitive,
  createPolygonPrimitive,
  createRichTextPrimitive,
  createRingPrimitive,
  createSectorPrimitive,
  expandVectorPrimitive,
  linearGradientFill,
  radialGradientFill,
  textureFill,
  vectorPrimitiveToSvg
} from '../src/index.js';

describe('advanced vector primitives', () => {
  it('builds old-scene grade primitives beyond rect circle polyline', () => {
    const house = createHousePrimitive({ x: 16, y: 20, width: 96, height: 80 });
    const ring = createRingPrimitive({ x: 180, y: 64, outerRadius: 42, innerRadius: 24 });
    const capsule = createCapsulePrimitive({ x: 250, y: 30, width: 116, height: 52, windowCount: 3 });
    const codeLayer = createCodeLayerPrimitive({
      x: 24,
      y: 140,
      width: 220,
      height: 96,
      alpha: 0.42,
      lines: ['const core = OmniCore;', 'render(house, ring);']
    });

    expect(house).toMatchObject({
      type: 'house',
      commands: expect.arrayContaining([
        expect.objectContaining({ op: 'polygon', role: 'roof' }),
        expect.objectContaining({ op: 'rect', role: 'wall' }),
        expect.objectContaining({ op: 'rect', role: 'door' }),
        expect.objectContaining({ op: 'rect', role: 'window' })
      ])
    });
    expect(ring).toMatchObject({
      type: 'ring',
      commands: [expect.objectContaining({
        op: 'ring',
        outerRadius: 42,
        innerRadius: 24,
        fillRule: 'evenodd'
      })]
    });
    expect(capsule.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: 'capsule', role: 'cabin' }),
      expect.objectContaining({ op: 'ring', role: 'window' })
    ]));
    expect(codeLayer.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: 'rect', alpha: 0.42, role: 'glass' }),
      expect.objectContaining({ op: 'text', text: 'const core = OmniCore;' })
    ]));
  });

  it('expands and serializes composite primitives for Canvas/SVG preview paths', () => {
    const primitives = [
      createHousePrimitive({ x: 0, y: 0, width: 80, height: 72 }),
      createRingPrimitive({ x: 120, y: 40, outerRadius: 32, innerRadius: 18 }),
      createCapsulePrimitive({ x: 170, y: 10, width: 90, height: 46 }),
      createCodeLayerPrimitive({ x: 0, y: 96, width: 180, height: 72, lines: ['alpha();'] })
    ];
    const commands = primitives.flatMap((primitive) => expandVectorPrimitive(primitive));
    const svg = vectorPrimitiveToSvg(primitives, { width: 320, height: 220 });

    expect(commands.map((command) => command.op)).toEqual(expect.arrayContaining([
      'polygon',
      'rect',
      'ring',
      'capsule',
      'text'
    ]));
    expect(svg).toContain('<svg');
    expect(svg).toContain('data-primitive="house"');
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).toContain('alpha();');
  });

  it('exposes production primitives through the public OmniCore entry', () => {
    const gradient = linearGradientFill({
      x0: 0,
      y0: 0,
      x1: 120,
      y1: 0,
      stops: [[0, '#0f172a'], [1, '#38bdf8']]
    });
    const radial = radialGradientFill({
      x0: 48,
      y0: 48,
      r0: 4,
      x1: 48,
      y1: 48,
      r1: 32,
      stops: [{ offset: 0, color: '#ffffff' }, { offset: 1, color: '#22d3ee' }]
    });
    const texture = textureFill({ source: { id: 'atlas-panel' }, repetition: 'repeat-x' });
    const mask = createRingPrimitive({ x: 72, y: 72, outerRadius: 40, innerRadius: 18 });
    const primitives = [
      createSectorPrimitive({ x: 72, y: 72, radius: 56, fill: gradient, mask, blendMode: 'screen' }),
      createBezierPrimitive({
        start: { x: 0, y: 96 },
        cp1: { x: 42, y: 20 },
        cp2: { x: 84, y: 140 },
        end: { x: 128, y: 64 },
        stroke: '#f8fafc',
        lineWidth: 3
      }),
      createPolygonPrimitive({
        points: [{ x: 160, y: 24 }, { x: 220, y: 42 }, { x: 204, y: 96 }, { x: 148, y: 88 }],
        fill: radial
      }),
      createPolygonPrimitive({
        points: [{ x: 236, y: 28 }, { x: 292, y: 28 }, { x: 292, y: 72 }, { x: 236, y: 72 }],
        fill: texture
      }),
      createRichTextPrimitive({
        x: 16,
        y: 132,
        layout: {
          width: 220,
          height: 42,
          lines: [{
            y: 18,
            segments: [
              { text: 'OmniCore', x: 0, fill: '#e0f2fe', fontSize: 16, fontFamily: 'Consolas' },
              { text: ' visual layer', x: 88, fill: '#67e8f9', fontSize: 14, fontFamily: 'Consolas' }
            ]
          }]
        }
      })
    ];
    const commands = expandVectorPrimitive(primitives);
    const svg = vectorPrimitiveToSvg(primitives, { width: 320, height: 200 });

    expect(OmniCore.createSectorPrimitive).toBe(createSectorPrimitive);
    expect(OmniCore.linearGradientFill).toBe(linearGradientFill);
    expect(commands.map((command) => command.op)).toEqual(expect.arrayContaining([
      'sector',
      'bezier',
      'polygon',
      'richText'
    ]));
    expect(commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: 'sector', blendMode: 'screen', mask }),
      expect.objectContaining({ op: 'polygon', fill: expect.objectContaining({ type: 'texture', repetition: 'repeat-x' }) })
    ]));
    expect(svg).toContain('data-fill-type="linear-gradient"');
    expect(svg).toContain('data-fill-type="radial-gradient"');
    expect(svg).toContain('data-fill-type="texture"');
    expect(svg).toContain('visual layer');
  });

  it('lets the Canvas renderer draw and replay composite primitives', () => {
    const calls = [];
    const ctx = createRecordingContext(calls);
    const store = createRecordingStore();
    const renderer = new CanvasRendererAddon({
      canvas: { width: 320, height: 240, getContext: () => ctx },
      store
    }).init();
    const primitive = createHousePrimitive({ x: 12, y: 16, width: 80, height: 64 });

    renderer.drawPrimitive(primitive);

    expect(renderer.drawCommands[0]).toMatchObject({
      op: 'primitive',
      primitive: expect.objectContaining({ type: 'house' })
    });
    expect(calls).toEqual(expect.arrayContaining([
      'fillRect',
      'beginPath',
      'lineTo',
      'fill'
    ]));
    expect(store.get('microkernel:drawCommands')).toHaveLength(1);
  });

  it('lets the lean renderer consume the same vector primitive descriptors', async () => {
    const calls = [];
    const ctx = createRecordingContext(calls);
    const { RendererAddon } = await import('../src/lean/addons/Renderer.js');
    const renderer = new RendererAddon({ backend: 'canvas' });

    await renderer.mount({
      document: { body: { appendChild: vi.fn() } },
      store: { set: vi.fn() }
    }, {
      canvas: { width: 320, height: 240, getContext: () => ctx, remove: vi.fn() }
    });
    renderer.drawPrimitive(createRingPrimitive({ x: 64, y: 64, outerRadius: 28, innerRadius: 14 }));

    expect(renderer.drawCount).toBeGreaterThan(0);
    expect(calls).toEqual(expect.arrayContaining(['arc', 'fill']));
  });

  it('documents drawPrimitive in the runtime help registry', async () => {
    const { help, listHelp } = await import('../src/help/HelpRegistry.js');

    expect(help('Renderer.drawPrimitive')).toMatchObject({
      name: 'Renderer.drawPrimitive',
      signature: expect.stringContaining('drawPrimitive')
    });
    expect(listHelp()).toHaveProperty('Renderer.drawPrimitive');
  });
});

function createRecordingContext(calls) {
  const record = (name) => (...args) => {
    calls.push(name);
    return args[0];
  };
  return {
    save: record('save'),
    restore: record('restore'),
    fillRect: record('fillRect'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    quadraticCurveTo: record('quadraticCurveTo'),
    arc: record('arc'),
    closePath: record('closePath'),
    fill: record('fill'),
    stroke: record('stroke'),
    fillText: record('fillText'),
    createPattern: record('createPattern'),
    createLinearGradient: () => createGradient(calls, 'createLinearGradient'),
    createRadialGradient: () => createGradient(calls, 'createRadialGradient'),
    set globalAlpha(value) {
      calls.push(`globalAlpha:${value}`);
    },
    set fillStyle(value) {
      calls.push(`fillStyle:${value}`);
    },
    set strokeStyle(value) {
      calls.push(`strokeStyle:${value}`);
    },
    set font(value) {
      calls.push(`font:${value}`);
    }
  };
}

function createGradient(calls, name) {
  calls.push(name);
  return {
    addColorStop: vi.fn(() => calls.push('gradient.addColorStop'))
  };
}

function createRecordingStore() {
  const state = new Map();
  return {
    get: vi.fn((key) => state.get(key)),
    set: vi.fn((key, value) => state.set(key, value))
  };
}
