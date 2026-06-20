const DEFAULT_STROKE = '#dbeafe';
const DEFAULT_PANEL_FONT = '13px ui-monospace, SFMono-Regular, Consolas, monospace';

export function createHousePrimitive({
  x = 0,
  y = 0,
  width = 96,
  height = 80,
  wallColor = '#334155',
  roofColor = '#ef4444',
  doorColor = '#1e293b',
  windowColor = '#93c5fd',
  stroke = DEFAULT_STROKE,
  alpha = 1
} = {}) {
  const wallTop = y + height * 0.34;
  const wallHeight = height * 0.66;
  const roofPeak = { x: x + width * 0.5, y };
  const roofLeft = { x: x - width * 0.08, y: wallTop + height * 0.06 };
  const roofRight = { x: x + width * 1.08, y: wallTop + height * 0.06 };
  const windowSize = Math.max(8, width * 0.16);
  return group('house', [
    polygon({
      role: 'roof',
      points: [roofLeft, roofPeak, roofRight],
      fill: roofColor,
      stroke,
      alpha
    }),
    rect({
      role: 'wall',
      x,
      y: wallTop,
      width,
      height: wallHeight,
      fill: wallColor,
      stroke,
      alpha
    }),
    rect({
      role: 'door',
      x: x + width * 0.42,
      y: wallTop + wallHeight * 0.42,
      width: width * 0.18,
      height: wallHeight * 0.58,
      fill: doorColor,
      stroke,
      alpha
    }),
    rect({
      role: 'window',
      x: x + width * 0.16,
      y: wallTop + wallHeight * 0.22,
      width: windowSize,
      height: windowSize,
      fill: windowColor,
      stroke,
      alpha: Math.min(1, alpha * 0.85)
    }),
    rect({
      role: 'window',
      x: x + width * 0.68,
      y: wallTop + wallHeight * 0.22,
      width: windowSize,
      height: windowSize,
      fill: windowColor,
      stroke,
      alpha: Math.min(1, alpha * 0.85)
    })
  ], { x, y, width, height });
}

export function createRingPrimitive({
  x = 0,
  y = 0,
  outerRadius = 32,
  innerRadius = 18,
  fill = '#38bdf8',
  stroke = '#e0f2fe',
  alpha = 1,
  role = 'ring'
} = {}) {
  return group('ring', [
    ring({
      role,
      x,
      y,
      outerRadius,
      innerRadius,
      fill,
      stroke,
      alpha
    })
  ], {
    x: x - outerRadius,
    y: y - outerRadius,
    width: outerRadius * 2,
    height: outerRadius * 2
  });
}

export function createSectorPrimitive({
  x = 0,
  y = 0,
  radius = 32,
  startAngle = 0,
  endAngle = Math.PI * 0.5,
  fill = '#38bdf8',
  stroke = '#e0f2fe',
  alpha = 1,
  role = 'sector',
  blendMode = null,
  mask = null
} = {}) {
  return group('sector', [
    sector({
      role,
      x,
      y,
      radius,
      startAngle,
      endAngle,
      fill,
      stroke,
      alpha,
      blendMode,
      mask
    })
  ], {
    x: x - radius,
    y: y - radius,
    width: radius * 2,
    height: radius * 2
  });
}

export function createBezierPrimitive({
  start = { x: 0, y: 0 },
  cp1 = { x: 0, y: 0 },
  cp2 = { x: 0, y: 0 },
  end = { x: 0, y: 0 },
  fill = null,
  stroke = '#e0f2fe',
  alpha = 1,
  lineWidth = 1,
  role = 'bezier',
  blendMode = null,
  mask = null
} = {}) {
  const points = [start, cp1, cp2, end].map(normalizePoint);
  return group('bezier', [
    bezier({
      role,
      start: points[0],
      cp1: points[1],
      cp2: points[2],
      end: points[3],
      fill,
      stroke,
      alpha,
      lineWidth,
      blendMode,
      mask
    })
  ], boundsFromPoints(points));
}

