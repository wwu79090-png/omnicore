import createOfficialAddon from './_createOfficialAddon.js';
import Payment from './Payment.js';
import Ad from './Ad.js';
import { createOmniError } from '../core/OmniError.js';

function resolveWechatSdk(wx) {
  const sdk = wx || globalThis.wx;
  if (!sdk) throw createOmniError('WechatMiniGameMonetization', '未找到 wx SDK。');
  return sdk;
}

export function createWechatPaymentProvider(wx) {
  const sdk = resolveWechatSdk(wx);
  return {
    requestPayment(order = {}) {
      if (typeof sdk.requestMidasPayment !== 'function') {
        throw createOmniError('WechatMiniGameMonetization', 'wx.requestMidasPayment 不可用。');
      }
      return new Promise((resolve, reject) => {
        sdk.requestMidasPayment({
          ...order,
          success(result) {
            resolve({
              paid: true,
              provider: 'wechat',
              result
            });
          },
          fail(error) {
            reject(error);
          }
        });
      });
    }
  };
}

export function createWechatAdProvider(wx) {
  const sdk = resolveWechatSdk(wx);
  return {
    async showRewardedVideoAd(placementId, options = {}) {
      if (typeof sdk.createRewardedVideoAd !== 'function') {
        throw createOmniError('WechatMiniGameMonetization', 'wx.createRewardedVideoAd 不可用。');
      }
      const ad = sdk.createRewardedVideoAd({ adUnitId: placementId, ...options });
      let closeResult = null;
      ad.onClose?.((result = {}) => {
        closeResult = result;
      });
      await ad.load?.();
      await ad.show?.();
      return {
        completed: closeResult?.isEnded !== false,
        provider: 'wechat',
        placementId,
        result: closeResult
      };
    },

    createBannerAd(placementId, options = {}) {
      if (typeof sdk.createBannerAd !== 'function') {
        throw createOmniError('WechatMiniGameMonetization', 'wx.createBannerAd 不可用。');
      }
      return sdk.createBannerAd({
        adUnitId: placementId,
        ...options
      });
    }
  };
}

export default createOfficialAddon('WechatMiniGameMonetization', (OmniCore, { wx = null } = {}) => {
  const sdk = resolveWechatSdk(wx);
  const payment = OmniCore.Payment?.registerProvider ? OmniCore.Payment : Payment.install(OmniCore);
  const ad = OmniCore.Ad?.registerProvider ? OmniCore.Ad : Ad.install(OmniCore);

  payment.registerProvider('wechat', createWechatPaymentProvider(sdk)).useProvider('wechat');
  ad.registerProvider('wechat', createWechatAdProvider(sdk)).useProvider('wechat');

  return {
    provider: 'wechat',
    payment,
    ad
  };
});
