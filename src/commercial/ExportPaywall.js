import { createOmniError } from '../core/OmniError.js';

const TARGETS = new Set(['html5', 'wechat', 'douyin']);

/**
 * Commercial export gate for one-click publishing features.
 *
 * Runtime engine APIs remain open-source. This gate is only for packaged
 * one-click app-store export scaffolds such as WeChat, Douyin, and hosted HTML5.
 *
 * @example
 * const paywall = new ExportPaywall({ license: process.env.OMNICORE_PRO_LICENSE });
 * paywall.assertExport('wechat');
 */
export class ExportPaywall {
  constructor({ license = '', plan = 'community' } = {}) {
    this.license = license || '';
    this.plan = plan;
  }

  canExport(target) {
    if (!TARGETS.has(target)) return false;
    return this._hasCommercialLicense();
  }

  assertExport(target) {
    if (!TARGETS.has(target)) {
      throw createOmniError('Export', `不支持的一键导出目标：${target}`);
    }
    if (!this.canExport(target)) {
      throw createOmniError(
        'Export',
        `一键导出 ${target} 属于 OmniCore 商业版能力。请设置 OMNICORE_PRO_LICENSE 或传入 --license。`
      );
    }
    return true;
  }

  _hasCommercialLicense() {
    return this.plan === 'pro'
      || /^OMNI-PRO-[A-Z0-9-]{4,}$/i.test(this.license)
      || this.license === 'OMNI-PRO-TEST';
  }
}

export default ExportPaywall;
