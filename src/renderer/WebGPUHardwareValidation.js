export function createWebGPUHardwareValidationReport(input = {}) {
  const browsers = normalizeBrowsers(input.browsers);
  const pipelineSnapshot = input.pipelineSnapshot || input.resourceLifecycle || {};
  const fallbacks = browsers
    .filter((browser) => browser.webgpu !== 'passed')
    .map((browser) => ({
      browser: browser.name,
      backend: browser.fallback || 'webgl2',
      reason: browser.reason || 'webgpu-unavailable'
    }));
  const recoveries = Array.isArray(pipelineSnapshot.recoveries) ? pipelineSnapshot.recoveries : [];

  return {
    schema: 'omnicore.webgpu-hardware-validation.v1',
    generatedAt: input.generatedAt || null,
    summary: {
      browserCount: browsers.length,
      webgpuPassedCount: browsers.filter((browser) => browser.webgpu === 'passed').length,
      fallbackCount: fallbacks.length,
      deviceLostRecovered: recoveries.length > 0,
      commandCount: Number(pipelineSnapshot.summary?.commandCount || 0)
    },
    browsers,
    fallbacks,
    resourceLifecycle: clone(pipelineSnapshot),
    deviceLost: {
      tested: recoveries.length > 0 || Boolean(input.deviceLost?.tested),
      recovered: recoveries.length > 0 || Boolean(input.deviceLost?.recovered),
      recoveries: recoveries.map(clone)
    },
    recommendations: createRecommendations({ browsers, fallbacks, recoveries, pipelineSnapshot })
  };
}

function normalizeBrowsers(value) {
  const browsers = Array.isArray(value) && value.length ? value : [
    { name: 'Chromium', webgpu: 'fallback', fallback: 'webgl2', reason: 'not-sampled' }
  ];
  return browsers.map((browser) => ({
    name: String(browser.name || 'Browser'),
    webgpu: browser.webgpu === 'passed' ? 'passed' : 'fallback',
    adapter: browser.adapter || null,
    fallback: browser.fallback || (browser.webgpu === 'passed' ? null : 'webgl2'),
    reason: browser.reason || null
  }));
}

function createRecommendations({ browsers, fallbacks, recoveries, pipelineSnapshot }) {
  const recommendations = [];
  if (fallbacks.length) recommendations.push('verify-webgpu-adapter-and-keep-webgl2-fallback');
  if (!recoveries.length) recommendations.push('run-device-lost-recovery-check');
  if (!pipelineSnapshot.summary?.uploadedTextureCount) recommendations.push('capture-real-texture-upload');
  if (browsers.length < 3) recommendations.push('add-multi-browser-hardware-samples');
  return recommendations;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

export default createWebGPUHardwareValidationReport;
