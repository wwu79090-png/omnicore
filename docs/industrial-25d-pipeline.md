# OmniCore 工业级 2.5D 管线

这份文档记录 OmniCore 从 Cocos Creator 和 PixiJS 吸收的 2.5D 能力，并说明当前 Web 端可运行 MVP 的边界。

## 对标结论

### Cocos Creator 的核心优势

- 编辑器驱动的场景工作流：节点、资源、动画、材质和预览在同一个生产界面中闭环。
- 2D/3D 资源统一：Spine、DragonBones、模型、材质、贴图、场景资产可以在同一项目中组织。
- Spine 生产链路：`.skel`、`.atlas`、纹理和组件预览能形成稳定导入路径；VertexEffect 类能力适合做 FFD/抖动/局部形变。
- 材质与 shader 体系：通过材质、effect、uniform 参数把视觉表现从业务逻辑中拆开。
- 多平台发布经验：资源导入、压缩、打包和平台适配是完整管线的一部分，而不是 demo 附件。

### PixiJS v8 的核心优势

- Web 原生高性能 2D 渲染，覆盖 WebGL/WebGPU。
- 自定义 Filter/shader 能力清晰，适合 HD-2D、色差、法线光照等屏幕/精灵效果。
- 共享纹理、ParticleContainer、RenderTexture 和 filterArea 优化适合降低 draw call 和 fill-rate。
- 与 Spine/Pixi 运行时生态贴近，适合把 OmniCore 定位为 Pixi 之上的游戏工程层。

## OmniCore 吸收方式

### 1. 编辑器与可视化工作流

`OmniCore.Editor` 新增：

- `create25DPreview()`：输出实时 2.5D 预览协议，包含 Y 轴到 Z 轴映射参考线。
- `drag25DNode()`：统一拖拽 Spine 节点和 Dimension3D 模型代理。
- `generateFakeShadows()`：一键生成椭圆假阴影元数据。

### 2. 着色器与材质渲染

`src/renderer/Filters.js` 新增：

- `createHD2DFilter()`：HD-2D 像素风格 descriptor，覆盖边角模糊、色调分离和动态色差。
- `createNormalLightShader()`：2.5D 法线贴图光照 shader descriptor，覆盖动态漫反射和高光。
- `createSpineFFDVertexShader()`：Spine FFD 顶点 shader descriptor。

`SpineAdapter` 支持 `customVertexShader` 和 `ffd` 元数据，便于 Pixi/Spine 运行时或编辑器后续消费。

### 3. 深度排序与视差摄像机

- `Camera.configureParallax25D()`：配置背景、角色、UI 等层级视差。
- `Camera.getLayerTransform()`：读取单层视差变换。
- `Scene.apply25DSort()`：按脚底 Y 值动态排序，并生成阴影修正数据。
- `Dimension3D.syncViewport2D()`：同步 2D 摄像机、viewport 和 3D 装饰层。

### 4. 高速合批与 LOD

`StaticBatchCompiler` 新增：

- `compileStaticModelInstances()`：把固定位置 3D 装饰模型编译为 InstancedMesh 批处理计划。
- `compileSpineDrawCallGroups()`：按 atlas/material/state 合并 Spine draw call 计划。
- `plan25DLOD()`：按距离关闭 FFD、降低纹理精度或隐藏远端对象。

### 5. 资源管线

`npm run import` 的主入口 `scripts/asset-importer.js` 现在识别：

- `.spine`：输出 `.skel` 与 `.atlas` 目标和 `spine-cli` 外部转换器元数据。
- `.blend`：输出 `.glb` 目标和 Blender 外部转换器元数据。
- `.png`：记录 `edgePadding` 与 `atlasPacked`，用于透明边缘填充和图集化打包。

在“不新增依赖”的约束下，`.blend` 和 `.spine` 的真实转换不会伪造为内置能力；当前实现提供确定性的管线清单和占位输出，后续配置外部 Blender/Spine CLI 后可替换为真实转换。

### 6. 技术演示

`examples/2.5d-demo` 提供可直接运行的市场展示项目，覆盖：

- Spine FFD descriptor。
- 动态遮蔽。
- 3D 城市装饰层。
- 视差摄像机。
- HD-2D filter descriptor。
- 静态模型合批计划和 LOD 降级。

运行：

```bash
cd examples/2.5d-demo
npm install
npm run dev
```

## 验证

```bash
npx vitest run tests/industrial-25d-pipeline.test.js tests/dimension3d-25d-hardening.test.js
```

该测试覆盖 6 大维度的 public API、导入管线和示例项目存在性。
