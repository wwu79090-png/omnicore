import I18n from './I18n.js';
import { createOmniError } from '../core/OmniError.js';

/**
 * JSON-backed localization suite loaded from /assets/locale.
 *
 * @example
 * const localization = await Localization.load('zh-CN');
 * localization.t('ui.start');
 */
export class Localization extends I18n {
  constructor({
    dictionaries = {},
    locale = 'en',
    baseUrl = '/assets/locale',
    fetcher = globalThis.fetch?.bind(globalThis)
  } = {}) {
    super(dictionaries, locale);
    this.baseUrl = baseUrl;
    this.fetcher = fetcher;
  }

  /**
   * @param {string} locale Locale code.
   * @param {object} options Loader options.
   * @returns {Promise<Localization>} Loaded localization suite.
   */
  static async load(locale = 'en', options = {}) {
    const localization = new Localization({ ...options, locale });
    await localization.loadLocale(locale);
    return localization;
  }

  /**
   * @param {string} locale Locale code.
   * @returns {Promise<object>} Loaded dictionary.
   */
  async loadLocale(locale = this.locale) {
    if (!this.fetcher) throw createOmniError('Localization', 'Localization requires a fetcher to load /assets/locale JSON.');
    const url = `${this.baseUrl.replace(/\/$/u, '')}/${locale}.json`;
    const response = await this.fetcher(url);
    if (!response?.ok) throw createOmniError('Localization', `Localization dictionary load failed: ${url}`);
    const dictionary = await response.json();
    this.add(locale, dictionary);
    this.setLocale(locale);
    return dictionary;
  }
}

export default Localization;
