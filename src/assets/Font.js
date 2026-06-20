import { createOmniError } from '../core/OmniError.js';

const loadedFonts = new Map();

export const Font = {
  async load(family, url, descriptors = {}) {
    const name = String(family || '').trim();
    if (!name) {
      throw createOmniError('Font', 'Font.load requires a font family name.', {
        code: 'OMNICORE_FONT_FAMILY_REQUIRED'
      });
    }
    const source = normalizeFontSource(url);
    const cacheKey = `${name}:${source}`;
    if (loadedFonts.has(cacheKey)) return loadedFonts.get(cacheKey);

    if (typeof FontFace === 'function') {
      const face = new FontFace(name, source, descriptors);
      const loaded = await face.load();
      const fonts = globalThis.document?.fonts;
      fonts?.add?.(loaded);
      if (fonts?.ready && typeof fonts.ready.then === 'function') await fonts.ready;
      loadedFonts.set(cacheKey, loaded);
      return loaded;
    }

    const fallback = {
      family: name,
      source,
      descriptors: { ...descriptors },
      loaded: false,
      reason: 'FontFace API unavailable'
    };
    loadedFonts.set(cacheKey, fallback);
    return fallback;
  },

  isLoaded(family, url = '') {
    const source = url ? normalizeFontSource(url) : '';
    return [...loadedFonts.keys()].some((key) => (
      source ? key === `${family}:${source}` : key.startsWith(`${family}:`)
    ));
  },

  clear() {
    loadedFonts.clear();
  }
};

function normalizeFontSource(url = '') {
  const source = String(url || '').trim();
  if (/^url\(/i.test(source)) return source;
  return `url("${source}")`;
}

export default Font;