export function createPolygonPrimitive({
  points = [],
  fill = '#38bdf8',
  stroke = '#e0f2fe',
  alpha = 1,
  role = 'polygon',
  blendMode = null,
  mask = null
} = {}) {
  const normalizedPoints = (Array.isArray(points) ? points : []).map(normalizePoint);
  return group('polygon', [
    polygon({
      role,
      points: normalizedPoints,
      fill,
      stroke,
      alpha,
      blendMode,
      mask
    })
  ], boundsFromPoints(normalizedPoints));
}

export function createRichTextPrimitive({
  x = 0,
  y = 0,
  layout = null,
  alpha = 1,
  role = 'rich-text',
  blendMode = null,
  mask = null
} = {}) {
  const width = number(layout?.width, 0);
  const height = number(layout?.height, 0);
  return group('rich-text', [
    richText({
      role,
      x,
      y,
      layout,
      alpha,
      blendMode,
      mask
    })
  ], { x, y, width, height });
}

export function linearGradientFill({
  x0 = 0,
  y0 = 0,
  x1 = 0,
  y1 = 0,
  stops = []
} = {}) {
  return normalizeFill({
    type: 'linear-gradient',
    x0,
    y0,
    x1,
    y1,
    stops
  });
}

export function radialGradientFill({
  x0 = 0,
  y0 = 0,
  r0 = 0,
  x1 = 0,
  y1 = 0,
  r1 = 1,
  stops = []
} = {}) {
  return normalizeFill({
    type: 'radial-gradient',
    x0,
    y0,
    r0,
    x1,
    y1,
    r1,
    stops
  });
}

export function conicGradientFill({
  x = 0,
  y = 0,
  startAngle = 0,
  stops = []
} = {}) {
  return normalizeFill({
    type: 'conic-gradient',
    x,
    y,
    startAngle,
    stops
  });
}

export function textureFill({
  source = null,
  repetition = 'repeat'
} = {}) {
  return normalizeFill({
    type: 'texture',
    source,
    repetition
  });
}

export function createCapsulePrimitive({
  x = 0,
  y = 0,
  width = 120,
  height = 48,
  fill = '#475569',
  stroke = '#cbd5e1',
  alpha = 1,
  windowCount = 2,
  windowFill = '#67e8f9'
} = {}) {
  const radius = height / 2;
  const commands = [
    capsule({
      role: 'cabin',
      x,
      y,
      width,
      height,
      radius,
      fill,
      stroke,
      alpha
    })
  ];
  const usableWidth = Math.max(1, width - radius * 2);
  const count = Math.max(1, Number(windowCount || 1));
  for (let index = 0; index < count; index += 1) {
    const progress = count === 1 ? 0.5 : index / (count - 1);
    const cx = x + radius + usableWidth * progress;
    commands.push(ring({
      role: 'window',
      x: cx,
      y: y + height * 0.5,
      outerRadius: Math.max(6, height * 0.18),
      innerRadius: Math.max(3, height * 0.1),
      fill: windowFill,
      stroke,
      alpha: Math.min(1, alpha * 0.92)
    }));
  }
  return group('capsule', commands, { x, y, width, height });
}

export function createCodeLayerPrimitive({
  x = 0,
  y = 0,
  width = 240,
  height = 120,
  lines = [],
  fill = '#020617',
  stroke = '#22d3ee',
  color = '#bfdbfe',
  alpha = 0.48,
  font = DEFAULT_PANEL_FONT,
  lineHeight = 18
} = {}) {
  const normalizedLines = (Array.isArray(lines) && lines.length ? lines : ['// OmniCore layer'])
    .map((line) => String(line));
  const commands = [
    rect({
      role: 'glass',
      x,
      y,
      width,
      height,
      fill,
      stroke,
      alpha
    }),
    rect({
      role: 'scanline',
      x,
      y: y + height * 0.28,
      width,
      height: Math.max(2, height * 0.03),
      fill: stroke,
      alpha: Math.min(1, alpha * 0.55)
    })
  ];
  normalizedLines.slice(0, Math.floor((height - 18) / lineHeight)).forEach((line, index) => {
    commands.push(text({
      role: 'code',
      text: line,
      x: x + 12,
      y: y + 22 + index * lineHeight,
      fill: color,
      alpha: Math.min(1, alpha + 0.28),
      font
    }));
  });
  return group('code-layer', commands, { x, y, width, height });
}

