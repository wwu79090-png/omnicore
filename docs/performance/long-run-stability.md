# Long-Run Stability Evidence

Runtime soak checks repeatedly create scenes, sprites, resources, tweens, timers, and listeners, then destroy the scene and verify that no retained children, listeners, or tracked resources remain.

Hot-path mode also records the allocation and sync strategy that should remain stable under long sessions:

- pooled runtime types: `Sprite`, `Tween`, `Particle`, `Event`
- dirty sync strategy: `only-dirty-records`
- render queue strategy: `state-compatible-batching`

## Minimal Verification

```bash
npm run test:soak -- --iterations 120 --hot-paths
```

The command writes `docs/release-notes/runtime-soak-report.json`.
