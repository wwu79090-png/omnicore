# OmniCore Public Benchmarks

OmniCore treats benchmark evidence as an ecosystem artifact: external teams should be able to reproduce the numbers before they migrate a project.

## Reproducible Commands

| Command | Purpose | Blocking Signal |
| --- | --- | --- |
| `npm run benchmark:ci` | Browser runtime regression gate | FPS, draw calls, and latency regressions |
| `npm run performance:budget` | Runtime and package budget gate | Entity sync, tile scan, depth sort, collision projection, and package size |
| `npm run quality:engine` | Determinism and engine budget gate | Simulation determinism, invariant failures, frame budget |
| `npm run doctor` | Release and adoption readiness gate | Release gates, WeChat package, evidence completeness |

## device baseline

Device evidence is stored in:

- `docs/performance/device-baselines.json`
- `docs/performance/device-trend.svg`
- `docs/hardware-baseline/hardware-baseline.json`
- `docs/hardware-baseline/real-device-fps-trend.svg`

New samples should be added with:

```bash
npm run benchmark:device-baseline -- --sample reports/device-sample.json
npm run benchmark:hardware-baseline -- --sample reports/mobile-sample.json
```

## Publication Rule

When a benchmark number appears in README, website pages, release notes, or migration guides, the source command and evidence file must be named next to it. This keeps market comparison claims auditable instead of promotional.
