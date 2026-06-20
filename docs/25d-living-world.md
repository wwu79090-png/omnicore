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

编辑器应用还提供 `plan25DCoCreation()`、`previewLivingWorld25D()` 和 `previewWorldMemory25D()`，用于在场景工具中预览共创计划、社交行为和世界记忆补丁。