export function expandVectorPrimitive(primitive) {
  if (!primitive) return [];
  if (Array.isArray(primitive)) return primitive.flatMap((item) => expandVectorPrimitive(item));
  if (Array.isArray(primitive.commands)) {
    return primitive.commands.flatMap((command) => expandVectorPrimitive(command));
  }
  if (primitive.op) return [normalizeCommand(primitive)];
  return [];
}

export function vectorPrimitiveToSvg(primitives, {
  width = 640,
  height = 360,
  background = 'transparent'
} = {}) {
  const items = Array.isArray(primitives) ? primitives : [primitives];
  const body = items.map((primitive) => {
    const commands = expandVectorPrimitive(primitive);
    const type = primitive?.type || 'primitive';
    return `<g data-primitive="${escapeAttr(type)}">${commands.map(commandToSvg).join('')}</g>`;
  }).join('');
  const backgroundNode = background === 'transparent'
    ? ''
    : `<rect width="100%" height="100%" fill="${escapeAttr(background)}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${number(width)}" height="${number(height)}" viewBox="0 0 ${number(width)} ${number(height)}">${backgroundNode}${body}</svg>`;
}

function group(type, commands, bounds) {
  return {
    type,
    bounds,
    commands: commands.map(normalizeCommand)
  };
}

function rect(command) {
  return normalizeCommand({ op: 'rect', ...command });
}

function polygon(command) {
  return normalizeCommand({ op: 'polygon', ...command });
}

function sector(command) {
  return normalizeCommand({ op: 'sector', ...command });
}

function bezier(command) {
  return normalizeCommand({ op: 'bezier', ...command });
}

function ring(command) {
  return normalizeCommand({ op: 'ring', fillRule: 'evenodd', ...command });
}

function capsule(command) {
  return normalizeCommand({ op: 'capsule', ...command });
}

function text(command) {
  return normalizeCommand({ op: 'text', ...command });
}

function richText(command) {
  return normalizeCommand({ op: 'richText', ...command });
}

function normalizeCommand(command = {}) {
  const normalized = {
    ...command,
    op: command.op || 'rect',
    role: command.role || command.op || 'shape',
    fill: normalizeFill(command.fill ?? command.color ?? '#ffffff'),
    stroke: command.stroke ?? null,
    alpha: Number(command.alpha ?? 1)
  };
  if (command.mask) normalized.mask = command.mask;
  if (command.blendMode) normalized.blendMode = String(command.blendMode);
  if (command.lineWidth != null) normalized.lineWidth = Math.max(0, number(command.lineWidth, 1));
  if (normalized.op === 'rect' || normalized.op === 'capsule') {
    normalized.x = number(normalized.x);
    normalized.y = number(normalized.y);
    normalized.width = number(normalized.width, 1);
    normalized.height = number(normalized.height, 1);
  }
  if (normalized.op === 'polygon') {
    normalized.points = (Array.isArray(normalized.points) ? normalized.points : []).map((point) => ({
      x: number(point.x),
      y: number(point.y)
    }));
  }
  if (normalized.op === 'sector') {
    normalized.x = number(normalized.x);
    normalized.y = number(normalized.y);
    normalized.radius = Math.max(0, number(normalized.radius, 1));
    normalized.startAngle = number(normalized.startAngle);
    normalized.endAngle = number(normalized.endAngle, Math.PI * 2);
  }
  if (normalized.op === 'bezier') {
    normalized.start = normalizePoint(normalized.start);
    normalized.cp1 = normalizePoint(normalized.cp1);
    normalized.cp2 = normalizePoint(normalized.cp2);
    normalized.end = normalizePoint(normalized.end);
    normalized.fill = command.fill == null ? null : normalizeFill(command.fill);
    normalized.stroke = command.stroke ?? '#ffffff';
    normalized.lineWidth = Math.max(0, number(command.lineWidth, 1));
  }
  if (normalized.op === 'ring') {
    normalized.x = number(normalized.x);
    normalized.y = number(normalized.y);
    normalized.outerRadius = number(normalized.outerRadius, 1);
    normalized.innerRadius = Math.max(0, number(normalized.innerRadius, normalized.outerRadius * 0.5));
    normalized.fillRule = normalized.fillRule || 'evenodd';
  }
  if (normalized.op === 'capsule') {
    normalized.radius = Math.max(0, Math.min(normalized.height / 2, number(normalized.radius, normalized.height / 2)));
  }
  if (normalized.op === 'text') {
    normalized.text = String(normalized.text ?? '');
    normalized.x = number(normalized.x);
    normalized.y = number(normalized.y);
    normalized.font = normalized.font || DEFAULT_PANEL_FONT;
  }
  if (normalized.op === 'richText') {
    normalized.x = number(normalized.x);
    normalized.y = number(normalized.y);
    normalized.layout = normalizeRichTextLayout(normalized.layout);
  }
  return normalized;
}

