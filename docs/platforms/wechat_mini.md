# WeChat and Douyin Mini Game Adaptation Guide

## Package Size Reduction

- Keep PixiJS and optional Three.js decorative backgrounds as external or lazy-loaded chunks when the target platform allows subpackages.
- Prefer Canvas backend for first screen boot, then switch to Pixi/WebGL only after the loading scene.
- Compress textures to platform-supported formats and keep fallback PNG assets only for critical UI.
- Move optional 3D content, audio banks, and cinematic resources into remote or subpackage bundles.
- Avoid bundling editor-only tooling, source maps, and debug inspectors into release builds.

## First Screen Startup Checklist

| Item | Recommendation |
| --- | --- |
| Boot canvas | Create the platform canvas first and attach OmniCore after `wx.createCanvas()` or equivalent succeeds. |
| Renderer | Use `renderer: 'canvas'` for splash screens on low-end devices. |
| Asset manifest | Keep `asset-manifest.json` small; load only boot logo, first font, and initial scene bundle. |
| Network | Use platform request APIs through `PlatformAdapter.adaptWechat(wx)`. |
| Storage | Call `OmniCore.Storage.ensureEngineVersion()` before reading save data. |
| Monitoring | Emit startup duration, backend name, and migration status to your telemetry layer. |

## Compatibility Table

| Platform | Canvas 2D | WebGL | Pixi backend | Three.js Dimension3D background | Notes |
| --- | --- | --- | --- | --- | --- |
| Web Chrome/Edge | Yes | Yes | Yes | Yes | Primary development target. |
| Web Firefox | Yes | Yes | Yes | Yes | Verify shader/filter behavior per release. |
| Web Safari | Yes | Yes | Yes | Partial | Test texture formats and memory pressure. |
| Electron | Yes | Yes | Yes | Yes | Use generated `main.js`/`preload.js` templates. |
| WeChat Mini Game | Yes | Device-dependent | Adapter required | Limited | Use subpackages and platform canvas APIs. |
| Douyin Mini Game | Yes | Device-dependent | Adapter required | Limited | Follow similar constraints to WeChat; verify API names per SDK. |

## Rollback Notes

- Keep the previous resource manifest for at least one patch release.
- Preserve old save data via `OmniCore.Storage.backup()` before migration.
- If WebGL startup fails, switch to `canvas` backend and log the active fallback.
