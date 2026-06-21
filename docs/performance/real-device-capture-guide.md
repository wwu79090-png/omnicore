# Real Device Capture Guide

Use this guide when turning OmniCore performance claims into release evidence. The goal is to attach concrete device, browser, refresh-rate, FPS, frame-time, draw-call, and console-status data instead of relying on a desktop-only screenshot.

## 144Hz Desktop Capture

1. Use a 120Hz or 144Hz monitor and Chrome or Edge.
2. Run `npm run dev`.
3. Open `tests/benchmark/benchmark.html` or `examples/performance-hot-paths-demo/`.
4. Record display refresh rate, browser version, `fps`, p95 frame time, sprite count, and draw calls.
5. Run `npm run performance:uncapped-evidence` with environment overrides if needed:

```bash
set OMNICORE_DEVICE_NAME=Windows 144Hz
set OMNICORE_DISPLAY_HZ=144
set OMNICORE_UNCAPPED_FPS=141
npm run performance:uncapped-evidence
```

## Android 120Hz Capture

1. Use Chrome or Android WebView on a 90Hz/120Hz/144Hz Android device.
2. Serve the repo through `npm run dev` on the same LAN.
3. Open `website/playground/`, `examples/market-showcase/`, and `examples/official-templates/arcade-survivor/`.
4. Capture console error/warn status through remote debugging.
5. Save a 15-30 second screen recording showing FPS and input response.

## iOS Safari Capture

1. Open the Vite LAN URL in iOS Safari.
2. Verify startup, touch input, audio unlock, and Canvas fallback.
3. Record browser version, device model, and visible frame pacing.

## WeChat Capture

1. Run `npm run build:wechat`.
2. Confirm package size remains under the 4MB red line.
3. Load the output through the WeChat developer tool or target WebView.
4. Verify asset loading, audio fallback, input focus guard, and no startup white screen.

## WebGPU Capture

Run:

```bash
npm run webgpu:evidence -- --includeHotPaths true --out docs/release-notes/webgpu-hot-path-evidence.json
```

Attach the JSON report with a browser/GPU screenshot when `navigator.gpu` is available. If WebGPU is unavailable, record the fallback renderer path.
