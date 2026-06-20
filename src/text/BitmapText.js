/**
 * AngelCode BMFont bitmap text renderer for Phaser migration.
 */
export class BitmapText {
  static parseFnt(source = '') {
    const font = {
      face: '',
      size: 0,
      lineHeight: 0,
      base: 0,
      scaleW: 0,
      scaleH: 0,
      pages: [],
      chars: new Map()
    };
    for (const line of String(source).split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const [kind] = trimmed.split(/\s+/, 1);
      const attrs = parseAttributes(trimmed.slice(kind.length));
      if (kind === 'info') {
        font.face = attrs.face || font.face;
        font.size = Number(attrs.size || 0);
      } else if (kind === 'common') {
        font.lineHeight = Number(attrs.lineHeight || 0);
        font.base = Number(attrs.base || 0);
        font.scaleW = Number(attrs.scaleW || 0);
        font.scaleH = Number(attrs.scaleH || 0);
      } else if (kind === 'page') {
        font.pages.push({ id: Number(attrs.id || 0), file: attrs.file || '' });
      } else if (kind === 'char') {
        const id = Number(attrs.id || 0);
        font.chars.set(id, {
          id,
          x: Number(attrs.x || 0),
          y: Number(attrs.y || 0),
          width: Number(attrs.width || 0),
          height: Number(attrs.height || 0),
          xoffset: Number(attrs.xoffset || 0),
          yoffset: Number(attrs.yoffset || 0),
          xadvance: Number(attrs.xadvance || attrs.width || 0),
          page: Number(attrs.page || 0)
        });
      }
    }
    return font;
  }

  constructor(text = '', {
    x = 0,
    y = 0,
    font = null,
    texture = null,
    scale = 1,
    alpha = 1
  } = {}) {
    this.type = 'bitmapText';
    this.text = String(text ?? '');
    this.x = Number(x || 0);
    this.y = Number(y || 0);
    this.font = font || BitmapText.parseFnt('');
    this.texture = texture;
    this.scale = Number(scale || 1);
    this.alpha = Number(alpha ?? 1);
  }

  setText(value = '') {
    this.text = String(value ?? '');
    return this;
  }

  measure() {
    let width = 0;
    for (const char of this.text) {
      width += (this.font.chars.get(char.codePointAt(0))?.xadvance || 0) * this.scale;
    }
    return {
      width,
      height: (this.font.lineHeight || 0) * this.scale
    };
  }

  render(ctx) {
    if (!ctx || !this.texture) return [];
    const commands = [];
    let cursor = 0;
    ctx.save?.();
    ctx.globalAlpha = this.alpha;
    for (const char of this.text) {
      const glyph = this.font.chars.get(char.codePointAt(0));
      if (!glyph) continue;
      const dx = this.x + (cursor + glyph.xoffset) * this.scale;
      const dy = this.y + glyph.yoffset * this.scale;
      const dw = glyph.width * this.scale;
      const dh = glyph.height * this.scale;
      ctx.drawImage?.(this.texture, glyph.x, glyph.y, glyph.width, glyph.height, dx, dy, dw, dh);
      commands.push({ char, glyph, x: dx, y: dy, width: dw, height: dh });
      cursor += glyph.xadvance;
    }
    ctx.restore?.();
    return commands;
  }

  toJSON() {
    return {
      type: this.type,
      text: this.text,
      x: this.x,
      y: this.y,
      font: this.font.face,
      scale: this.scale
    };
  }
}

function parseAttributes(source = '') {
  const attrs = {};
  const pattern = /(\w+)=("[^"]*"|\S+)/g;
  let match = pattern.exec(source);
  while (match) {
    attrs[match[1]] = match[2].replace(/^"|"$/g, '');
    match = pattern.exec(source);
  }
  return attrs;
}

export default BitmapText;
