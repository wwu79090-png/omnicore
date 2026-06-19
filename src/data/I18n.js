/**
 * Minimal i18n dictionary.
 *
 * @example
 * const i18n = new I18n({ en: { start: 'Start {name}' } }, 'en');
 * i18n.t('start', { name: 'Game' });
 */
export class I18n {
  constructor(dictionaries = {}, locale = 'en') {
    this.dictionaries = dictionaries;
    this.locale = locale;
  }

  setLocale(locale) {
    this.locale = locale;
  }

  add(locale, dictionary) {
    this.dictionaries[locale] = { ...(this.dictionaries[locale] || {}), ...dictionary };
  }

  t(key, vars = {}) {
    const template = this.dictionaries[this.locale]?.[key] ?? this.dictionaries.en?.[key] ?? key;
    return template.replace(/\{(\w+)}/g, (_, name) => vars[name] ?? '');
  }
}

export default I18n;
