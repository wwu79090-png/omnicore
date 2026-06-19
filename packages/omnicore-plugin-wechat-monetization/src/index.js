function createPaymentProvider(wx) {
  return {
    requestPayment(order = {}) {
      return new Promise((resolve, reject) => {
        wx.requestMidasPayment({
          ...order,
          success(result) {
            resolve({ paid: true, provider: 'wechat', result });
          },
          fail(error) {
            reject(error);
          }
        });
      });
    }
  };
}

function createAdProvider(wx) {
  return {
    async showRewardedVideoAd(placementId, options = {}) {
      const ad = wx.createRewardedVideoAd({ adUnitId: placementId, ...options });
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
      return wx.createBannerAd({ adUnitId: placementId, ...options });
    }
  };
}

function createService() {
  const providers = new Map();
  let active = null;
  return {
    registerProvider(name, provider) {
      providers.set(name, provider);
      if (!active) active = name;
      return this;
    },
    useProvider(name) {
      active = name;
      return this;
    },
    getProvider() {
      return providers.get(active);
    },
    requestPayment(order) {
      return this.getProvider().requestPayment(order);
    },
    showRewardedVideoAd(placementId, options) {
      return this.getProvider().showRewardedVideoAd(placementId, options);
    },
    createBannerAd(placementId, options) {
      return this.getProvider().createBannerAd(placementId, options);
    }
  };
}

export function createWechatMiniGameMonetizationPlugin({ wx = globalThis.wx } = {}) {
  return {
    name: 'WechatMiniGameMonetization',
    install(OmniCore, options = {}) {
      const sdk = options.wx || wx;
      if (!sdk) throw new Error('Wechat Mini Game wx SDK is required.');
      const payment = OmniCore.Payment?.registerProvider ? OmniCore.Payment : createService();
      const ad = OmniCore.Ad?.registerProvider ? OmniCore.Ad : createService();
      payment.registerProvider('wechat', createPaymentProvider(sdk)).useProvider('wechat');
      ad.registerProvider('wechat', createAdProvider(sdk)).useProvider('wechat');
      OmniCore.Payment = payment;
      OmniCore.Ad = ad;
      return { provider: 'wechat', payment, ad };
    }
  };
}

export default createWechatMiniGameMonetizationPlugin();
