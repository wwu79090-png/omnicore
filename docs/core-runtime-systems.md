# OmniCore 核心运行时系统

本文档覆盖 `Task`、`Query`、`Store.derive` 和 `Input.bind` 四个核心层模块。

## 协程任务

`OmniCore.Task` 是基于 Generator 的协程调度器，使用独立 `setTimeout` 微循环，不依赖 `requestAnimationFrame`。

```js
OmniCore.Task.start(function* showThenHide() {
  yield OmniCore.Task.wait(2000);
  button.visible = true;
  yield OmniCore.Task.wait(1000);
  button.visible = false;
});
```

高级场景可直接实例化：

```js
const tasks = new OmniCore.TaskManager();
const handle = tasks.start(function* job() {
  yield tasks.wait(100);
});
handle.cancel();
```

## 空间查询

`OmniCore.Query` 内置一个 32x32 网格空间索引。实体调用 `add()` 后，普通可配置 `x/y` 属性会自动安装访问器，移动时立即更新所属格子。

```js
const enemy = OmniCore.Query.add({ id: 'enemy-1', kind: 'enemy', x: 64, y: 32 });
enemy.x = 96;

const nearbyEnemies = OmniCore.Query.inRadius(player.x, player.y, 5 * 32, (entity) => (
  entity.kind === 'enemy'
));
```

需要独立索引时：

```js
const index = new OmniCore.EntitySpatialIndex({ cellSize: 32 });
index.add(enemy);
index.inRadius(96, 32, 64);
```

## 派生状态

`Store.derive(name, deps, computeFn)` 会建立依赖图。依赖 key 变化后，派生值在同一个微任务批次内重算，避免手动维护同步逻辑。

```js
const store = new OmniCore.Store({ hp: 75, max_hp: 100 });

store.derive('hp_percent', ['hp', 'max_hp'], ({ hp, max_hp: maxHp }) => (
  maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0
));

store.set('hp', 50);
await Promise.resolve();
console.log(store.get('hp_percent')); // 50
```

`derive()` 返回 dispose 函数：

```js
const dispose = store.derive('alive', ['hp'], ({ hp }) => hp > 0);
dispose();
```

## 输入动作

`InputManager.bind(action, keys)` 将原始键盘组合映射成动作事件。匹配后只在 EventBus 上派发 `action:xxx`，不转发原始 `keydown`。

```js
const input = new OmniCore.InputManager({ target: canvas, events: game.events });

input.bind('command', 'Ctrl+K');
input.bind('move:left', ['A', 'ArrowLeft']);

game.events.on('action:command', ({ combo }) => {
  console.log(combo); // Ctrl+K
});
```

## 集成示例

完整示例见 `examples/core-runtime-systems-demo.js`，包含：

- 2 秒后显示按钮，再过 1 秒隐藏。
- 1000 个敌人加入空间索引，每帧查询玩家周围 5 格敌人。
- `hp_percent` 根据 `hp/max_hp` 自动同步。
- WASD 和方向键映射为移动动作。

## 基准

运行空间索引基准：

```bash
node scripts/benchmark-core-systems.js
```

该脚本使用 1000 个静止实体，比较全遍历和 `EntitySpatialIndex.inRadius()`。通过条件是单次查询候选实体缩减和实际耗时都不少于 50 倍。
