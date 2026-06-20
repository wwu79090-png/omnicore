function number(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function point(value = {}) {
  return { x: number(value.x), y: number(value.y) };
}

function rectFromPoints(points) {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = points.map((item) => item.x);
  const ys = points.map((item) => item.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY
  };
}

function rectsIntersect(left, right) {
  return left.x <= right.x + right.width
    && left.x + left.width >= right.x
    && left.y <= right.y + right.height
    && left.y + left.height >= right.y;
}

function polygonContains(points, x, y) {
  let inside = false;
  for (let current = 0, previous = points.length - 1; current < points.length; previous = current, current += 1) {
    const a = points[current];
    const b = points[previous];
    const crosses = ((a.y > y) !== (b.y > y))
      && (x < ((b.x - a.x) * (y - a.y)) / ((b.y - a.y) || Number.EPSILON) + a.x);
    if (crosses) inside = !inside;
  }
  return inside;
}

function orientation(a, b, c) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return b.x <= Math.max(a.x, c.x) + 1e-9
    && b.x + 1e-9 >= Math.min(a.x, c.x)
    && b.y <= Math.max(a.y, c.y) + 1e-9
    && b.y + 1e-9 >= Math.min(a.y, c.y);
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a, c, b)) return true;
  if (o2 === 0 && onSegment(a, d, b)) return true;
  if (o3 === 0 && onSegment(c, a, d)) return true;
  if (o4 === 0 && onSegment(c, b, d)) return true;
  return false;
}

function edges(points) {
  return points.map((from, index) => [from, points[(index + 1) % points.length]]);
}

function shapeBounds(shape) {
  if (shape?.bounds) return shape.bounds();
  if (shape?.x != null && shape?.width != null) {
    return {
      x: number(shape.x),
      y: number(shape.y),
      width: number(shape.width),
      height: number(shape.height)
    };
  }
  return { x: 0, y: 0, width: 0, height: 0 };
}

