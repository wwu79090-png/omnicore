# ThreeDParticles

Official OmniCore plugin for lightweight 3D-style burst effects in 2.5D scenes.

```js
import ThreeDParticles from './src/index.js';

const particles = ThreeDParticles.install({ scene });
particles.spawnBurst3D({ x: 120, y: 80, z: 4, count: 32 });
```

The plugin stores particle depth, velocity, lifetime, and projected scale on plain objects so it can run in Canvas, Pixi, WebGPU, and headless tests without extra dependencies.
