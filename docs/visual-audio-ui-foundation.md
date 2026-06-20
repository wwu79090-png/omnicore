# OmniCore Visual, Audio, UI Foundation

OmniCore now covers the runtime features needed to reproduce complex HTML5 scenes such as houses, robot cabins, translucent code overlays, pulsing NPC panels, sound feedback, and animated menu flows without adding new dependencies.

## Complex Primitives And Fills

```js
import {
  createSectorPrimitive,
  createBezierPrimitive,
  createPolygonPrimitive,
  linearGradientFill,
  radialGradientFill,
  textureFill
} from 'omnicore';

const cabinMask = createPolygonPrimitive({
  points: [
    { x: 16, y: 16 },
    { x: 128, y: 24 },
    { x: 112, y: 96 },
    { x: 24, y: 80 }
  ]
});

renderer.drawPrimitive(createSectorPrimitive({
  x: 72,
  y: 72,
  radius: 56,
  fill: linearGradientFill({
    x0: 16,
    y0: 16,
    x1: 128,
    y1: 96,
    stops: [[0, '#67e8f9'], [1, '#0f172a']]
  }),
  blendMode: 'screen',
  mask: cabinMask
}));
```

Supported descriptor ops include `ring`, `sector`, `bezier`, `polygon`, `capsule`, `rect`, `text`, and `richText`. Fill descriptors support `linear-gradient`, `radial-gradient`, and `texture`; Canvas renderers resolve them through native Canvas APIs.

## Hybrid HTML UI And Rich Text

`HtmlOverlay` mounts a DOM layer above Canvas without replacing `UIRenderManager`. This keeps CSS/HTML panels available while Canvas UI remains deterministic.

```js
const overlay = new OmniCore.HtmlOverlay({ root: document.body }).mount();
overlay.add('hud', {
  html: '<button>Run</button>',
  pointerEvents: 'auto',
  style: { left: '12px', top: '8px' }
});

const layout = OmniCore.layoutRichText({
  segments: [
    { text: 'OmniCore ', fill: '#e0f2fe', weight: 700 },
    { text: 'code layer', fill: '#67e8f9' }
  ],
  maxWidth: 160,
  stroke: '#0f172a',
  shadow: { color: '#38bdf8', blur: 8 }
});
renderer.drawPrimitive(OmniCore.createRichTextPrimitive({ x: 20, y: 24, layout }));
```

## Audio Pools And Fades

`AudioManager` supports named buses, master volume, reusable pools, loop playback, and fade-in/fade-out automation.

```js
const audio = new OmniCore.AudioManager();
await audio.load('click', '/audio/click.ogg');
audio.setMasterVolume(0.8);
audio.createPool('click', { size: 4, bus: 'sfx', volume: 0.5 });
const voice = audio.playFromPool('click', { fadeIn: 0.08 });
audio.fadeOut(voice, { duration: 0.2 });
```

## Tweens, Particles, And UI State

```js
OmniCore.Tween.to(panel, { alpha: 1, duration: 180 });

const sequence = OmniCore.Tween.sequence(robot, [
  { time: 0, props: { frame: 'idle-0' } },
  { time: 100, props: { frame: 'idle-1' } },
  { time: 200, props: { frame: 'idle-2' } }
], { loop: true, duration: 300 });

const particles = new OmniCore.ParticleSystem({ maxParticles: 128, blendMode: 'lighter' });
particles.emit(24, {
  x: 240,
  y: 120,
  lifetime: 0.8,
  velocity: { x: [-20, 20], y: [-40, 0] },
  size: [8, 1],
  color: ['#e0f2fe', '#38bdf8']
});

const states = new OmniCore.UIStateMachine({
  initial: 'menu',
  states: {
    menu: {},
    play: {}
  }
}).start();
states.transitionTo('play', {
  duration: 160,
  animations: [{ target: panel, props: { alpha: { from: 1, to: 0 } } }]
});
```

## Minimal Verification

- `npx vitest run tests/visual-audio-ui-foundation.test.js`
- `npx vitest run tests/vector-primitives.test.js tests/advanced-graphics-geom.test.js tests/advanced-2d-systems.test.js tests/omnicore.test.js`
- Manual smoke: render one masked gradient sector, one texture polygon, one rich text layer, one pooled sound, one looping particle burst, and one `UIStateMachine` panel transition.
