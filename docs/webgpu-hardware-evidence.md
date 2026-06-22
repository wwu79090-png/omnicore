# WebGPU Hardware Evidence

OmniCore 的 WebGPU 层提供三类可验证描述符：

- `createWebGPUTextureAtlasDescriptor()`：声明纹理数组、采样器、bind group layout 和图集 uniform 布局。
- `createWebGPUShaderVariantRegistry()`：登记 instanced sprite、textured sprite、HD-2D filter 和 compute particle 管线变体。
- `createWebGPUHardwareEvidencePayload()`：生成可提交到 issue、release note 或 benchmark 报告的硬件验证 JSON。

采集命令：

```bash
npm run webgpu:evidence -- --out dist/webgpu-hardware-evidence.json --device "RTX 4060 Laptop" --browser "Chrome"
```

需要人工补充的证据：

- 目标设备型号和浏览器版本。
- FPS、frame time、sprite 数、draw call 数。
- DevTools console 是否存在 error/warn。
- 如果 `navigator.gpu` 不可用，记录 Pixi/WebGL fallback 是否正常。
