# OmniCore Polish Pass

Generated: 2026-06-18

## API Consistency

- Added API style audit via `npm run audit:api`.
- Generated API docs via `npm run docs`; docs generation fails if a public core method has an unknown type.
- Completed JSDoc parameter and return types for `Bootstrap`, `EventBus`, `Store`, `RendererAdapter`, and `Kernel`.
- Public naming audit result: no class, method, or constant renames were required.

## Error Messages

- Added `OmniError` helpers for `[OmniCore] [Module] message` formatting.
- Converted source-level raw `throw new Error(...)` sites to OmniCore-specific errors, except `Logger` stack capture.
- Localized user-facing `console.warn` and `console.error` messages.
- Normalized loader, renderer, worker, hot reload, database, scene, prefab, plugin, and lean runtime error paths.

## Developer Experience

- Unified Windows and macOS launchers through `node launcher.js --open`.
- Centralized launcher dependency checks in `ensureDependencies()`.
- Preserved automatic browser opening by default while supporting `--no-open`.

## Runtime Defaults

- Centralized renderer, canvas, debug, loader, loop, asset manifest, engine version, and asset directory defaults in `src/config/defaults.js`.
- Replaced duplicated runtime defaults across standard and lean entry points.

## Assets

- Normalized default sprites under `assets/sprites/default/`.
- Moved source logo to `assets/branding/logo-highres.png`.
- Removed stale placeholder files.
- `npm run audit:assets` reports no missing or unused assets.
