# OmniCore Standard Plugin Template

这是一个完全可安装的第三方插件样板间，演示 `OmniCore.Addon` 标准结构、事件监听和 Store 写入。

## 安装

方式一：作为 npm 包安装：

```bash
npm install omnicore-standard-plugin
```

方式二：直接复制：

```text
examples/plugins/standard-plugin/
```

到你的项目：

```text
src/addons/standard-plugin/
```

## 注册

```js
import OmniCore from 'omnicore';
import standardPlugin from './src/addons/standard-plugin/src/index.js';

OmniCore.addon('standard', standardPlugin);
```

## 启用

```js
await OmniCore.useAddon('standard', {
  bus: game.events,
  store: game.store
});
```

插件会创建一个跟随鼠标移动的悬浮 UI 面板，并通过 `OmniCore.Store` 写入：

```js
store.get('standardPlugin');
```

## 停用

```js
await OmniCore.disableAddon('standard');
```

或直接：

```js
standardPlugin.destroy();
```

## 结构

```text
standard-plugin/
  src/index.js
  demo/index.html
  vite.config.js
  README.md
```

`src/index.js` 必须导出带有 `init(OmniCore, context)` 和 `destroy()` 的插件对象。
