# OmniCore Compatibility Matrix

This matrix records the supported browser and WebView surface for OmniCore v1.0.0. Use it as the public support promise and as the checklist before a release.

| Platform | Renderer path | Status | Required verification |
| --- | --- | --- | --- |
| Chrome desktop | PixiJS WebGL, Canvas fallback, optional WebGPU evidence | Supported | `npm run test`, `npm run build`, `npm run performance:hot-paths-gate` |
| Edge desktop | PixiJS WebGL, Canvas fallback | Supported | Open `website/playground/` and `examples/market-showcase/` |
| Firefox desktop | PixiJS WebGL, Canvas fallback | Supported | Open quickstart, verify keyboard input and audio fallback |
| Safari desktop | Canvas fallback, WebGL where available | Supported with fallback | Verify `roundPixels`, font preload, and audio unlock |
| iOS Safari | Canvas fallback, touch input, audio unlock | Supported with limits | Capture startup, input, audio, and 60 FPS behavior |
| Android Chrome | PixiJS WebGL, Canvas fallback | Supported | Capture 120Hz/144Hz FPS evidence where hardware allows |
| Android WebView | PixiJS WebGL, Canvas fallback | Supported with host limits | Verify asset paths, file:// fallback, and global input focus guard |
| WeChat WebView | Canvas/WebGL fallback, package budget guard | Supported with export constraints | Run `npm run build:wechat` and keep package under 4MB |
| file:// local open | Loader fallback path | Supported for basic demos | Verify no white screen when static files are opened directly |

## Release Rule

Any newly promoted public demo must pass Chrome desktop and Android WebView smoke checks. Safari, iOS Safari, and WeChat WebView are compatibility targets with documented fallback behavior when the host blocks advanced APIs.

## Evidence Links

- Real-device FPS guide: `docs/performance/real-device-capture-guide.md`
- Uncapped FPS evidence: `docs/performance/real-device-uncapped-fps.md`
- WebGPU evidence: `docs/performance/webgpu-hot-path-evidence.md`
- Mobile and WeChat evidence: `docs/platforms/mobile-wechat-evidence.md`
