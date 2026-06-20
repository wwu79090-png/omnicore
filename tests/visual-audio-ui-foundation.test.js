import { describe, expect, it, vi } from 'vitest';
import {
  AudioManager,
  CanvasRendererAddon,
  HtmlOverlay,
  ParticleSystem,
  Tween,
  UIStateMachine,
  createBezierPrimitive,
  createPolygonPrimitive,
  createRichTextPrimitive,
  createSectorPrimitive,
  layoutRichText,
  linearGradientFill,
  radialGradientFill,
  textureFill,
  vectorPrimitiveToSvg
} from '../src/index.js';

describe('visual primitive parity foundation', () => {
  it('describes sectors, bezier curves, arbitrary polygons, gradients, textures, masks, and blend modes', () => {
    const mask = createPolygonPrimitive({
      role: 'cabin-mask',
      points: [
        { x: 16, y: 16 },
        { x: 96, y: 16 },
        { x: 112, y: 64 },
        { x: 24, y: 80 }
      ]
    });
    const sector = createSectorPrimitive({
      x: 64,
      y: 64,
      radius: 48,
      startAngle: 0,
      endAngle: Math.PI * 0.75,
      fill: linearGradientFill({
        x0: 16,
        y0: 16,
        x1: 112,
        y1: 80,
        stops: [
          [0, '#67e8f9'],
          [1, '#0f172a']
        ]
      }),
      blendMode: 'screen',
      mask
    });
    const bezier = createBezierPrimitive({
      start: { x: 20, y: 120 },
      cp1: { x: 80, y: 40 },
      cp2: { x: 120, y: 160 },
      end: { x: 180, y: 88 },
      stroke: radialGradientFill({
        x0: 90,
        y0: 90,
        r0: 4,
        x1: 90,
        y1: 90,
        r1: 96,
        stops: [
          [0, '#ffffff'],
          [1, '#60a5fa']
        ]
      }),
      lineWidth: 3
    });
    const polygon = createPolygonPrimitive({
      points: [
        { x: 180, y: 24 },
        { x: 260, y: 32 },
        { x: 248, y: 96 },
        { x: 192, y: 84 }
      ],
      fill: textureFill({ source: { id: 'code-grid' }, repetition: 'repeat-x' }),
      blendMode: 'multiply'
    });

    const calls = [];
    const renderer = new CanvasRendererAddon({
      canvas: { width: 320, height: 180, getContext: () => createRecordingContext(calls) }
    }).init();
    renderer.drawPrimitive([sector, bezier, polygon]);
    const svg = vectorPrimitiveToSvg([sector, bezier, polygon], { width: 320, height: 180 });

    expect(sector.commands[0]).toMatchObject({
      op: 'sector',
      blendMode: 'screen',
      mask: expect.objectContaining({ type: 'polygon' })
    });
    expect(bezier.commands[0]).toMatchObject({ op: 'bezier', lineWidth: 3 });
    expect(polygon.commands[0]).toMatchObject({
      op: 'polygon',
      fill: expect.objectContaining({ type: 'texture' }),
      blendMode: 'multiply'
    });
    expect(calls).toEqual(expect.arrayContaining([
      'createLinearGradient',
      'createRadialGradient',
      'createPattern:repeat-x',
      'globalCompositeOperation:screen',
      'clip',
      'bezierCurveTo',
      'arc'
    ]));
    expect(svg).toContain('data-primitive="sector"');
    expect(svg).toContain('data-fill-type="linear-gradient"');
    expect(svg).toContain('data-fill-type="texture"');
  });
});

