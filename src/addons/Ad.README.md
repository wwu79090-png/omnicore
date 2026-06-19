# Ad

Official OmniCore plugin for rewarded video and banner ad adapters.

Enable with `OmniCore.use()`.

```js
import Ad from './src/addons/Ad.js';

await OmniCore.use(Ad, {
  providerName: 'wechat',
  provider: {
    showRewardedVideoAd: (placementId) => wx.createRewardedVideoAd({ adUnitId: placementId }).show(),
    createBannerAd: (placementId, style) => wx.createBannerAd({ adUnitId: placementId, style })
  }
});

await OmniCore.Ad.showRewardedVideoAd('revive-video');
```

The interface stays small so platform plugins can register production providers without forcing SDK code into the core engine.
