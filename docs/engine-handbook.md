# OmniCore Engine Handbook

This handbook is the stable navigation layer for shipping games with OmniCore.

## Getting Started

- `README.md`: install, quick start, online demos, release badge, telemetry notice.
- `docs/ten-minute-quickstart.md`: smallest runnable scene.
- `examples/full-game-demo/`: reference 30-minute playable sample.

## Architecture

- Runtime composition: `Game`, `SceneManager`, `Scene`, `Store`, `InputManager`, `AudioManager`.
- Rendering fallback: WebGPU first, WebGL/Pixi next, Canvas as the safe floor.
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
