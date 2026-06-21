export default {
  name: 'WechatCapabilities',
  version: '1.0.0',
  install({ wx = globalThis.wx, logger = console } = {}) {
    const capabilities = detectCapabilities(wx);
    return {
      registerProvider(provider) {
        wx = provider || wx;
        Object.assign(capabilities, detectCapabilities(wx));
        return this;
      },
      snapshot() {
        return { ...capabilities };
      },
      async vibrateShort() {
        if (!wx?.vibrateShort) return false;
        await callWx(wx.vibrateShort.bind(wx), {});
        return true;
      },
      async shareAppMessage(options = {}) {
        if (!wx?.shareAppMessage) {
          logger.warn?.('[OmniCore.WechatCapabilities] shareAppMessage unavailable');
          return false;
        }
        wx.shareAppMessage(options);
        return true;
      },
      createBannerAd(options = {}) {
        if (!wx?.createBannerAd) return null;
        return wx.createBannerAd(options);
      },
      destroy() {}
    };
  }
};

function detectCapabilities(wx) {
  return {
    runtime: wx ? 'wechat-minigame' : 'web-fallback',
    vibrate: Boolean(wx?.vibrateShort),
    share: Boolean(wx?.shareAppMessage),
    bannerAd: Boolean(wx?.createBannerAd),
    rewardedVideo: Boolean(wx?.createRewardedVideoAd),
    storage: Boolean(wx?.getStorageSync && wx?.setStorageSync)
  };
}

function callWx(fn, options) {
  return new Promise((resolve, reject) => {
    fn({
      ...options,
      success: resolve,
      fail: reject
    });
  });
}
