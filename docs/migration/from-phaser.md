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

## 20 个常用 API 对照表

这张表面向 Phaser 旧用户的一站式迁移，优先列出最常见的 Scene、Sprite、输入、物理、相机和 Tilemap 调用。实际项目可以先按表迁移入口和主角控制，再处理插件、粒子、后处理等高差异模块。

| Phaser 3 写法 | OmniCore 写法 | 迁移提示 |
| --- | --- | --- |
| `this.scene.start(key)` | `OmniCore.SceneManager.push(key)` | 进入新场景时先注册同名 OmniCore Scene。 |
| `this.scene.stop(key)` | `game.scene.pop(key)` | 适合关闭当前覆盖层或返回上一个关卡。 |
| `this.scene.restart()` | `game.scene.replace(currentKey)` | 保留资源缓存，只重建场景状态。 |
| `this.add.sprite(x, y, key)` | `OmniCore.Entity.create('sprite', options)` | 用实体承载 Sprite、动画和碰撞组件。 |
| `this.add.image(x, y, key)` | `new Sprite(key, options)` | 静态图片可以直接挂到场景。 |
| `this.add.text(x, y, text)` | `OmniCore.UIElement.create('text', options)` | HUD 文本建议放在 UI 层。 |
| `this.tweens.add(config)` | `new OmniCore.Tween(target, config)` | 补间目标和 duration、repeat、yoyo 可直接对齐。 |
| `this.time.delayedCall(ms, fn)` | `scene.timer.delay(ms, fn)` | 把 Phaser Timer 迁到 Scene 计时器。 |
| `this.input.keyboard.on(event, fn)` | `InputManager.keyboard.on(event, fn)` | 输入统一走 InputManager，便于 Web/微信/Electron 复用。 |
| `this.input.on('pointerdown', fn)` | `InputManager.pointer.on('down', fn)` | 鼠标和触控事件统一成 pointer。 |
| `this.load.image(key, url)` | `Loader.loadBundle({ images })` | 资源集中进入 bundle，方便构建产物检查。 |
| `this.load.atlas(key, png, json)` | `AssetLoader.loadBundle({ atlases })` | 图集资源建议保留 key 命名。 |
| `this.anims.create(config)` | `new OmniCore.Animation(config)` | 先迁移帧序列，再迁移动画事件。 |
| `sprite.play(key)` | `animation.play(key)` | 复杂状态机可拆到组件内。 |
| `this.physics.add.sprite(x, y, key)` | `loadPhysics() + world.addBody(entity)` | 先等待物理适配器加载完成，再创建刚体。 |
| `this.physics.add.collider(a, b, fn)` | `PhysicsWorld.addCollider(a, b, fn)` | 回调参数需要按 OmniCore 物理后端适配。 |
| `this.physics.add.overlap(a, b, fn)` | `PhysicsWorld.addOverlap(a, b, fn)` | 触发器逻辑建议单独写测试。 |
| `this.cameras.main.startFollow(target)` | `game.camera.follow(target)` | 相机跟随可保留 deadzone 和 lerp 参数。 |
| `this.cameras.main.shake(ms, intensity)` | `game.camera.shake({ duration, intensity })` | 把位置参数换成对象配置。 |
| `this.make.tilemap(config)` | `new OmniCore.Tilemap(config)` | 先验证 tileset 路径和碰撞层。 |
| `map.createLayer(name, tileset)` | `tilemap.createLayer(name, tileset)` | 图层命名保持一致，便于编辑器回读。 |
| `this.registry.set(key, value)` | `game.store.set(key, value)` | 全局状态迁到 OmniCore store。 |
| `this.events.emit(name, data)` | `game.events.emit(name, data)` | 跨系统事件建议统一命名空间。 |
| `this.plugins.install(key)` | `OmniCore.install(addon)` | 插件需要声明 manifest 和生命周期。 |

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
