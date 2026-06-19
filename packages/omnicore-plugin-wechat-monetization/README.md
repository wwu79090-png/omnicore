# @omnicore/plugin-wechat-monetization

Official OmniCore plugin for WeChat Mini Game monetization.

```js
import WechatMiniGameMonetization from '@omnicore/plugin-wechat-monetization';

OmniCore.use(WechatMiniGameMonetization, { wx });
await OmniCore.Payment.requestPayment({ mode: 'game', offerId: 'offer-a' });
await OmniCore.Ad.showRewardedVideoAd('reward-a');
```

The package registers `OmniCore.Payment` and `OmniCore.Ad` providers without bundling the WeChat SDK.
