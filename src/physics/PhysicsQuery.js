/**
 * Matter-compatible spatial query facade.
 *
 * Uses Matter.Query when available and falls back to deterministic rectangle
 * math for tests, headless runtime, and lightweight adapters.
 */
export class PhysicsQuery {
  constructor({ getBodies = () => [], getMatter = () => null } = {}) {
    this.getBodies = getBodies;
    this.getMatter = getMatter;
  }

  raycast(startX, startY, endX, endY, options = {}) {
    const start = { x: startX, y: startY };
    const end = { x: endX, y: endY };
    const bodies = this._bodies(options.bodies);
    const Matter = this.getMatter();
    const hits = Matter?.Query?.ray
      ? Matter.Query.ray(bodies, start, end, options.rayWidth || 1).map((hit) => hit.body || hit.bodyA || hit.bodyB || hit)
      : bodies.filter((body) => segmentIntersectsBounds(start, end, boundsOf(body)));

    return this._results(hits, options)
      .sort((left, right) => distanceSquared(centerOf(left.body), start) - distanceSquared(centerOf(right.body), start))
      .map((entry) => (options.includeBodies ? entry.body : entry.entity));
  }

  circle(x, y, radius, options = {}) {
    const center = { x, y };
    const bounds = {
      min: { x: x - radius, y: y - radius },
      max: { x: x + radius, y: y + radius }
    };
    const bodies = this._bodies(options.bodies);
    const Matter = this.getMatter();
    const candidates = Matter?.Query?.region ? Matter.Query.region(bodies, bounds) : bodies;
    const hits = candidates.filter((body) => circleIntersectsBounds(center, radius, boundsOf(body)));

    return this._results(hits, options)
      .sort((left, right) => distanceSquared(centerOf(left.body), center) - distanceSquared(centerOf(right.body), center))
      .map((entry) => (options.includeBodies ? entry.body : entry.entity));
  }

  _bodies(override) {
    if (Array.isArray(override)) return override;
    return this.getBodies() || [];
  }

  _results(bodies, options) {
    const seen = new Set();
    const results = [];
    for (const body of bodies) {
      if (!body) continue;
      const entity = body.entity || (options.includeBodies ? body : null);
      if (!entity || seen.has(entity)) continue;
      seen.add(entity);
      results.push({ body, entity });
    }
    return results;
  }
}

function boundsOf(body = {}) {
  if (body.bounds?.min && body.bounds?.max) return body.bounds;
  const position = body.position || { x: body.x || 0, y: body.y || 0 };
  const width = body.width || body.entity?.width || 0;
  const height = body.height || body.entity?.height || 0;
  if (body.vertices?.length) {
    const xs = body.vertices.map((point) => point.x);
    const ys = body.vertices.map((point) => point.y);
    return {
      min: { x: Math.min(...xs), y: Math.min(...ys) },
      max: { x: Math.max(...xs), y: Math.max(...ys) }
    };
  }
  return {
    min: { x: position.x - width / 2, y: position.y - height / 2 },
    max: { x: position.x + width / 2, y: position.y + height / 2 }
  };
}

function centerOf(body = {}) {
  if (body.position) return body.position;
  const bounds = boundsOf(body);
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2
  };
}

function circleIntersectsBounds(center, radius, bounds) {
  const closestX = clamp(center.x, bounds.min.x, bounds.max.x);
  const closestY = clamp(center.y, bounds.min.y, bounds.max.y);
  return distanceSquared(center, { x: closestX, y: closestY }) <= radius * radius;
}

function segmentIntersectsBounds(start, end, bounds) {
  if (pointInBounds(start, bounds) || pointInBounds(end, bounds)) return true;
  const corners = [
    { x: bounds.min.x, y: bounds.min.y },
    { x: bounds.max.x, y: bounds.min.y },
    { x: bounds.max.x, y: bounds.max.y },
    { x: bounds.min.x, y: bounds.max.y }
  ];
  for (let index = 0; index < corners.length; index += 1) {
    const next = (index + 1) % corners.length;
    if (segmentsIntersect(start, end, corners[index], corners[next])) return true;
  }
  return false;
}

function pointInBounds(point, bounds) {
  return point.x >= bounds.min.x
    && point.x <= bounds.max.x
    && point.y >= bounds.min.y
    && point.y <= bounds.max.y;
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && onSegment(a, c, b))
    || (o2 === 0 && onSegment(a, d, b))
    || (o3 === 0 && onSegment(c, a, d))
    || (o4 === 0 && onSegment(c, b, d));
}

function orientation(a, b, c) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < Number.EPSILON) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return b.x <= Math.max(a.x, c.x)
    && b.x >= Math.min(a.x, c.x)
    && b.y <= Math.max(a.y, c.y)
    && b.y >= Math.min(a.y, c.y);
}

function distanceSquared(left, right) {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default PhysicsQuery;
