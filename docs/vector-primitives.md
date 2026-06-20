# OmniCore Vector Primitives

OmniCore 的基础图元不再只覆盖矩形、圆和折线。`src/renderer/VectorPrimitives.js` 提供一组可展开的复合图元描述，Canvas、SVG preview、编辑器和后续 Pixi/WebGL 后端可以复用同一份命令列表。

## 复合图元

```js
import {
  createCapsulePrimitive,
  createCodeLayerPrimitive,
  createHousePrimitive,
  createRingPrimitive,
  vectorPrimitiveToSvg
} from 'omnicore';

const house = createHousePrimitive({ x: 16, y: 20, width: 96, height: 80 });
const ring = createRingPrimitive({ x: 180, y: 64, outerRadius: 42, innerRadius: 24 });
const cabin = createCapsulePrimitive({ x: 250, y: 30, width: 116, height: 52, windowCount: 3 });
const code = createCodeLayerPrimitive({
  x: 24,
  y: 140,
  width: 220,
  height: 96,
  alpha: 0.42,
  lines: ['const core = OmniCore;', 'render(house, ring);']
});

const svg = vectorPrimitiveToSvg([house, ring, cabin, code], { width: 480, height: 280 });
```

`createHousePrimitive()` 会展开为屋顶多边形、墙体、门和窗。`createRingPrimitive()` 使用 even-odd 圆环命令。`createCapsulePrimitive()` 用胶囊舱体和圆环舷窗描述机器人舱。`createCodeLayerPrimitive()` 用半透明玻璃面板、扫描线和多行 monospace 文本描述代码层。

## Canvas Renderer

`CanvasRendererAddon` 支持 `drawPrimitive(primitive)`，会把复合图元展开成 Canvas 2D 命令，并把原始 primitive 记录到 `microkernel:drawCommands`，可以重放。

```js
renderer.drawPrimitive(createHousePrimitive({ x: 32, y: 48 }));
renderer.drawPrimitive(createCodeLayerPrimitive({ lines: ['await engine.start();'] }));
```