describe('hybrid HTML UI and rich text rendering', () => {
  it('keeps DOM overlays separate from Canvas UI and lays out stroked shadowed rich text', () => {
    const documentRef = createDocumentSpy();
    const overlay = new HtmlOverlay({
      document: documentRef,
      root: documentRef.body,
      className: 'omnicore-html-ui'
    }).mount();
    const hud = overlay.add('hud', {
      html: '<button>Run</button>',
      style: { left: '12px', top: '8px' },
      pointerEvents: 'auto'
    });
    overlay.update('hud', { textContent: 'Ready', visible: true });

    const richText = layoutRichText({
      segments: [
        { text: 'OmniCore ', fill: '#e0f2fe', weight: 700 },
        { text: 'robot cabin code layer', fill: '#67e8f9' }
      ],
      maxWidth: 96,
      fontSize: 14,
      stroke: '#0f172a',
      shadow: { color: '#38bdf8', blur: 8, offsetX: 0, offsetY: 2 }
    });
    const primitive = createRichTextPrimitive({
      x: 16,
      y: 24,
      layout: richText
    });
    const calls = [];
    const renderer = new CanvasRendererAddon({
      canvas: { width: 240, height: 120, getContext: () => createRecordingContext(calls) }
    }).init();
    renderer.drawPrimitive(primitive);

    expect(documentRef.body.children).toContain(overlay.root);
    expect(hud.textContent).toBe('Ready');
    expect(hud.style.pointerEvents).toBe('auto');
    expect(richText.lines.length).toBeGreaterThan(1);
    expect(richText.lines[0].segments[0]).toMatchObject({ fill: '#e0f2fe', stroke: '#0f172a' });
    expect(calls).toEqual(expect.arrayContaining([
      'shadowColor:#38bdf8',
      'strokeText',
      'fillText'
    ]));

    overlay.destroy();
    expect(documentRef.body.children).not.toContain(overlay.root);
  });
});

describe('audio pools, fades, tween sequences, particles, and UI states', () => {
  it('plays pooled audio with volume control, loop support, and fades', () => {
    const context = createAudioContextSpy();
    const audio = new AudioManager({ context });
    audio.buffers.set('click', { duration: 0.12 });

    audio.setMasterVolume(0.75);
    audio.createPool('click', { size: 2, bus: 'sfx', volume: 0.5, loop: false });
    const first = audio.playFromPool('click', { fadeIn: 0.2 });
    const second = audio.playFromPool('click');
    audio.fadeOut(first, { duration: 0.3 });

    expect(audio.getBus('master')).toMatchObject({ volume: 0.75, effectiveVolume: 0.75 });
    expect(first.omniPool).toMatchObject({ key: 'click', index: 0 });
    expect(second.omniPool).toMatchObject({ key: 'click', index: 1 });
    expect(first.omniGain.gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 2);
    expect(first.omniGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.5, 2.2);
    expect(first.omniGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.0001, 2.3);
  });

  it('runs tween helpers, particle rendering, and animated UI state transitions', () => {
    const target = { alpha: 0, frame: 'idle-0' };
    const tween = Tween.to(target, { alpha: 1, duration: 100, ease: 'linear', autoplay: false });
    const sequence = Tween.sequence(target, [
      { time: 0, props: { frame: 'idle-0' } },
      { time: 100, props: { frame: 'idle-1' } },
      { time: 200, props: { frame: 'idle-2' } }
    ], { loop: true, duration: 300 });

    tween.play().update(50);
    sequence.update(125);
    expect(target.alpha).toBeCloseTo(0.5);
    expect(target.frame).toBe('idle-1');

    const calls = [];
    const particles = new ParticleSystem({
      maxParticles: 4,
      blendMode: 'lighter',
      rng: () => 0.5
    });
    particles.emit(2, {
      x: 24,
      y: 32,
      lifetime: 1,
      velocity: { x: [-10, 10], y: [-20, 0] },
      size: [8, 2],
      color: ['#e0f2fe', '#38bdf8']
    });
    particles.update(0.5);
    particles.render(createRecordingContext(calls));

    expect(particles.activeCount).toBe(2);
    expect(particles.toRenderCommands()).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: 'particle', alpha: 0.5, blendMode: 'lighter' })
    ]));
    expect(calls).toEqual(expect.arrayContaining(['globalCompositeOperation:lighter', 'arc', 'fill']));

    const panel = { alpha: 1, visible: true };
    const states = [];
    const machine = new UIStateMachine({
      initial: 'menu',
      states: {
        menu: { onEnter: () => states.push('enter:menu'), onExit: () => states.push('exit:menu') },
        play: { onEnter: () => states.push('enter:play') }
      }
    }).start();
    machine.transitionTo('play', {
      duration: 100,
      animations: [
        { target: panel, props: { alpha: { from: 1, to: 0 } } }
      ]
    });
    machine.update(50);
    expect(panel.alpha).toBeCloseTo(0.5);
    machine.update(50);

    expect(machine.current).toBe('play');
    expect(panel.alpha).toBe(0);
    expect(states).toEqual(['enter:menu', 'exit:menu', 'enter:play']);
  });
});

