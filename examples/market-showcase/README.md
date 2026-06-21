# OmniCore Market Showcase

这个示例把官网宣传页最难说明的卖点放进一个可运行页面：

- 1000 个 Sprite 的性能云，目标展示 144 FPS。
- 2.5D 城市分层、角色舱体和半透明玻璃结构。
- 保留 HTML/CSS 覆盖层，用于迁移旧项目 UI。
- 不引入新依赖，只使用 OmniCore 核心 API 和 Vite。

```bash
cd examples/market-showcase
npm install
npm run dev
```

## 三行代码

```js
const game = await new OmniCore.Game({ parent: '#game', renderer: 'canvas' }).init();
const scene = Object.assign(new OmniCore.Scene('play'), { create() { this.add(new OmniCore.Sprite('hero', { x: 120, y: 120, width: 48, height: 48, color: '#38bdf8' })); } });
game.scene.register(scene); await game.scene.push('play');
```

这个 demo 适合放进 README、社区帖子和短视频：打开页面后先展示性能云，再点击“2.5D 故事”展示混合 UI 和透明结构。

## 发布取证

正式社区推广前，按 [`docs/public-release-evidence.md`](../../docs/public-release-evidence.md) 的硬件证据清单录制一次真实浏览器视频：

- 1000 Sprite 场景运行至少 15 秒，FPS 计数器可见。
- 2.5D 故事模式展示城市层、透明舱体和 HTML 覆盖层。
- DevTools console 无 error/warn。
- 记录设备、GPU、浏览器版本、系统、刷新率和录制日期。
