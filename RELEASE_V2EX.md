标题：
发布 OmniCore v1.0.0：一个面向 Web 2D 游戏、编辑器和插件生态的开源游戏引擎

正文：
大家好，我发布了 OmniCore v1.0.0。

OmniCore 是一个 2D-first 的 JavaScript/Web 游戏引擎，重点不是做重型 3D，而是把浏览器 2D 游戏开发里常见的运行时、编辑器、插件、资源流水线和发布验证串起来。

核心能力：

- PixiJS v8 渲染封装，支持 Canvas fallback。
- Phaser 风格 Scene 栈、Loop、Camera、Tween、Input、Loader。
- Construct/GDevelop 风格 JSON Event Sheet 和可视化事件图。
- Cocos 风格组件挂载、Prefab、Node 树和数据表。
- 插件安装协议、编辑器面板、在线 Playground、迁移工具。
- WebGPU、Worker、性能预算、依赖取证、Deprecated API 审计。

v1.0.0 发布验证数据：

- 测试：521/521 通过。
- 构建：已生成 dist/omnicore.esm.js。
- ESM 产物：654.11 kB。
- Lean Core ESM：33.36 kB。
- 高风险依赖：0。
- Deprecated API：0。

NPM：
https://www.npmjs.com/package/omnicore

官网：
https://omnicore.vercel.app/

如果你做过 Web 游戏、小游戏、低代码编辑器、插件市场或者游戏工具链，希望能帮忙看看 API、包体、文档和工程化方向是否合理。也欢迎提交 Issue 或直接反馈复现工程。

作者：杀戮 (Shalu)
QQ：3424636983
微信：lookkiitylou

发帖入口：
https://www.v2ex.com/new
