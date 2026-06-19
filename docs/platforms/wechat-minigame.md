# WeChat Mini Game Platform Guide

This guide records the current OmniCore release path for WeChat Mini Game validation. It is intentionally limited to commands and artifacts that exist in this repository.

## Supported Scope

- 2D-first runtime validation through `scripts/test-wechat.js`.
- Platform asset packaging through `npm run build:platform-assets`.
- Generic platform export through `npm run export:platform`.
- Performance budget reporting through `wechat-compliance-report.json`.

## Validation Commands

Run the lightweight platform smoke check:

```bash
npm run test:wechat
```

Run the generic minigame export smoke check:

```bash
npm run test:minigame
```

Build platform-specific assets:

```bash
npm run build:platform-assets
```

## Release Checklist

- `npm run lint`
- `npm test`
- `npm run test:contract`
- `npm run benchmark:ci`
- `npm run test:wechat`
- `npm run test:minigame`
- `npm run build:platform-assets`
- `npm run export:platform`

## Known Boundaries

- The current validation is script-level smoke coverage, not a full WeChat DevTools automation run.
- WebGPU and Three.js decorative layers should be treated as optional and should not be required for WeChat Mini Game compatibility.
- Real-device memory and FPS samples should be refreshed before a public release.
