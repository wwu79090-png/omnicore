# 迁移基础工具已彻底封版

本次封版覆盖 Phaser/旧项目迁移阶段最常用的 6 个基础工具：

| 状态 | API | 验收点 |
| --- | --- | --- |
| pass | `OmniCore.Debug.Grid()` | `debug: true` 时生成可绘制网格线，`debug: false` 时不叠加。 |
| pass | `OmniCore.Color.from('#hex')` | 支持 `#rgb`、`#rgba`、`#rrggbb`、`#rrggbbaa`。 |
| pass | `OmniCore.Data.safeParse(json)` | JSON 解析失败时返回 `null` 或调用方传入的 fallback。 |
| pass | `OmniCore.Math.distance()` | 支持点对象和数字坐标两种调用方式。 |
| pass | `OmniCore.Math.isInRadius()` | 基于 `distance()` 判断半径命中。 |
| pass | `OmniCore.Net.fetchWithTimeout(url, ms)` | 请求超时后触发 `AbortController` 并抛出 `TimeoutError`。 |
| pass | `OmniCore.Tween#isPlaying` / `pause()` / `resume()` | 补齐播放状态查询、暂停和恢复控制。 |

封版验收测试：`tests/migration-foundation-tools.test.js`。
