const DEFAULT_FONT_FAMILY = 'sans-serif';
const DEFAULT_FILL = '#ffffff';

export function layoutRichText({
  text = '',
  segments = null,
  maxWidth = 320,
  fontSize = 16,
  fontFamily = DEFAULT_FONT_FAMILY,
  lineHeight = null,
  fill = DEFAULT_FILL,
  stroke = null,
  lineWidth = 1,
  shadow = null
} = {}) {
  const sourceSegments = normalizeSegments(segments || [{ text, fill }], {
    fontSize,
    fontFamily,
    fill,
    stroke,
    lineWidth,
    shadow
  });
  const widthLimit = Math.max(1, Number(maxWidth) || 320);
  const resolvedLineHeight = Number(lineHeight || Math.ceil(fontSize * 1.35));
  const lines = [];
  let current = createLine(resolvedLineHeight);

  for (const segment of sourceSegments) {
    for (const token of tokenize(segment.text)) {
      const tokenWidth = measureToken(token, segment.fontSize);
      if (current.width > 0 && current.width + tokenWidth > widthLimit) {
        lines.push(current);
        current = createLine(resolvedLineHeight);
      }
      current.segments.push({
        ...segment,
        text: token,
        x: current.width,
        width: tokenWidth
      });
      current.width += tokenWidth;
    }
  }
  if (current.segments.length) lines.push(current);
  lines.forEach((line, index) => {
    line.y = (index + 1) * resolvedLineHeight;
  });
  return {
    width: Math.min(widthLimit, Math.max(0, ...lines.map((line) => line.width))),
    height: lines.length * resolvedLineHeight,
    lineHeight: resolvedLineHeight,
    lines
  };
}

function normalizeSegments(segments, defaults) {
  return (Array.isArray(segments) ? segments : []).map((segment) => {
    const fontSize = Number(segment.fontSize || defaults.fontSize || 16);
    const fontFamily = segment.fontFamily || defaults.fontFamily || DEFAULT_FONT_FAMILY;
    const weight = segment.weight ? `${segment.weight} ` : '';
    return {
      text: String(segment.text ?? ''),
      fill: segment.fill || defaults.fill || DEFAULT_FILL,
      stroke: segment.stroke ?? defaults.stroke,
      lineWidth: Number(segment.lineWidth ?? defaults.lineWidth ?? 1),
      shadow: segment.shadow ?? defaults.shadow,
      fontSize,
      fontFamily,
      font: segment.font || `${weight}${fontSize}px ${fontFamily}`
    };
  });
}

function tokenize(text) {
  const tokens = String(text).match(/\S+\s*|\s+/g);
  return tokens?.length ? tokens : [''];
}

function measureToken(token, fontSize) {
  return Math.max(1, String(token).length * Number(fontSize || 16) * 0.5);
}

function createLine(lineHeight) {
  return {
    y: lineHeight,
    width: 0,
    segments: []
  };
}

export default { layoutRichText };