function polygonsIntersect(leftPoints, rightPoints) {
  if (!rectsIntersect(rectFromPoints(leftPoints), rectFromPoints(rightPoints))) return false;
  for (const [a, b] of edges(leftPoints)) {
    for (const [c, d] of edges(rightPoints)) {
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return polygonContains(leftPoints, rightPoints[0].x, rightPoints[0].y)
    || polygonContains(rightPoints, leftPoints[0].x, leftPoints[0].y);
}

function attachCommon(shape, containsPoint) {
  return Object.assign(shape, {
    containsPoint(x, y) {
      return containsPoint(number(x), number(y));
    },
    intersects(other) {
      if (!other) return false;
      if (shape.type === 'polygon' && other.type === 'polygon') return polygonsIntersect(shape.points, other.points);
      return rectsIntersect(shape.bounds(), shapeBounds(other));
    }
  });
}

export const Geom = {
  arc(x = 0, y = 0, radius = 1, startAngle = 0, endAngle = Math.PI * 2, anticlockwise = false) {
    const shape = {
      type: 'arc',
      x: number(x),
      y: number(y),
      radius: Math.max(0, number(radius, 1)),
      startAngle: number(startAngle),
      endAngle: number(endAngle, Math.PI * 2),
      anticlockwise: Boolean(anticlockwise),
      bounds() {
        return {
          x: this.x - this.radius,
          y: this.y - this.radius,
          width: this.radius * 2,
          height: this.radius * 2
        };
      }
    };
    return attachCommon(shape, (px, py) => Math.hypot(px - shape.x, py - shape.y) <= shape.radius + 1e-9);
  },

  ellipse(x = 0, y = 0, width = 1, height = 1) {
    const shape = {
      type: 'ellipse',
      x: number(x),
      y: number(y),
      width: Math.max(0, number(width, 1)),
      height: Math.max(0, number(height, 1)),
      bounds() {
        return {
          x: this.x - this.width / 2,
          y: this.y - this.height / 2,
          width: this.width,
          height: this.height
        };
      }
    };
    return attachCommon(shape, (px, py) => {
      const rx = shape.width / 2 || Number.EPSILON;
      const ry = shape.height / 2 || Number.EPSILON;
      return ((px - shape.x) ** 2) / (rx ** 2) + ((py - shape.y) ** 2) / (ry ** 2) <= 1 + 1e-9;
    });
  },

  line(x1 = 0, y1 = 0, x2 = 0, y2 = 0) {
    const shape = {
      type: 'line',
      x1: number(x1),
      y1: number(y1),
      x2: number(x2),
      y2: number(y2),
      bounds() {
        return rectFromPoints([{ x: this.x1, y: this.y1 }, { x: this.x2, y: this.y2 }]);
      }
    };
    return attachCommon(shape, (px, py) => {
      const a = { x: shape.x1, y: shape.y1 };
      const b = { x: shape.x2, y: shape.y2 };
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy) || Number.EPSILON;
      const distance = Math.abs((b.y - a.y) * px - (b.x - a.x) * py + b.x * a.y - b.y * a.x) / length;
      const projection = ((px - a.x) * dx + (py - a.y) * dy) / (length ** 2);
      return distance <= 1 && projection >= -1e-9 && projection <= 1 + 1e-9;
    });
  },

  polygon(points = []) {
    const shape = {
      type: 'polygon',
      points: (Array.isArray(points) ? points : []).map(point),
      bounds() {
        return rectFromPoints(this.points);
      }
    };
    return attachCommon(shape, (px, py) => polygonContains(shape.points, px, py));
  },

  triangle(x1 = 0, y1 = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0) {
    return Object.assign(Geom.polygon([
      { x: x1, y: y1 },
      { x: x2, y: y2 },
      { x: x3, y: y3 }
    ]), { type: 'triangle' });
  },

  ring({ x = 0, y = 0, outerRadius = 1, innerRadius = outerRadius * 0.5 } = {}) {
    const shape = {
      type: 'ring',
      x: number(x),
      y: number(y),
      outerRadius: Math.max(0, number(outerRadius, 1)),
      innerRadius: Math.max(0, number(innerRadius, outerRadius * 0.5)),
      bounds() {
        return {
          x: this.x - this.outerRadius,
          y: this.y - this.outerRadius,
          width: this.outerRadius * 2,
          height: this.outerRadius * 2
        };
      }
    };
    return attachCommon(shape, (px, py) => {
      const distance = Math.hypot(px - shape.x, py - shape.y);
      return distance <= shape.outerRadius + 1e-9 && distance >= shape.innerRadius - 1e-9;
    });
  },

  sector({ x = 0, y = 0, radius = 1, startAngle = 0, endAngle = Math.PI * 0.5 } = {}) {
    const shape = {
      type: 'sector',
      x: number(x),
      y: number(y),
      radius: Math.max(0, number(radius, 1)),
      startAngle: number(startAngle),
      endAngle: number(endAngle),
      bounds() {
        return {
          x: this.x - this.radius,
          y: this.y - this.radius,
          width: this.radius * 2,
          height: this.radius * 2
        };
      }
    };
    return attachCommon(shape, (px, py) => {
      const dx = px - shape.x;
      const dy = py - shape.y;
      if (Math.hypot(dx, dy) > shape.radius + 1e-9) return false;
      return angleBetween(Math.atan2(dy, dx), shape.startAngle, shape.endAngle);
    });
  },

  bezier({ start = {}, cp1 = {}, cp2 = {}, end = {} } = {}) {
    const points = [point(start), point(cp1), point(cp2), point(end)];
    return attachCommon({
      type: 'bezier',
      start: points[0],
      cp1: points[1],
      cp2: points[2],
      end: points[3],
      points,
      bounds() {
        return rectFromPoints(this.points);
      }
    }, () => false);
  },

  intersects(left, right) {
    return Boolean(left?.intersects?.(right));
  }
};

Object.defineProperties(Geom, {
  Arc: { value: Geom.arc },
  Ellipse: { value: Geom.ellipse },
  Line: { value: Geom.line },
  Polygon: { value: Geom.polygon },
  Triangle: { value: Geom.triangle }
});

function angleBetween(angle, start, end) {
  const tau = Math.PI * 2;
  const normalize = (value) => ((value % tau) + tau) % tau;
  const a = normalize(angle);
  const s = normalize(start);
  const e = normalize(end);
  return s <= e ? a >= s && a <= e : a >= s || a <= e;
}

export default Geom;
