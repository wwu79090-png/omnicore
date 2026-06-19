# OmniCore Web 2D 引擎候选 90 分强化清单

OmniCore 的 Web 2D 定位不再只和渲染能力绑定，而是把 Phaser 迁移、Pixi 上层框架、低代码编辑器、微信小游戏发布、插件安全和持续验证一起纳入 `marketPositioningScorecard`。目标是让外部团队在评估 Web 2D 引擎候选时能看到可执行证据，而不是只看到功能列表。

## 四个 90 分目标

| 目标 | 现在的落地点 | 验证证据 |
| --- | --- | --- |
| Web 2D 引擎候选 | Scene、WebGPU、PixiRenderer、质量门禁、微信小游戏构建 | `benchmark:ci`、`quality:gate`、`build:wechat` |
| Phaser 迁移 | `createPhaserCompatScene`、迁移分析规则、迁移站点和 30 分钟试用文档 | `tests/phaser-compat-layer.test.js`、`omni-migrate` |
| Pixi 上层游戏框架 | `PixiFrameworkBridge`、纹理生命周期、滤镜映射、渲染层管理 | `tests/pixi-framework-layer.test.js`、`quality:engine` |
| 低代码编辑器 | dock 工作台、工程保存、撤销重做、自动恢复、EventSheet、UI、数据表和行为树导出 | `tests/editor-market-readiness.test.js` |

## 对 Construct / Cocos / Godot 的补强方向

Construct 的优势是事件表和快速发布，OmniCore 用 EventSheet、VisualEventGraph、低代码导出和 `quality:gate` 对齐。Cocos 和 Godot 的优势是编辑器成熟度与项目结构，OmniCore 用桌面编辑器、项目保存、自动恢复、authoring bundle、平台预算和 doctor 报告补齐生产闭环。

## 对 Phaser 的迁移吸引力

Phaser 项目可以先走兼容层：`preload/create/update`、`this.load.image`、`this.add.sprite`、Arcade physics、keyboard input 和 tweens 都能被识别或暂时承接。迁移报告会标出低风险和中风险项，让团队按 Scene、AssetLoader、InputManager、Tween / Timeline 分批替换。

## 对 Pixi 的上层框架价值

Pixi 用户通常缺的是游戏工程层，不是渲染器。OmniCore 保留 PixiRenderer，同时提供 Pixi display object 挂载、texture lifecycle、filter preset、Loop 接管和清理报告，让 Pixi 项目能逐步迁移到完整 Web 2D 游戏框架。

## 发布与安全证据

评分进入生产报告和 doctor：`marketPositioningScorecard` 低于 90 会阻塞 ready 状态。插件安全、依赖检查、API 合同、benchmark:ci、quality:gate、微信小游戏包体预算和构建报告共同作为候选引擎的验收证据。
