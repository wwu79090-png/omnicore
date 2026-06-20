# Plugin Ad Example

This reference plugin shows the complete ad integration path for rewarded video and banner ads.

It demonstrates:

- registering an ad provider with `registerProvider`;
- calling `showRewardedVideoAd(placementId, options)` for 激励视频 rewards;
- calling `createBannerAd(placementId, options)` for banner placements;
- returning show, hide, and destroy handles from banner instances.

Usage:

```js
import adExample from './src/addons/examples/plugin-ad/index.js';

const installed = adExample.install(OmniCore, { log: [] });
await installed.showRewardedVideoAd('revive-video', {
  reward: { type: 'revive-token', amount: 1 }
});

const banner = installed.createBannerAd('home-bottom-banner', { width: 320 });
banner.show();
```

Production plugins should replace `createMockAdProvider()` with a platform SDK provider such as WeChat rewarded video, a web ad network, or an internal cross-promotion service.