function commandToSvg(command) {
  if (command.op === 'rect') {
    return `<rect ${attrs({
      x: command.x,
      y: command.y,
      width: command.width,
      height: command.height,
      ...svgFillAttrs(command.fill),
      stroke: command.stroke,
      opacity: command.alpha
    })}/>`;
  }
  if (command.op === 'polygon') {
    return `<polygon ${attrs({
      points: command.points.map((point) => `${point.x},${point.y}`).join(' '),
      ...svgFillAttrs(command.fill),
      stroke: command.stroke,
      opacity: command.alpha
    })}/>`;
  }
  if (command.op === 'sector') {
    return `<path ${attrs({
      d: sectorPath(command),
      ...svgFillAttrs(command.fill),
      stroke: command.stroke,
      opacity: command.alpha
    })}/>`;
  }
  if (command.op === 'bezier') {
    return `<path ${attrs({
      d: bezierPath(command),
      fill: command.fill ? svgFillValue(command.fill) : 'none',
      'data-fill-type': command.fill?.type || null,
      stroke: command.stroke,
      'stroke-width': command.lineWidth,
      opacity: command.alpha
    })}/>`;
  }
  if (command.op === 'ring') {
    const d = [
      circlePath(command.x, command.y, command.outerRadius, false),
      circlePath(command.x, command.y, command.innerRadius, true)
    ].join(' ');
    return `<path ${attrs({
      d,
      ...svgFillAttrs(command.fill),
      stroke: command.stroke,
      opacity: command.alpha,
      'fill-rule': command.fillRule
    })}/>`;
  }
  if (command.op === 'capsule') {
    return `<path ${attrs({
      d: capsulePath(command),
      ...svgFillAttrs(command.fill),
      stroke: command.stroke,
      opacity: command.alpha
    })}/>`;
  }
  if (command.op === 'text') {
    return `<text ${attrs({
      x: command.x,
      y: command.y,
      ...svgFillAttrs(command.fill),
      opacity: command.alpha,
      'font-family': 'monospace',
      'font-size': 13
    })}>${escapeHtml(command.text)}</text>`;
  }
  if (command.op === 'richText') {
    return command.layout.lines.map((line, lineIndex) => line.segments.map((segment) => `<text ${attrs({
      x: command.x + segment.x,
      y: command.y + line.y,
      fill: segment.fill,
      stroke: segment.stroke,
      opacity: command.alpha,
      'font-family': segment.fontFamily,
      'font-size': segment.fontSize,
      'data-line': lineIndex
    })}>${escapeHtml(segment.text)}</text>`).join('')).join('');
  }
  return '';
}

function sectorPath({ x, y, radius, startAngle, endAngle }) {
  const start = polarPoint(x, y, radius, startAngle);
  const end = polarPoint(x, y, radius, endAngle);
  const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
  const sweep = endAngle >= startAngle ? 1 : 0;
  return [
    `M ${x} ${y}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`,
    'Z'
  ].join(' ');
}

function bezierPath({ start, cp1, cp2, end }) {
  return `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y}`;
}

function circlePath(cx, cy, radius, reverse) {
  const sweep = reverse ? 0 : 1;
  const start = cx + radius;
  const end = cx - radius;
  return `M ${start} ${cy} A ${radius} ${radius} 0 1 ${sweep} ${end} ${cy} A ${radius} ${radius} 0 1 ${sweep} ${start} ${cy}`;
}

function polarPoint(cx, cy, radius, angle) {
  return {
    x: number(cx + Math.cos(angle) * radius),
    y: number(cy + Math.sin(angle) * radius)
  };
}

