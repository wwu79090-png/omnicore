# Mobile and WeChat Evidence

每次移动端或微信小游戏发布前，都要留下可以复查的最小证据。

## iOS WebView

- 构建 iOS shell 后复制 `dist/index.html` 与资源目录到应用包。
- 用 Safari Web Inspector 检查 console error/warn、资源 404、未处理 Promise 和音频解码失败。
- 记录首次场景渲染截图、触摸输入、音频解锁、FPS。

## Android WebView

- 构建 Android shell 后复制网页产物到 `app/src/main/assets`。
- 用 logcat 检查 console error/warn、资源 404、WebView 崩溃和音频 decode 失败。
- 记录 `file:///android_asset/index.html` 首屏、触摸输入、FPS。

## WeChat DevTools

- 先运行 `npm run build:wechat`。
- 上传前确认包体低于 4MB，超过即失败。
- 在 WeChat DevTools 中记录 FPS、内存、首屏渲染、触摸输入、音频兜底、资源 404 和基础分包状态。

## Evidence File

`npm run build:mobile` 会生成 `dist/mobile/mobile-wechat-smoke-evidence.md`，可以随发布记录一起提交到 release note。
