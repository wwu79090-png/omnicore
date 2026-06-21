# OmniCore Public Release Evidence

Generated for the v1.0.0 public-readiness pass.

## Current Verified Local State

- Package version: `1.0.0`.
- Build artifact: `dist/omnicore.esm.js`.
- Current ESM artifact size: `928.55 kB` decimal.
- Lean core artifact: `dist/omnicore-core.js` / `dist/omnicore-core.iife.js`, approximately 33 kB class output.
- Automated validation target: 800+ unit, integration, release, visual, and smoke checks.
- Release gates: `npm run build`, `npm run foundation:gate`, `npm run publish:dry-run`, `npm run publish:audit`, and `npm run release:readiness`.

## External Publication Status

| Target | Current status | Required action |
| --- | --- | --- |
| NPM `omnicore` | Pending. Registry lookup currently returns not published. | Provide `NPM_TOKEN` / `NODE_AUTH_TOKEN`, then publish from a release tag. |
| Vercel homepage | Pending. `https://omnicore.vercel.app/` currently resolves to a non-engine OmniCore Digital site. | Provide `VERCEL_TOKEN` and deploy this repository, or replace README links with the actual engine deployment URL. |
| GitHub Pages | Pending. Repository Pages is not enabled for the current public docs artifact. | Enable Pages or run the tag release workflow after secrets are configured. |
| GitHub Release | Checked by `npm run release:readiness`. | Create a new release after each public-readiness push and confirm it targets the current commit. |

## Release Commands

```bash
npm run build
npm run foundation:gate
npm run publish:dry-run
npm run publish:audit
npm run release:readiness
```

Strict publication mode, used by the GitHub release workflow:

```bash
npm run release:readiness -- --strict-publication
```

If this strict command reports `npm-auth-token-present` or `vercel-token-present`, stop and provide the corresponding secret before publishing.

## Hardware Evidence Checklist

Record these clips before using 144 FPS / WebGPU / 2.5D claims in a launch post:

1. Open `examples/market-showcase/` in Chrome on the target machine.
2. Record the FPS counter with 1000 sprites visible for at least 15 seconds.
3. Toggle 2.5D story mode and capture the layered city, transparent cockpit, and HTML overlay.
4. Open DevTools console and confirm there are no `error` or `warn` messages during the capture.
5. Run `createRendererFallbackMatrix({ probe: true })` in a supported browser and save the WebGPU -> Pixi -> Canvas fallback result.
6. Save the device model, browser version, GPU name, OS, screen refresh rate, and capture date beside the video.

## Do Not Claim Yet

- Do not claim `npm install omnicore` works from the public registry until `npm view omnicore version` succeeds.
- Do not claim `omnicore.vercel.app` is the official homepage until its page title and body identify this game engine.
- Do not claim a fresh GitHub Release covers today&apos;s commits until the latest release targets the current commit or tag.
