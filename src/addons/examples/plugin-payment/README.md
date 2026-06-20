# Plugin Payment Example

This reference plugin shows a 完整支付流程 using the official OmniCore `Payment` addon.

It demonstrates:

- registering a payment provider with `registerProvider`;
- calling `requestPayment(order)`;
- returning an `orderId`, `paid` flag, amount, currency, and provider name;
- exposing a cleanup hook from `destroy()`.

Usage:

```js
import paymentExample from './src/addons/examples/plugin-payment/index.js';

const installed = paymentExample.install(OmniCore, { log: [] });
const receipt = await installed.requestPayment({
  orderId: 'starter-pack-001',
  amountCents: 499,
  currency: 'USD'
});
```

Production plugins should replace `createMockPaymentProvider()` with a platform provider such as WeChat, Stripe Checkout, Steam, or an internal entitlement server.
