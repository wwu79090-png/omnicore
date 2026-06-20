# OmniCore Plugin Catalog

This catalog turns plugin adoption into a reviewable ecosystem surface instead of a loose README list.

## Official Packages

| Package | Status | Scope | Evidence |
| --- | --- | --- | --- |
| `@omnicore/plugin-wechat-monetization` | official | WeChat payment and ads | `packages/omnicore-plugin-wechat-monetization` |

## Example Plugins

| Example | Use Case | Path |
| --- | --- | --- |
| FPS Monitor | Runtime performance overlay | `examples/plugins/fps-monitor` |
| Auto Move | Small gameplay behavior plugin | `examples/plugins/auto-move` |
| Save Cloud | Cloud save adapter pattern | `examples/plugins/SaveCloud` |
| WeChat Mini Game Monetization | Platform monetization adapter | `examples/plugins/WechatMiniGameMonetization` |
| Analytics Beacon | External analytics integration pattern | `examples/plugins/analytics-beacon` |

## review checklist

Every plugin submitted to the catalog must include:

- `name`, `version`, and `install(context)` entrypoint.
- A README with install, usage, and teardown behavior.
- A runnable demo or fixture under `examples/plugins/<plugin-name>`.
- No hidden network calls before the host game explicitly enables the plugin.
- Compatibility notes for Web, WeChat Mini Game, and desktop shells when relevant.
- A clear owner and issue-reporting path.

## Adoption Signals

The catalog is counted by `MarketEngineComparison` as ecosystem evidence together with plugin packages, examples, tutorials, case studies, and public benchmark evidence.
