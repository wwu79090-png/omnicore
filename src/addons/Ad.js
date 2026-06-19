import createOfficialAddon from './_createOfficialAddon.js';
import { createOmniError } from '../core/OmniError.js';

export function createAdService({ providerName = 'default', provider = null } = {}) {
  const providers = new Map();
  let activeProvider = null;

  const service = {
    registerProvider(name, adapter) {
      if (!name) throw createOmniError('Ad', 'registerProvider 需要提供 provider 名称。');
      if (!adapter || typeof adapter !== 'object') throw createOmniError('Ad', `无效广告 provider：${name}`);
      providers.set(name, adapter);
      if (!activeProvider) activeProvider = name;
      return service;
    },

    useProvider(name) {
      if (!providers.has(name)) throw createOmniError('Ad', `广告 provider 未注册：${name}`);
      activeProvider = name;
      return service;
    },

    listProviders() {
      return [...providers.keys()];
    },

    getProvider(name = activeProvider) {
      return providers.get(name) || null;
    },

    async showRewardedVideoAd(placementId, options = {}) {
      const adapter = service._requireProvider();
      if (typeof adapter.showRewardedVideoAd === 'function') return adapter.showRewardedVideoAd(placementId, options);
      if (typeof adapter.showRewarded === 'function') return adapter.showRewarded(placementId, options);
      throw createOmniError('Ad', '当前 provider 缺少 showRewardedVideoAd(placementId)。');
    },

    createBannerAd(placementId, options = {}) {
      const adapter = service._requireProvider();
      if (typeof adapter.createBannerAd === 'function') return adapter.createBannerAd(placementId, options);
      if (typeof adapter.createBanner === 'function') return adapter.createBanner(placementId, options);
      throw createOmniError('Ad', '当前 provider 缺少 createBannerAd(placementId)。');
    },

    _requireProvider() {
      const adapter = service.getProvider();
      if (!adapter) throw createOmniError('Ad', '尚未配置广告 provider。');
      return adapter;
    }
  };

  if (provider) service.registerProvider(providerName, provider).useProvider(providerName);
  return service;
}

export default createOfficialAddon('Ad', (_OmniCore, options = {}) => createAdService(options));
