import Payment, { createPaymentService } from '../../Payment.js';

export function createMockPaymentProvider(log = []) {
  return {
    async requestPayment(order = {}) {
      const orderId = order.orderId || `demo-order-${Date.now()}`;
      log.push(['requestPayment', orderId, order.amountCents || 0]);
      return {
        paid: true,
        provider: 'mock-payment',
        orderId,
        amountCents: order.amountCents || 0,
        currency: order.currency || 'USD'
      };
    }
  };
}

export function createPluginPaymentExample({ log = [] } = {}) {
  const provider = createMockPaymentProvider(log);
  const payment = createPaymentService({
    providerName: 'mock-payment',
    provider
  });

  return {
    name: 'plugin-payment-example',
    version: '1.0.0',
    payment,
    async buyStarterPack() {
      return payment.requestPayment({
        orderId: 'starter-pack-001',
        sku: 'starter-pack',
        amountCents: 499,
        currency: 'USD'
      });
    }
  };
}

export default {
  name: 'plugin-payment-example',
  version: '1.0.0',
  install(OmniCore, options = {}) {
    const service = OmniCore.Payment?.registerProvider
      ? OmniCore.Payment
      : Payment.install(OmniCore);
    service
      .registerProvider('mock-payment', createMockPaymentProvider(options.log || []))
      .useProvider('mock-payment');
    return {
      payment: service,
      async requestPayment(order) {
        return service.requestPayment(order);
      },
      destroy() {
        options.log?.push?.(['destroy', 'plugin-payment-example']);
      }
    };
  }
};