function capsulePath({ x, y, width, height, radius }) {
  const right = x + width;
  const bottom = y + height;
  const r = Math.min(radius, width / 2, height / 2);
  return [
    `M ${x + r} ${y}`,
    `L ${right - r} ${y}`,
    `Q ${right} ${y} ${right} ${y + r}`,
    `L ${right} ${bottom - r}`,
    `Q ${right} ${bottom} ${right - r} ${bottom}`,
    `L ${x + r} ${bottom}`,
    `Q ${x} ${bottom} ${x} ${bottom - r}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    'Z'
  ].join(' ');
}

function attrs(values) {
  return Object.entries(values)
    .filter(([, value]) => value != null && value !== false)
    .map(([key, value]) => `${key}="${escapeAttr(value)}"`)
    .join(' ');
}

function normalizePoint(value = {}) {
  return {
    x: number(value.x),
    y: number(value.y)
  };
}

function boundsFromPoints(points = []) {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = points.map((item) => number(item.x));
  const ys = points.map((item) => number(item.y));
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY
  };
}

function normalizeFill(fill) {
  if (!fill || typeof fill !== 'object') return fill;
  if (fill.type === 'linear-gradient') {
    return {
      type: 'linear-gradient',
      x0: number(fill.x0),
      y0: number(fill.y0),
      x1: number(fill.x1),
      y1: number(fill.y1),
      stops: normalizeStops(fill.stops)
    };
  }
  if (fill.type === 'radial-gradient') {
    return {
      type: 'radial-gradient',
      x0: number(fill.x0),
      y0: number(fill.y0),
      r0: Math.max(0, number(fill.r0)),
      x1: number(fill.x1),
      y1: number(fill.y1),
      r1: Math.max(0, number(fill.r1, 1)),
      stops: normalizeStops(fill.stops)
    };
  }
  if (fill.type === 'texture') {
    return {
      type: 'texture',
      source: fill.source || null,
      repetition: fill.repetition || 'repeat'
    };
  }
  return { ...fill };
}

function normalizeStops(stops = []) {
  return (Array.isArray(stops) ? stops : []).map((stop) => {
    if (Array.isArray(stop)) return { offset: number(stop[0]), color: String(stop[1] ?? '#ffffff') };
    return { offset: number(stop.offset), color: String(stop.color ?? '#ffffff') };
  });
}

function normalizeRichTextLayout(layout = {}) {
  return {
    width: number(layout.width),
    height: number(layout.height),
    lineHeight: number(layout.lineHeight, 16),
    lines: (Array.isArray(layout.lines) ? layout.lines : []).map((line) => ({
      y: number(line.y),
      width: number(line.width),
      segments: (Array.isArray(line.segments) ? line.segments : []).map((segment) => ({
        text: String(segment.text ?? ''),
        x: number(segment.x),
        width: number(segment.width),
        fill: segment.fill || '#ffffff',
        stroke: segment.stroke || null,
        lineWidth: number(segment.lineWidth, 1),
        font: segment.font || `${number(segment.fontSize, 16)}px ${segment.fontFamily || 'sans-serif'}`,
        fontSize: number(segment.fontSize, 16),
        fontFamily: segment.fontFamily || 'sans-serif',
        shadow: segment.shadow || null
      }))
    }))
  };
}

function svgFillAttrs(fill) {
  return {
    fill: svgFillValue(fill),
    'data-fill-type': fill && typeof fill === 'object' ? fill.type : null
  };
}

function svgFillValue(fill) {
  if (!fill || typeof fill !== 'object') return fill;
  if (fill.type === 'texture') return `url(#${escapeAttr(fill.source?.id || 'texture')})`;
  if (fill.stops?.[0]?.color) return fill.stops[0].color;
  return '#ffffff';
}

function number(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

export default {
  createBezierPrimitive,
  createCapsulePrimitive,
  createCodeLayerPrimitive,
  createHousePrimitive,
  createPolygonPrimitive,
  createRichTextPrimitive,
  createRingPrimitive,
  createSectorPrimitive,
  expandVectorPrimitive,
  linearGradientFill,
  radialGradientFill,
  textureFill,
  vectorPrimitiveToSvg
};
