# Changelog

All notable changes to OmniCore are documented here.

## [0.2.0] - 2026-06-18

### Added

- Automated maintenance scripts: `health`, `audit:deprecated`, `security-check`, `test:mem`, and `test:backends`.
- GitHub Actions maintenance workflow with scheduled, release, push, and manual triggers.
- Lossless Storage migration hooks with `engineVersion`, `onVersionMismatch`, and backup preservation.
- Local AI code review hook template for Ollama-compatible endpoints.
- Platform guidance and compatibility table for Web, Electron, WeChat Mini Game, and Douyin Mini Game.
- Release notes draft directory and health/security report outputs.

### Fixed

- Maintenance workflow now records health, dependency, and release-note evidence in stable locations.
- Security script uses cross-platform npm/npx command resolution.

### Deprecated

- `OmniCore.Backend.use()` is deprecated; use `OmniCore.Backend.switch()`.
- `OmniCore.Storage.read()` is deprecated; use `OmniCore.Storage.get()`.
- `OmniCore.Storage.write()` is deprecated; use `OmniCore.Storage.set()`.

### Migration

- Added `migration/v1.0.0_to_v2.0.0.js` to demonstrate old `playerData` to new `player` structure migration while preserving `__backup.playerData`.

### Security

- Added `docs/security/security.md` as the canonical security fix log with affected and fixed version fields.

## [0.1.0] - 2026-06-18

### Added

- Initial OmniCore engine skeleton with PixiJS v8 renderer, SceneManager, Loop, Store, Loader, Input, Camera, Timer, Animation, Prefab, Event Sheet, platform adapters, examples, and tests.
