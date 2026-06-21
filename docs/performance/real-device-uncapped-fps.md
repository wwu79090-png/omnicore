# Uncapped FPS Evidence

Generated: 2026-06-21T13:04:43.070Z

OmniCore does not apply an engine-level FPS cap by default. A sample passes when measured FPS reaches at least 90% of a display refresh rate above 60Hz.

| Device | Browser | Display Hz | FPS | P95 frame ms | Sprites | Draw calls | Result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Local verification device | Chromium | 144 | 141 | 8 | 1000 | 3 | pass |

## Capture Checklist

- Run npm run performance:uncapped-evidence on the target device.
- Record display refresh rate, browser version, FPS, p95 frame time, sprite count, and draw calls.
- Attach a screenshot or screen recording to the GitHub release when available.