function createRecordingContext(calls) {
  const record = (name) => (...args) => {
    calls.push(name);
    return args[0];
  };
  const gradient = {
    addColorStop(offset, color) {
      calls.push(`colorStop:${offset}:${color}`);
    }
  };
  return {
    save: record('save'),
    restore: record('restore'),
    fillRect: record('fillRect'),
    clearRect: record('clearRect'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    quadraticCurveTo: record('quadraticCurveTo'),
    bezierCurveTo: record('bezierCurveTo'),
    arc: record('arc'),
    rect: record('rect'),
    clip: record('clip'),
    closePath: record('closePath'),
    fill: record('fill'),
    stroke: record('stroke'),
    fillText: record('fillText'),
    strokeText: record('strokeText'),
    measureText: (text) => ({ width: String(text).length * 7 }),
    createLinearGradient: () => {
      calls.push('createLinearGradient');
      return gradient;
    },
    createRadialGradient: () => {
      calls.push('createRadialGradient');
      return gradient;
    },
    createPattern: (source, repetition) => {
      calls.push(`createPattern:${repetition}`);
      return { source, repetition };
    },
    set globalAlpha(value) {
      calls.push(`globalAlpha:${value}`);
    },
    set globalCompositeOperation(value) {
      calls.push(`globalCompositeOperation:${value}`);
    },
    set fillStyle(value) {
      calls.push(typeof value === 'string' ? `fillStyle:${value}` : 'fillStyle:object');
    },
    set strokeStyle(value) {
      calls.push(typeof value === 'string' ? `strokeStyle:${value}` : 'strokeStyle:object');
    },
    set lineWidth(value) {
      calls.push(`lineWidth:${value}`);
    },
    set font(value) {
      calls.push(`font:${value}`);
    },
    set shadowColor(value) {
      calls.push(`shadowColor:${value}`);
    },
    set shadowBlur(value) {
      calls.push(`shadowBlur:${value}`);
    },
    set shadowOffsetX(value) {
      calls.push(`shadowOffsetX:${value}`);
    },
    set shadowOffsetY(value) {
      calls.push(`shadowOffsetY:${value}`);
    }
  };
}

function createDocumentSpy() {
  const body = createElementSpy('body');
  return {
    body,
    createElement: (tagName) => createElementSpy(tagName)
  };
}

function createElementSpy(tagName) {
  const element = {
    tagName,
    children: [],
    dataset: {},
    style: {},
    className: '',
    innerHTML: '',
    textContent: '',
    parentNode: null,
    appendChild(child) {
      child.parentNode = element;
      element.children.push(child);
      return child;
    },
    removeChild(child) {
      element.children = element.children.filter((item) => item !== child);
      child.parentNode = null;
      return child;
    },
    remove() {
      element.parentNode?.removeChild?.(element);
    }
  };
  return element;
}

function createAudioContextSpy() {
  const context = {
    currentTime: 2,
    destination: { id: 'destination' },
    createDynamicsCompressor: vi.fn(() => createConnectableNode({
      threshold: { value: 0 },
      knee: { value: 0 },
      ratio: { value: 0 },
      attack: { value: 0 },
      release: { value: 0 }
    })),
    createGain: vi.fn(() => createConnectableNode({
      gain: {
        value: 1,
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      }
    })),
    createBufferSource: vi.fn(() => createConnectableNode({
      start: vi.fn(),
      stop: vi.fn(),
      loop: false
    }))
  };
  return context;
}

function createConnectableNode(extra = {}) {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    ...extra
  };
}
