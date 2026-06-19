# Benchmark 趋势历史说明

`scripts/benchmark-threshold.js` 现在同时执行两类检查：

- 单点回归：当前 benchmark 与 baseline 的直接比较。
- 历史趋势回归：当前 benchmark 与 baseline 内 `history`、`benchmarkHistory` 或 `trendHistory` 的历史样本中位数比较。

历史样本可以使用完整 benchmark 输出，也可以只保留 `summary` 字段。旧 baseline 不需要新增字段；没有历史样本时，脚本会保留原有单点比较并在报告里标注“未提供历史样本”。

## 支持的趋势指标

趋势比较复用单点 gate 的指标方向与阈值，重点覆盖长期市场对标时最容易退化的类别：

- FPS 下滑：例如 `particles1000AvgFps`、`canvas1000SpriteFps`、`pixi1000SpriteFps`、`complexScene1200Fps`。
- Draw Calls 上涨：例如 `particles1000DrawCalls`、`canvasDrawCalls`、`pixiDrawCalls`、`complexScene1200DrawCalls`。
- 耗时上涨：例如 `entitySync500AvgMs`、`backendSwitchAvgMs`、`complexScene1200PhysicsMs`、`complexScene1200FrameMs`。
- 内存上涨：`memoryPeakMb`，也兼容 `peakMemoryMb` 和 `memoryMb`。

## 历史样本示例

```json
{
  "summary": {
    "complexScene1200Fps": 144,
    "complexScene1200DrawCalls": 4,
    "complexScene1200PhysicsMs": 0.2,
    "complexScene1200FrameMs": 6.9,
    "memoryPeakMb": 91
  },
  "history": [
    {
      "generatedAt": "2026-06-17T00:00:00.000Z",
      "summary": {
        "complexScene1200Fps": 144,
        "complexScene1200DrawCalls": 4,
        "complexScene1200PhysicsMs": 0.2,
        "complexScene1200FrameMs": 6.9,
        "memoryPeakMb": 90
      }
    },
    {
      "generatedAt": "2026-06-18T00:00:00.000Z",
      "summary": {
        "complexScene1200Fps": 142,
        "complexScene1200DrawCalls": 4,
        "complexScene1200PhysicsMs": 0.21,
        "complexScene1200FrameMs": 7,
        "memoryPeakMb": 92
      }
    }
  ]
}
```

报告中的“历史趋势回归”会列出历史中位数、当前值、回归比例和建议排查方向。建议文本用于把回归直接指向 renderer batching、physics 查询、frame budget 或内存生命周期等可行动区域。
