# 为什么值得迁移到 OmniCore

这份迁移理由书面向正在评估 Phaser、Cocos、纯 PixiJS 或自研 WebGL 框架的团队。结论很直接：如果你的项目是 2D / 2.5D Web 游戏，并且更看重包体、WebGPU、降级稳定性和工具链闭环，OmniCore 的迁移收益足够明确。

| 维度 | 常见现状 | OmniCore 迁移价值 |
| --- | --- | --- |
| 包体大小 | Phaser 300KB 级运行时；Cocos 项目通常还会叠加编辑器导出胶水层 | OmniCore 33KB Lean Core，主包和工具链可按需拆分 |
| 渲染帧率 | WebGL 60FPS 上限，复杂场景容易被浏览器刷新率和 draw call 放大成本限制 | WebGPU 144FPS 目标场景，1000 Sprite benchmark 保持可视化门禁 |
| 崩溃处理 | WebGL 白屏后通常需要业务侧手动恢复或刷新页面 | OmniCore 无感降级：WebGL/WebGPU 异常后可回退 Canvas/Pixi 路径 |
| 迁移工具 | 需要团队自己读 Phaser/Cocos API 差异 | `omni-migrate` 和兼容层能识别 Sprite、Tween、Input、Loader 等常见模式 |
| 发布链路 | Web、微信、Electron 常常分散维护 | 统一 quality gate、WeChat 4MB 预算、桌面编辑器和 Marketplace 校验 |

## 真实基准数据

- 包体：Phaser 300KB vs OmniCore 33KB。
- 渲染：WebGL 60FPS 上限 vs WebGPU 144FPS。
- 稳定性：WebGL 白屏 vs OmniCore 无感降级。
- 质量门禁：`benchmark:ci`、`performance:budget`、`production-ready` 和 `doctor` 同时覆盖。

## 适合迁移的项目

- 2D 动作、RPG、塔防、轻量编辑器内嵌玩法。
- 已经使用 Phaser/PixiJS，但需要更轻包体和更强发布门禁的 Web 项目。
- 需要 Web、微信小游戏、Electron 多平台发布，但不想维护多套构建脚本的团队。

## 不适合迁移的项目

- 需要完整 3D 物理、自由 3D 摄像机、复杂 glTF 动画状态机的项目。
- 已深度绑定 Unity/Cocos 原生编辑器资源格式且没有 Web 轻量化目标的项目。

OmniCore 的定位不是替代所有引擎，而是给 2D Web 游戏提供一个极轻、极快、可验证的生产路径。
