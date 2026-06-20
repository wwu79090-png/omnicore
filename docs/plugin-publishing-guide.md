# OmniCore Plugin Publishing Guide

This guide is the official path for external developers who want to build, version, package, submit, and monetize OmniCore plugins.

## 1. Build an OmniCore 标准插件

An OmniCore 标准插件 should be small, reversible, and explicit about its runtime contract.

Required manifest fields:

```json
{
  "name": "omni-weather-effects",
  "displayName": "Omni Weather Effects",
  "version": "1.0.0",
  "main": "src/index.js",
  "author": "Your Studio",
  "license": "MIT",
  "isPaid": false
}
```

Runtime requirements:

- Export `name`, `version`, and `install(context)`.
- Return a cleanup handle or expose `destroy()` when the plugin registers events, patches state, creates timers, or mounts UI.
- Keep platform-specific code behind adapters such as `wechat`, `web`, or `electron`.
- Include a README, a minimal demo, and screenshots for the marketplace listing.
- Do not mutate global objects by default. If a global bridge is unavoidable, document it and undo it in `destroy()`.

Minimal shape:

```js
export default {
  name: 'omni-weather-effects',
  version: '1.0.0',
  install(context) {
    const { bus, store } = context;
    const off = bus?.on?.('scene:ready', () => store?.set?.('weather:ready', true));
    return {
      destroy() {
        off?.();
      }
    };
  }
};
```

## 2. Versioning and release notes

Use semantic versions:

- Patch: bug fixes, docs, and compatibility fixes.
- Minor: new options, new providers, new demos, and backward-compatible APIs.
- Major: renamed public APIs, removed options, changed default behavior, or paid-license changes.

Every release should include:

- `CHANGELOG.md` entry.
- Tested OmniCore version range.
- Install command.
- Screenshot or short demo recording.
- Known platform limits.

## 3. Package the plugin

Recommended packaging commands:

```bash
npm pack
```

or, for plugins with a build step:

```bash
npm run build:addon
npm pack
```

The packed artifact should contain only runtime code, manifest, README, license, and demo assets. Exclude local test output, editor temp files, secrets, and private account data.

## 4. Submit to the OmniCore plugin marketplace

Submit through either path:

- GitHub Issue: use `.github/ISSUE_TEMPLATE/plugin_submission.yml`.
- Web 表单: use the marketplace submission form when the hosted marketplace is enabled.

Submission checklist:

- npm package name or Git URL.
- `plugin.json` manifest.
- README and demo URL.
- Three screenshots or one short video.
- Pricing model when `isPaid` is true.
- Security notes for network, storage, payment, or ad SDK permissions.

The review checks manifest validity, package size, demo availability, malicious install scripts, and whether the plugin can uninstall cleanly.

## 5. Paid plugins and revenue split

Recommended marketplace splits:

- `80/20`: developer keeps 80%, OmniCore keeps 20% for marketplace hosting, review, and distribution.
- `70/30`: developer keeps 70%, OmniCore keeps 30% when the marketplace provides extra services such as encrypted delivery, invoicing, or promotion.

Paid plugin metadata should include:

```json
{
  "isPaid": true,
  "priceCents": 1900,
  "currency": "USD",
  "revenueSplit": "80/20"
}
```

Developers remain responsible for tax, support, refunds, third-party SDK terms, and any platform-specific compliance requirements.

## 6. Listing quality bar

A plugin is ready for official listing when:

- It installs with one command.
- It has a runnable demo.
- It has at least one automated smoke test or verification script.
- It includes screenshots that show the actual plugin behavior.
- It documents configuration, platform support, permissions, and uninstall behavior.
