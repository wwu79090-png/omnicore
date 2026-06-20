# OmniCore 数据隐私与遥测声明

OmniCore 默认不收集任何数据，不会在开发者电脑或玩家设备上自动上传遥测、日志、报错、项目内容、源代码、资源文件或个人信息。

## 默认行为

- 默认不收集任何数据。
- 默认不访问网络遥测端点。
- 默认不上传崩溃日志。
- 默认不读取项目外文件。

## 开发者主动开启时

只有开发者显式配置 `telemetry: true` 或 `telemetry: { anonymous: true }` 时，OmniCore 才会生成匿名聚合摘要。该摘要默认只保存在运行时内存中，由开发者自己决定是否导出或上传。

会收集的字段：

- 版本号：`engineVersion`。
- 报错类型：例如 `TypeError`、`Error`。
- 常见 API 使用频率：例如 `Store.set`、`EventBus.emit`、`Renderer.renderScene` 的调用次数。
- 样本数量：本地聚合计数，不包含用户身份。

不会收集的字段：

- 玩家姓名、账号、IP、设备唯一标识。
- 游戏源代码、项目资源、地图数据、商业配置。
- 原始错误堆栈和业务数据载荷。

## 数据存储位置

匿名遥测摘要默认存储在内存中的 `TelemetryCollector` 实例里。OmniCore 不内置远程上传；如果团队需要上传，必须在自己的应用代码中显式读取摘要并发送到自有端点。

## 如何关闭

不要传入 `telemetry: true`，或者显式设置：

```js
const game = await new OmniCore.Game({
  telemetry: false
}).init();
```

已经创建的实例可以销毁并重新以 `telemetry: false` 启动。企业团队也可以在代码审计中搜索 `telemetry: true` 和 `telemetry: { anonymous: true }` 来确认是否启用。
