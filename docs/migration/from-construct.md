# 从 Construct 迁移到 OmniCore

目标读者：使用 Construct 3 / GDevelop 风格事件表制作 2D 游戏，想转向更可编程、可测试、可发布自动化的 JS 工作流。

## 迁移结论

Construct 用户不应该先迁移编辑器界面，而应该先迁移事件逻辑。OmniCore 的 JSON Event Sheet 和 VisualEventGraph 可以承接一部分事件表思维，同时允许复杂逻辑回到 JavaScript、测试和版本控制。

## 概念对照

| Construct 概念 | OmniCore 对应 | 风险等级 | 说明 |
| --- | --- | --- | --- |
| Event Sheet | JSON Event Sheet | low | 条件和动作可以落到可提交的 JSON。 |
| Event Sheet 可视化 | VisualEventGraph | medium | 适合查看和导出，不等于完整 Construct 编辑器。 |
| Behavior | addon/component | medium | 需要把行为拆成显式模块。 |
| Object Type | Sprite / Entity / Prefab | medium | 需要整理 ID、资源名和属性覆盖。 |
| Family | tag / component query | medium | 推荐用组件和标签表达对象集合。 |
| Export | OmniCore build scripts | low | Web、微信小游戏、桌面编辑器链路更偏工程化。 |

## JSON Event Sheet 示例

```json
{
  "events": [
    {
      "conditions": [
        { "op": "keyDown", "key": "ArrowRight" }
      ],
      "actions": [
        { "op": "moveBy", "target": "player", "x": 2, "y": 0 }
      ]
    }
  ]
}
```

## 迁移步骤

1. 先选择一个房间或关卡，把事件表导出成独立清单。
2. 将触发条件整理为 `conditions`，将移动、动画、音频、切场景整理为 `actions`。
3. 用 VisualEventGraph 检查事件树是否和原逻辑一致。
4. 把对象属性迁移到 Prefab 或 `config/data.json`。
5. 为关键规则补 Vitest 测试，至少覆盖输入、碰撞、胜负条件和存档。

## 自动分析报告

把 Construct 导出的事件表 JSON 放进可扫描目录后运行：

```bash
npx omni-migrate --root ./construct-export --dry-run
```

迁移工具会识别 `eventSheets`、`conditions` 和 `actions`，并给出 `JSON Event Sheet + VisualEventGraph` 的 OmniCore 目标建议。dry-run 只输出报告，不会覆盖 Construct 导出的源文件。CI 或批处理需要 JSON 时使用：

```bash
npx omni-migrate --root ./construct-export --json
```

## 风险等级说明

- low：可以直接映射，通常一天内能验证。
- medium：需要拆分逻辑或重做编辑器数据结构。
- high：Construct 插件、第三方行为或平台导出特性没有 OmniCore 等价能力。

如果项目主要靠 Construct 可视化生产，并且团队完全不写代码，建议先保留 Construct。OmniCore 更适合愿意把核心逻辑纳入 JS、测试和 CI 的团队。
