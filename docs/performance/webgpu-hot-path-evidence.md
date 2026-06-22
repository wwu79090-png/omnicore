# WebGPU Hot-Path Evidence

The WebGPU evidence command can embed descriptor-level proof for the three hot paths used by OmniCore's WebGPU route:

- instancing: many sprite instances are represented as one instanced draw call
- texture arrays: compatible sprites are grouped by texture layer
- compute dispatch: particle or batch work is sized into deterministic workgroups

## Minimal Verification

```bash
npm run webgpu:evidence -- --includeHotPaths true --out docs/release-notes/webgpu-hot-path-evidence.json
```

The command does not require a live GPU in CI. Hardware runs should attach browser, GPU, FPS, screenshot, and console error/warn status to the release notes.
