# NPM Package Quality Evidence

`npm run publish:dry-run` validates the packed package before publication. The report includes:

- required files: `package.json`, `README.md`, `LICENSE`, `src/index.js`, `dist/omnicore.esm.js`, `dist/omnicore.d.ts`
- tarball size, unpacked size, and entry count budgets
- largest files
- included docs and examples
- suspicious file scan for env files, private keys, npmrc files, and certificates
- provenance, SBOM, tree-shaking, and type declaration readiness flags

## Minimal Verification

```bash
npm run publish:dry-run
```

The command writes `docs/release-notes/npm-publish-dry-run-report.json`.
