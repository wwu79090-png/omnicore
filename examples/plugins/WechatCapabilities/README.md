# WechatCapabilities

Official OmniCore plugin sample for WeChat mini-game capability detection and guarded API calls.

```js
import WechatCapabilities from './examples/plugins/WechatCapabilities/src/index.js';

const wechat = WechatCapabilities.install({ wx: globalThis.wx });
console.log(wechat.snapshot());
await wechat.vibrateShort();
```

The sample keeps all calls optional so web builds can run without `wx`.
