import Ad, { createAdService } from '../../Ad.js';

export function createMockAdProvider(log = []) {
  return {
    async showRewardedVideoAd(placementId, options = {}) {
      log.push(['showRewardedVideoAd', placementId, options.reason || 'reward']);
      return {
        completed: true,
        provider: 'mock-ad',
        placementId,
        reward: options.reward || { type: 'coins', amount: 100 }
      };
    },

    createBannerAd(placementId, options = {}) {
      log.push(['createBannerAd', placementId, options.width || 320]);
      return {
        provider: 'mock-ad',
        placementId,
        style: {
          left: options.left || 0,
          top: options.top || 0,
          width: options.width || 320,
          height: options.height || 50
        },
        show() {
          log.push(['banner.show', placementId]);
        },
        hide() {
          log.push(['banner.hide', placementId]);
        },
        destroy() {
          log.push(['banner.destroy', placementId]);
        }
      };
    }
  };
}

export function createPluginAdExample({ log = [] } = {}) {
  const ad = createAdService({
    providerName: 'mock-ad',
    provider: createMockAdProvider(log)
  });

  return {
    name: 'plugin-ad-example',
    version: '1.0.0',
    ad,
    async showReviveReward() {
      return ad.showRewardedVideoAd('revive-video', {
        reason: 'revive',
        reward: { type: 'revive-token', amount: 1 }
      });
    },
    createBottomBanner() {
      return ad.createBannerAd('home-bottom-banner', {
        width: 320,
        height: 50
      });
    }
  };
}

export default {
  name: 'plugin-ad-example',
  version: '1.0.0',
  install(OmniCore, options = {}) {
    const service = OmniCore.Ad?.registerProvider
      ? OmniCore.Ad
      : Ad.install(OmniCore);
    service
      .registerProvider('mock-ad', createMockAdProvider(options.log || []))
      .useProvider('mock-ad');
    return {
      ad: service,
      showRewardedVideoAd(placementId, adOptions) {
        return service.showRewardedVideoAd(placementId, adOptions);
      },
      createBannerAd(placementId, adOptions) {
        return service.createBannerAd(placementId, adOptions);
      },
      destroy() {
        options.log?.push?.(['destroy', 'plugin-ad-example']);
      }
    };
  }
};
