# 从 Cocos Creator 迁移到 OmniCore

目标读者：使用 Cocos Creator 做 2D、小游戏或轻量 2.5D 项目，想评估更轻的 Web/JS 优先引擎。

## 迁移结论

OmniCore 不是 Cocos Creator 的完整替代。它适合小团队、Web 首发、微信小游戏验证、插件化工具链和轻量编辑器工作流。Cocos 的完整 2D/3D 编辑器、原生平台和成熟资产流程仍然更强。

## 概念对照

| Cocos 概念 | OmniCore 对应 | 风险等级 | 说明 |
| --- | --- | --- | --- |
| Cocos Component | `addComponent()` / addon | medium | 生命周期要按 OmniCore Scene 和 Entity 重写。 |
| Node 树 | Node / Scene / Entity | low | 层级能迁移，编辑器交互要重新整理。 |
| Prefab | Prefab / PrefabRegistry | medium | 属性覆盖可迁移，复杂嵌套要拆分测试。 |
| Animation | Timeline / Animation / Spine adapter | medium | 简单帧动画可迁移，复杂编辑器曲线需验证。 |
| 物理系统 | PhysicsWorld + backend adapter | medium | Matter / Rapier / Box2D wasm 后端按需接入。 |
| 平台发布 | build scripts / export:platform | medium | Web 和小游戏优先，原生平台不与 Cocos 等价。 |

## 组件迁移示例

```js
class HealthComponent {
  mount(entity) {
    this.entity = entity;
    this.hp = entity.props.hp ?? 100;
  }

  damage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.entity.props.hp = this.hp;
  }
}

const hero = scene.add(new OmniCore.Sprite('hero', { x: 80, y: 160, hp: 100 }));
hero.addComponent('health', new HealthComponent());
```

## 平台发布建议

1. Web 项目先走 `npm run build`。
2. 微信小游戏先走 `npm run build:wechat` 和 `npm run test:wechat`。
3. 桌面编辑器或工具流走 `npm run editor` 和 editor package 脚本。
4. Steam / Itch.io 发布参考 `docs/publishing/steam-itch.md`。

## 自动分析报告

在 Cocos Creator 脚本和导出的 prefab 目录上先跑 dry-run：

```bash
npx omni-migrate --root ./assets --dry-run
```

工具会识别 `extends Component`、`@ccclass`、`Prefab`、`@property(Prefab)` 和 `instantiate()` 等线索。Cocos Component 和 Prefab 默认按 medium risk 输出，因为生命周期、属性覆盖和嵌套 prefab 行为需要在 OmniCore 组件和 PrefabRegistry 中重新验证。

需要 JSON 报告给 CI 或迁移看板时：

```bash
npx omni-migrate --root ./assets --json
```

## 不建议迁移的情况

- 依赖 Cocos 原生平台、复杂 3D、XR 或原生插件。
- 项目已经使用 Cocos 编辑器做深度动画、UI 和场景资产生产。
- 团队需要成熟商用生态和长期 LTS 支持。

这类项目可以继续使用 Cocos，把 OmniCore 用作 Web 活动页、小游戏原型、可嵌入工具或新项目验证。
