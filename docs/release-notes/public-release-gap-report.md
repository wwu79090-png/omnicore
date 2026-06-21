# Public Release Gap Report

This report tracks the gaps that remain after local engine hardening is complete.

## Closed In This Pass

- README no longer links the primary call to action to the wrong Vercel site.
- README no longer presents the unpublished npm package as already available.
- README and promo materials no longer use stale `590` test and `730.71 kB` ESM metrics.
- Package default import now points to `dist/omnicore.esm.js` instead of source-only entrypoints.
- `npm run release:readiness` now writes a machine-readable release status report.

## Still Requires Credentials Or External Action

- NPM publish requires `NPM_TOKEN` or `NODE_AUTH_TOKEN`.
- Vercel deploy requires `VERCEL_TOKEN` and a verified project/domain target.
- GitHub Pages must be enabled or deployed from a tag workflow.
- A fresh GitHub Release must be created after the current readiness commit is pushed.

## Verification Artifacts

- `docs/release-notes/npm-publish-dry-run-report.json`
- `docs/release-notes/publish-security-audit-report.json`
- `docs/release-notes/release-readiness-report.json`
- `docs/release-notes/foundation-gate-report.json`
- `docs/release-notes/visual-regression-report.json`
- `docs/release-notes/runtime-soak-report.json`

## Operator Rule

If any release command reports a credential gap, stop and provide the missing secret. Do not continue to npm publish, Vercel deploy, or GitHub Release creation by pretending the external target succeeded.
