# 从 Phaser 迁移到 OmniCore

目标读者：已经用 Phaser 做 HTML5 2D 游戏，想评估 OmniCore 是否能提供更完整的工程、编辑器和发布链。

## 迁移结论

如果项目核心是 Phaser Scene、Sprite、Tween、输入、Tilemap 和轻量物理，OmniCore 可以逐步迁移。不要一次性重写整款游戏；先迁移一个可运行关卡，验证资源加载、输入、碰撞和构建产物。

## API 对照

| Phaser 概念 | OmniCore 对应 | 风险等级 | 说明 |
| --- | --- | --- | --- |
| Phaser Scene | OmniCore Scene | low | `create()` 和 `update(delta)` 的生命周期相近。 |
| `this.add.sprite()` | `scene.add(new Sprite())` | low | OmniCore Sprite 更薄，复杂动画要接 Animation 或 Spine adapter。 |
| Phaser Tween | OmniCore Tween | low | 适合位置、缩放、透明度等普通补间。 |
| Arcade Physics | `loadPhysics()` + PhysicsWorld | medium | OmniCore 物理是延迟适配器，不默认内置完整 Arcade Physics 行为。 |
| Tilemap | Tilemap + ChunkManager | medium | 大地图可迁移，编辑器资产流程需要按 OmniCore 模板整理。 |
| Phaser Plugins | OmniCore addon/plugin | medium | 插件生命周期不同，需要显式 `useAddon()` 或 `OmniCore.use()`。 |

## 推荐步骤

1. 用 `create-omnicore-app` 创建 platformer 模板。
2. 把 Phaser Scene 拆成一个 OmniCore Scene，先保留原始资源路径。
3. 用 OmniCore InputManager 重写方向键、触控和按钮输入。
4. 把 Arcade Physics 调用替换为 `loadPhysics()` 后端适配。
5. 跑 `npm test` 和 `npm run build`，确认没有 console error/warn 和资源 404。

## 自动分析报告

先用 dry-run 模式扫描项目，不会改动 Phaser 源文件：

```bash
npx omni-migrate --root ./src --dry-run
```

报告会识别 `Phaser.Scene` 的 `preload/create/update` 生命周期，并标出 `this.physics.add.*`、Arcade Physics 配置和 collider 调用。生命周期通常是 low risk，可直接迁移到 OmniCore Scene；Arcade Physics 是 medium risk，需要为速度、重力、碰撞回调和 tilemap 碰撞补定向测试。

需要机器可读结果时：

```bash
npx omni-migrate --root ./src --json
```

## 最小迁移示例

```js
import OmniCore, { Scene, Sprite, Tween, loadPhysics } from 'omnicore';

class LevelOne extends Scene {
  async create() {
    this.physics = await loadPhysics({ backend: 'matter' });
    this.player = this.add(new Sprite('hero', { x: 80, y: 160 }));
    this.bob = new Tween(this.player, {
      y: { from: 160, to: 148 },
      duration: 500,
      yoyo: true,
      repeat: Infinity
    });
  }

  update(delta) {
    if (this.input.keyboard.isDown('ArrowLeft')) this.player.x -= 2;
    if (this.input.keyboard.isDown('ArrowRight')) this.player.x += 2;
    this.bob.update(delta * 1000);
  }
}

const game = await new OmniCore.Game({ parent: '#app', renderer: 'pixi' }).init();
game.scene.register(new LevelOne('level-one'));
game.scene.push('level-one');
```

## 不建议迁移的情况

- 项目强依赖 Phaser 特定插件且没有源码。
- 项目使用大量 Phaser Arcade Physics 细节行为。
- 项目已经稳定上线，只需要维护少量 bug。

这类项目可以保留 Phaser，只把新项目或独立小游戏实验迁移到 OmniCore。
