import WechatMiniGameMonetization from '../../../../packages/omnicore-plugin-wechat-monetization/src/index.js';

export default WechatMiniGameMonetization;

export function createMockWx(log = []) {
  return {
    requestMidasPayment(options) {
      log.push(['requestMidasPayment', options.offerId || options.mode || 'order']);
      options.success?.({ orderId: options.offerId || 'demo-order' });
    },
    createRewardedVideoAd(options) {
      log.push(['createRewardedVideoAd', options.adUnitId]);
      return {
        onClose(callback) {
          callback({ isEnded: true });
        },
        async load() {
          log.push(['rewarded.load', options.adUnitId]);
        },
        async show() {
          log.push(['rewarded.show', options.adUnitId]);
        }
      };
    },
    createBannerAd(options) {
      log.push(['createBannerAd', options.adUnitId]);
      return { options };
    }
  };
}
