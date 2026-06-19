# WechatMiniGameMonetization

Official OmniCore plugin for WeChat mini game payment and ad SDK binding.

Enable with `OmniCore.use()`.

```js
import WechatMiniGameMonetization from './src/addons/WechatMiniGameMonetization.js';

await OmniCore.use(WechatMiniGameMonetization, { wx });

await OmniCore.Payment.requestPayment({ offerId: 'offer-1', buyQuantity: 1 });
await OmniCore.Ad.showRewardedVideoAd('revive-video');
```

The plugin installs `OmniCore.Payment` and `OmniCore.Ad` automatically when they are not already active, then registers WeChat providers for `wx.requestMidasPayment`, `wx.createRewardedVideoAd`, and `wx.createBannerAd`.
