# OmniCore Engine Handbook

This handbook is the stable navigation layer for shipping games with OmniCore.

## Getting Started

- `README.md`: install, quick start, online demos, release badge, telemetry notice.
- `docs/ten-minute-quickstart.md`: smallest runnable scene.
- `docs/public-release-evidence.md`: public release evidence, external publication status, and hardware capture checklist.
- `examples/full-game-demo/`: reference 30-minute playable sample.
- `examples/market-showcase/`: market-facing 1000-sprite, 2.5D, and HTML overlay demo.

## Architecture

- Runtime composition: `Game`, `SceneManager`, `Scene`, `Store`, `InputManager`, `AudioManager`.
- Rendering fallback: WebGPU first, WebGL/Pixi next, Canvas as the safe floor.
- Renderer fallback matrix: `createRendererFallbackMatrix({ probe: true })` records WebGPU -> Pixi -> Canvas capability reasons before release or support triage. Typical blockers are `navigator-gpu-missing`, `webgl-context-missing`, and `canvas-2d-context-missing`; `resolveRendererFallbackPlan('webgpu', matrix)` returns the attempted order and the usable subset.
- Addons: optional features live under npm packages or `src/addons`.

## Migration

- Phaser/Pixi migration helpers: `OmniCore.Storage.importLegacy()`, `Input.pointer.enableEventPropagation()`, and debug store snapshots.
- HTML overlay migration: route DOM clicks through HTML and keep engine keyboard shortcuts out of text inputs.

## API Governance

- Policy: `docs/api/public-api-policy.md`.
- Machine-readable baseline: `docs/api/api-surface.json`.
- CI gate: `npm run audit:api-surface`.

## Platform Publishing

- Web: `npm run build`.
- WeChat: `npm run build:wechat`.
- Multi-platform assets: `npm run build:platform-assets`.
- Release bundle: `npm run dist:full`.
- Release readiness: `npm run release:readiness` writes `docs/release-notes/release-readiness-report.json` and separates local blockers from credential or external publication gaps.
- Public evidence: run `npm run publish:dry-run`, `npm run publish:audit`, and the hardware checklist in `docs/public-release-evidence.md` before claiming npm, Vercel, WebGPU, or 144 FPS launch readiness.

## WebGPU And 2.5D Evidence

Automated tests cover renderer fallback planning, visual smoke tests, 2.5D sorting contracts, and market showcase loading. They do not replace real hardware evidence.

Before community launch posts, capture one browser video that shows:

- `examples/market-showcase/` running the 1000-sprite scene with the FPS counter visible.
- 2.5D story mode with the city layer, transparent cockpit, and HTML overlay visible.
- DevTools console open with no error or warning messages.
- `createRendererFallbackMatrix({ probe: true })` output for the same device.

Record the device model, GPU, browser version, OS, refresh rate, and capture date beside the video.

## Plugin Development

- Standard plugin example: `examples/plugins/standard-plugin/`.
- Capability enforcement: `OmniCore.PluginPermissionSandbox`.
- Marketplace validation: `npm run marketplace:validate`.

## Runtime Reliability

- Error boundary: `OmniCore.OmniCoreErrorBoundary`.
- Resource ownership: `OmniCore.ResourceOwnershipGraph` and `scene.trackResource()`.
- Scene lifecycle: `OmniCore.SceneLifecycle`.
- Deterministic replay: `OmniCore.DeterministicReplay`.

## Save, Audio, UI, And Multiplayer

- Save slots: `OmniCore.Storage.saveSlot()`, `loadSlot()`, `rollbackSlot()`, `listSlots()`.
- Audio mixer: `audio.configureStandardBuses()`, `saveMixerState()`, `loadMixerState()`.
- UI focus: `OmniCore.UIFocusManager`.
- Multiplayer baseline: `OmniCore.MultiplayerSession`.

## Privacy And Telemetry

Telemetry is opt-in. Runtime health collection stays disabled unless the developer explicitly passes `telemetry: true` or `telemetry: { enabled: true }`.

Collected categories are limited to engine version, aggregated FPS/memory/renderer state, WebGL state, API usage counters, and error type summaries. Game content, chat text, player names, payment data, and arbitrary save data are not collected by default.

## Troubleshooting

- `npm run doctor`: engine environment diagnosis.
- `npm run health`: local runtime health check.
- `npm run security-check`: supply-chain safety checks.
- `npm run dependency:forensics`: dependency script and remote-origin audit.
