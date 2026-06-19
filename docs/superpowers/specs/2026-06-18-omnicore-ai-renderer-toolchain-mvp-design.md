# OmniCore AI Renderer Toolchain MVP Design

**Goal:** Build the first runnable vertical slice toward an AI-assisted, multi-backend, editor-rich OmniCore engine without breaking the current free/open runtime.

**Recommended Direction:** Vertical Slice MVP. Ship small, testable contracts across AI tools, renderer abstraction, debug editors, marketplace prototype, and CI reporting before attempting true Native Vulkan, real payments, or full visual editor products.

## Scope

This phase includes:

- AI Console command handling in debug runtime through a small `AICommandService`.
- Local deterministic fallback generation for natural language entity commands.
- `Tilemap.generateWithAI(prompt)` returning a basic tile matrix plus `scene.json`.
- A renderer backend interface contract and adapters for current Pixi/Canvas plus a WebGPU prototype.
- Electron native rendering bridge detection stub with Direct3D/Vulkan capability metadata.
- Runtime debug editors for `.omni-anim`, data table JSON export, and audio config export.
- Marketplace server prototype with encrypted package payloads and revenue split metadata.
- GitHub Actions PR workflow that runs unit tests, e2e tests, benchmark, and uploads visual/performance artifacts.

This phase explicitly does not claim:

- Real Native Vulkan rendering into an Electron nativeWindow.
- Real payment processing or automatic payout.
- Safe execution of arbitrary AI-generated code.
- Full skeleton animation timeline UX.
- Full Excel parser with binary workbook fidelity.

## Architecture

AI tooling is split into generation and injection. `AICommandService` parses or requests JSON from a provider, validates it into OmniCore entity commands, then injects into the current scene. This keeps model output away from direct code execution.

Renderer work starts by formalizing the backend surface: `init`, `renderScene`, `resize`, `fade`, and `destroy`. Existing Pixi/Canvas remains the stable production path. `WebGPURenderer` is a feature-detected prototype that draws basic entities and falls back through `RendererManager` when unsupported.

Editor work stays debug/runtime scoped. Each editor owns a compact custom format and writes through Store keys so games can persist externally if desired.

Marketplace work is a local service prototype. It demonstrates upload metadata, encrypted package response, install metadata, and split calculation without requiring live billing.

## Components

- `src/ai/AICommandService.js`: Natural language command generation and scene injection.
- `src/debug/ApiQuickPanel.js`: F1 command input integrated with the existing panel.
- `src/tilemap/AITilemapGenerator.js`: Prompt-to-tilemap deterministic generator.
- `src/renderer/RendererBackend.js`: Backend contract helpers.
- `src/renderer/WebGPURenderer.js`: WebGPU prototype renderer.
- `src/platform/ElectronNativeBridge.js`: Electron native renderer capability bridge stub.
- `src/editor/SkeletonAnimationEditor.js`: `.omni-anim` runtime editor model.
- `src/data/DataTableEditor.js`: CSV/Excel-text to JSON with version history.
- `src/audio/AudioEditor.js`: Runtime audio parameter editing and export.
- `src/marketplace/MarketplaceServer.js`: Paid plugin marketplace prototype.
- `.github/workflows/pr-quality.yml`: PR automation for tests, e2e, benchmark, and artifacts.

## Testing

Tests focus on contracts, not real GPUs or external services:

- AI command creates a controllable player entity and injects it into scene.
- Tilemap AI generator recognizes terrain terms and returns tile matrix plus scene JSON.
- RendererManager can instantiate `webgpu`; unsupported environments fail cleanly into fallback.
- All debug editors export their target custom formats.
- Marketplace encrypts package payload and produces split metadata.
- PR workflow contains required test, e2e, benchmark, artifact steps.

## Rollout

The first implementation should be opt-in and backward compatible:

- `debug: true` enables F1 panel UI; AI command input is available only there.
- `Game({ renderer: 'webgpu' })` and `Backend.switch('webgpu')` are accepted, but unsupported devices fall back.
- Marketplace prototype is script/library only and does not affect normal npm package use.
- CI workflow is additive.
