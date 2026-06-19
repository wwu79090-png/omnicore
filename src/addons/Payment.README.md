# Payment

Official OmniCore plugin for a small runtime payment facade.

Enable with `OmniCore.use()`.

```js
import Payment from './src/addons/Payment.js';

await OmniCore.use(Payment, {
  providerName: 'wechat',
  provider: {
    requestPayment(order) {
      return wx.requestMidasPayment(order);
    }
  }
});

await OmniCore.Payment.requestPayment({ orderId: 'order-1', amount: 6 });
```

Use this layer when a game wants one payment API while platform-specific plugins provide the real SDK adapter.
