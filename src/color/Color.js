import { createOmniError } from '../core/OmniError.js';

function expandHex(value) {
  if (value.length === 3 || value.length === 4) {
    return [...value].map((char) => `${char}${char}`).join('');
  }
  return value;
}

export function from(hex) {
  if (typeof hex !== 'string' || !hex.startsWith('#')) {
    throw createOmniError('Color', 'Color.from expects a #hex string.', {
      code: 'OMNICORE_COLOR_INVALID_HEX'
    });
  }
  const normalized = expandHex(hex.slice(1).trim());
  if (!/^[\da-f]{6}([\da-f]{2})?$/i.test(normalized)) {
    throw createOmniError('Color', 'Color.from expects #rgb, #rgba, #rrggbb, or #rrggbbaa hex.', {
      code: 'OMNICORE_COLOR_INVALID_HEX'
    });
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const a = normalized.length === 8
    ? Number((Number.parseInt(normalized.slice(6, 8), 16) / 255).toFixed(3))
    : 1;
  const outputHex = `#${normalized.slice(0, 6).toLowerCase()}`;
  return {
    r,
    g,
    b,
    a,
    hex: outputHex,
    css: `rgba(${r}, ${g}, ${b}, ${a})`
  };
}

const Color = { from };

export default Color;
