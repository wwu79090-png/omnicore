/**
 * Rich canvas text primitive for Phaser-style migration.
 */
export class Text {
  constructor(text = '', {
    x = 0,
    y = 0,
    color = '#ffffff',
    fill = color,
    font = '16px sans-serif',
    align = 'left',
    lineSpacing = 0,
    stroke = null,
    shadow = null,
    wordWrap = null
  } = {}) {
    this.type = 'text';
    this.text = String(text ?? '');
    this.x = Number(x || 0);
    this.y = Number(y || 0);
    this.style = {
      fill,
      font,
      align,
      lineSpacing: Number(lineSpacing || 0),
      stroke: normalizeStroke(stroke),
      shadow: normalizeShadow(shadow),
      wordWrap: normalizeWordWrap(wordWrap)
    };
  }

  setText(value = '') {
    this.text = String(value ?? '');
    return this;
  }

  setStroke(color = '#000000', thickness = 1) {
    this.style.stroke = {
      color,
      thickness: Math.max(0, Number(thickness || 0))
    };
    return this;
  }

  setShadow(color = 'rgba(0,0,0,0.5)', blur = 4, offsetX = 0, offsetY = 0) {
    this.style.shadow = {
      color,
      blur: Math.max(0, Number(blur || 0)),
      offsetX: Number(offsetX || 0),
      offsetY: Number(offsetY || 0)
    };
    return this;
  }

  setWordWrap(width = 0) {
    this.style.wordWrap = {
      width: Math.max(0, Number(width || 0))
    };
    return this;
  }

  setLineSpacing(value = 0) {
    this.style.lineSpacing = Number(value || 0);
    return this;
  }

  layoutLines(ctx = null) {
    const lines = [];
    const explicitLines = this.text.split(/\r?\n/);
    const wrapWidth = this.style.wordWrap?.width || 0;
    if (!wrapWidth || !ctx?.measureText) return explicitLines;

    for (const sourceLine of explicitLines) {
      const words = sourceLine.split(/\s+/).filter(Boolean);
      if (!words.length) {
        lines.push('');
        continue;
      }
      let current = '';
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (!current || ctx.measureText(candidate).width <= wrapWidth) {
          current = candidate;
          continue;
        }
        lines.push(current);
        current = word;
      }
      if (current) lines.push(current);
    }
    return lines;
  }

  render(ctx) {
    if (!ctx) return [];
    const lines = this.layoutLines(ctx);
    const lineHeight = estimateLineHeight(this.style.font) + this.style.lineSpacing;
    ctx.save?.();
    ctx.font = this.style.font;
    ctx.fillStyle = this.style.fill;
    ctx.textAlign = this.style.align;
    if (this.style.shadow) {
      ctx.shadowColor = this.style.shadow.color;
      ctx.shadowBlur = this.style.shadow.blur;
      ctx.shadowOffsetX = this.style.shadow.offsetX;
      ctx.shadowOffsetY = this.style.shadow.offsetY;
    }
    lines.forEach((line, index) => {
      const y = this.y + index * lineHeight;
      if (this.style.stroke?.thickness > 0) {
        ctx.strokeStyle = this.style.stroke.color;
        ctx.lineWidth = this.style.stroke.thickness;
        ctx.strokeText?.(line, this.x, y);
      }
      ctx.fillText?.(line, this.x, y);
    });
    ctx.restore?.();
    return lines;
  }
}

function normalizeStroke(value) {
  if (!value) return null;
  if (typeof value === 'string') return { color: value, thickness: 1 };
  return {
    color: value.color || '#000000',
    thickness: Math.max(0, Number(value.thickness || value.width || 1))
  };
}

function normalizeShadow(value) {
  if (!value) return null;
  if (typeof value === 'string') return { color: value, blur: 4, offsetX: 0, offsetY: 0 };
  return {
    color: value.color || 'rgba(0,0,0,0.5)',
    blur: Math.max(0, Number(value.blur || 0)),
    offsetX: Number(value.offsetX || value.x || 0),
    offsetY: Number(value.offsetY || value.y || 0)
  };
}

function normalizeWordWrap(value) {
  if (!value) return null;
  if (typeof value === 'number') return { width: Math.max(0, value) };
  return { width: Math.max(0, Number(value.width || 0)) };
}

function estimateLineHeight(font = '') {
  const match = /(\d+(?:\.\d+)?)px/.exec(font);
  return match ? Number(match[1]) * 1.2 : 19.2;
}

export default Text;
