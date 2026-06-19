import createOfficialAddon from './_createOfficialAddon.js';
import { createOmniError } from '../core/OmniError.js';

export function createPaymentService({ providerName = 'default', provider = null } = {}) {
  const providers = new Map();
  let activeProvider = null;

  const service = {
    registerProvider(name, adapter) {
      if (!name) throw createOmniError('Payment', 'registerProvider 需要提供 provider 名称。');
      if (!adapter || typeof adapter !== 'object') throw createOmniError('Payment', `无效支付 provider：${name}`);
      providers.set(name, adapter);
      if (!activeProvider) activeProvider = name;
      return service;
    },

    useProvider(name) {
      if (!providers.has(name)) throw createOmniError('Payment', `支付 provider 未注册：${name}`);
      activeProvider = name;
      return service;
    },

    listProviders() {
      return [...providers.keys()];
    },

    getProvider(name = activeProvider) {
      return providers.get(name) || null;
    },

    async requestPayment(order = {}) {
      const adapter = service.getProvider();
      if (!adapter) throw createOmniError('Payment', '尚未配置支付 provider。');
      if (typeof adapter.requestPayment === 'function') return adapter.requestPayment(order);
      if (typeof adapter.pay === 'function') return adapter.pay(order);
      throw createOmniError('Payment', '当前 provider 缺少 requestPayment(order) 或 pay(order)。');
    }
  };

  if (provider) service.registerProvider(providerName, provider).useProvider(providerName);
  return service;
}

export default createOfficialAddon('Payment', (_OmniCore, options = {}) => createPaymentService(options));
