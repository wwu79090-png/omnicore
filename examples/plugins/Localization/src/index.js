export default {
  name: 'Localization',
  version: '1.0.0',
  install({ game, locale = 'en', messages = {} } = {}) {
    let activeLocale = locale;
    const translate = (key, params = {}) => {
      const template = messages[activeLocale]?.[key] || messages.en?.[key] || key;
      return String(template).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '');
    };
    game?.store?.set?.('i18n:locale', activeLocale);
    return {
      t: translate,
      setLocale(nextLocale) {
        activeLocale = nextLocale;
        game?.store?.set?.('i18n:locale', activeLocale);
      },
      destroy() {}
    };
  }
};
