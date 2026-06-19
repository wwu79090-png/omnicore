# Steam/Itch.io 发布教程

本教程假设项目已经能执行 `npm run build`，并且输出目录为 `dist/`。发布前先在编辑器 Build Settings 中勾选目标平台，确认图标尺寸、压缩策略和配置生成策略。

## 通用准备

1. 安装依赖：`npm install`
2. 构建 Web 产物：`npm run build`
3. 构建 Electron 桌面包：`npm --prefix packages/omnicore-editor run package`
4. 检查输出目录：`dist/`、`packages/omnicore-editor/dist/`
5. 记录版本号、更新说明和隐私/许可文本。

## Steam Windows

1. 在 Steamworks 创建应用并安装 SteamPipe SDK。
2. 创建本地 depot 目录：`dist/publish/steam/windows`
3. 复制 Windows 桌面包到 depot：`Copy-Item packages/omnicore-editor/dist/omnicore-editor-win32 -Destination dist/publish/steam/windows -Recurse`
4. 添加 `steam_appid.txt` 到可执行文件同级目录。
5. 使用 SteamPipe 上传：`builder\steamcmd.exe +login <user> +run_app_build_http ..\scripts\app_build.vdf +quit`
6. 在 Steamworks 后台为 Windows depot 绑定默认分支并执行安装烟测。

## Steam Linux

1. 在 Linux 或 WSL 环境准备 Linux 桌面包：`npm --prefix packages/omnicore-editor run package -- --linux`
2. 创建 depot 目录：`mkdir -p dist/publish/steam/linux`
3. 复制 AppImage 或 unpacked 目录到 depot。
4. 确认启动脚本带执行权限：`chmod +x dist/publish/steam/linux/*.AppImage`
5. 使用 SteamPipe 上传 Linux depot。
6. 在 Steam Deck 或 Linux 桌面环境验证启动、存档目录和手柄/键鼠输入。

## Itch.io Windows

1. 安装 Butler：`https://itch.io/docs/butler/`
2. 登录：`butler login`
3. 创建 Windows 包目录：`dist/publish/itch/windows`
4. 复制 Windows 可执行应用和 `README.txt`、`LICENSE`。
5. 上传：`butler push dist/publish/itch/windows <account>/<game>:windows`
6. 在 Itch.io 页面设置价格、标签、截图和最小系统要求。

## Itch.io Linux

1. 创建 Linux 包目录：`dist/publish/itch/linux`
2. 复制 AppImage：`cp packages/omnicore-editor/dist/*.AppImage dist/publish/itch/linux/`
3. 设置权限：`chmod +x dist/publish/itch/linux/*.AppImage`
4. 上传：`butler push dist/publish/itch/linux <account>/<game>:linux`
5. 下载通道包并在干净 Linux 用户目录执行启动测试。

## 移动 WebView 壳

1. 构建 Web：`npm run build`
2. 生成壳工程：`npm run build:mobile -- --app-name OmniDemo --bundle-id dev.omnicore.demo --web-dist dist`
3. iOS 输出：`dist/mobile/ios/OmniDemo`
4. Android 输出：`dist/mobile/android`
5. 将 `dist/index.html` 和资源复制到 iOS bundle 的 `dist/` 子目录，以及 Android `app/src/main/assets/`。
6. 在 Xcode 和 Android Studio 中分别打开项目，设置签名后构建真机包。
