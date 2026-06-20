# OmniCore 2.5D Living World

2.5D Living World 是一组描述符优先的运行时与编辑器 API。它不会直接改写渲染器、Store 或浏览器权限状态，而是产出可测试、可保存、可预览的决策数据。

## SocialAwareness25D

`SocialAwareness25D` 根据 NPC、地点和天气生成社交行为描述符，适合驱动点头、排队、避雨等轻量群体智能。

```js
import { SocialAwareness25D } from 'omnicore';

const decisions = new SocialAwareness25D({ greetingRadius: 36 }).evaluate({
  npcs: [
    { id: 'merchant', x: 10, y: 10, tags: ['friendly'] },
    { id: 'guard', x: 32, y: 12, tags: ['friendly'] }
  ]
});
```

## WorldMemory25D

`WorldMemory25D` 记录场景事件，并解析成永久场景补丁或 NPC 台词分支。事件数量受 `maxEvents` 限制，可以通过 `snapshot()` 和 `restore()` 接入项目自己的 Store。

```js
import { WorldMemory25D } from 'omnicore';

const memory = new WorldMemory25D({ maxEvents: 128 });
memory.record({ type: 'boss-defeated', id: 'boss', locationId: 'blacksmith', at: 1 });
const patches = memory.resolveScenePatches({ entities: [{ id: 'blacksmith' }] });
```

## EmotionalPalette25D

`EmotionalPalette25D` 把剧情状态解析成渲染器无关的情绪调色描述符。渲染层可以将它映射到色温、饱和度、暗角和 tint。

```js
import { EmotionalPalette25D } from 'omnicore';

const palette = new EmotionalPalette25D().resolve({
  mood: 'combat',
  intensity: 0.8,
  transitionMs: 300
});
```

## RealitySensor25D

`RealitySensor25D` 用于混合现实触发。定位和方向数据都是显式 opt-in：只有调用 `sample({ geolocation: true })` 时才会请求定位；没有权限、权限被拒绝或浏览器 API 不可用时，会回退到本地时间和零倾斜描述符。

```js
import { RealitySensor25D } from 'omnicore';

const sample = await new RealitySensor25D().sample({
  daylight: true,
  geolocation: false,
  orientation: true
});
```

权限说明：浏览器定位和设备方向属于敏感能力，项目应在用户操作之后再启用，并在 UI 中解释用途。默认用法不会请求地理位置权限。

## EditorCoCreator25D

`EditorCoCreator25D` 将自然语言转换为可审查的 2.5D 编辑器计划。目前内置确定性解析，支持“树林后建高塔，塔顶有剑”等常见策划表达，并产出资产任务、遮挡、阴影和事件图描述符。

```js
import { EditorCoCreator25D } from 'omnicore';

const plan = new EditorCoCreator25D().plan({
  prompt: '在树林后建一个高塔，塔顶有一把剑',
  scene: { entities: [{ id: 'forest', type: 'forest', x: 80, y: 120 }] }
});
```

编辑器应用还提供 `plan25DCoCreation()`、`apply25DCoCreationPlan()`、`previewLivingWorld25D()`、`previewWorldMemory25D()`、`create25DVisualEvidence()` 和 `exportLightweightDeploymentBundle()`，用于把共创计划从预览推进到保存、可视化证据和轻量部署。

```js
const plan = app.plan25DCoCreation({ prompt: '在树林后建一个高塔，塔顶有一把剑' });
const applied = app.apply25DCoCreationPlan(plan);
const snapshot = app.saveSnapshot('forest-demo');
const visualEvidence = app.create25DVisualEvidence();
const deployBundle = app.exportLightweightDeploymentBundle();

console.log(applied.entity.id, snapshot.scene.entities.length, visualEvidence.ready, deployBundle.manifest.entryScene);
```

这个闭环会把共创结果写入当前 scene，标记当前 scene tab 为 dirty，进入编辑器历史栈，并在轻量部署包中生成 `manifests/deploy-lite.json`。部署包只保存场景、引用资源、构建目标和已应用的共创计划，不会把营销页或无关报告塞进运行时路径。

生产化路径可以继续调用 `create25DProductionReadinessReport()` 和 `exportProductionDeploymentBundle()`。前者检查共创计划是否已应用、场景是否已保存、轻量部署目标是否启用、部署 manifest 是否完整，以及 authoring health 是否存在阻塞项；后者把轻量部署包、`reports/25d-production-readiness.json` 和 `reports/25d-visual-evidence.json` 一起导出。生产面板会显示 `plan -> apply -> save -> export -> readiness` 状态，同时列出 occlusion、shadow 和 event visual evidence。

编辑器保存链路提供 `listSaveVersions()`、`diffSaveVersions(fromId, toId)` 和 `rollbackToSaveVersion(id)`，用于比较共创前后的场景实体变化，并把工作区回滚到某个已保存版本。回滚会更新当前 scene 和活动 scene tab，并把 tab 标记为 dirty，便于发布前重新保存确认。

仓库还提供 `examples/25d-editor-deploy-loop.json` 和 `createEditorDeployBenchmark25D()`，用于给官网、CI 或发布说明生成可复现的 2.5D 编辑器闭环证据：`plan -> apply -> save -> export -> readiness`。

发布前可以运行 `npm run certify:25d` 生成 `docs/release-notes/25d-production-certification.json` 和对应 Markdown 报告。这个门禁会复用官方 demo、轻量部署 manifest、2.5D benchmark helper 和 readiness 结果，确认编辑器共创从计划、应用、保存、导出到生产检查全部通过，并阻断超出 `2.5d-editor-lite` 文件预算的发布。对真实项目导出的生产包，可以运行 `npm run certify:25d -- --bundle path/to/production-bundle.json`，认证会优先读取 bundle 里的 manifest、文件列表和 readiness 报告，不再只依赖官方 demo。

本地预览可以运行 `npm run preview:25d -- --bundle path/to/production-bundle.json`，脚本会启动一个只读取 bundle 的轻量 HTTP 预览页，展示 scene entity、co-created 标记、occlusion baseline、shadow 和 readiness 分数。需要截图证据时运行 `npm run capture:25d -- --bundle path/to/production-bundle.json`，它会启动同一个预览服务、用 Playwright Chromium 截图，并写出 `docs/release-notes/25d-preview-screenshot-evidence.json`。

CI 入口在 `.github/workflows/25d-production.yml`。它会安装 Chromium、执行 `certify:25d --bundle examples/25d-editor-deploy-loop.production-bundle.json`，再运行 `capture:25d --bundle examples/25d-editor-deploy-loop.production-bundle.json`，最后上传认证 JSON、Markdown、截图和截图证据报告。
