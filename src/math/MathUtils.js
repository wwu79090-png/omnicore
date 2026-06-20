function pointFromArgs(args, offset = 0) {
  const first = args[offset];
  if (first && typeof first === 'object') {
    return {
      x: Number(first.x ?? first[0] ?? 0),
      y: Number(first.y ?? first[1] ?? 0)
    };
  }
  return {
    x: Number(args[offset] ?? 0),
    y: Number(args[offset + 1] ?? 0)
  };
}

export function distance(...args) {
  const a = pointFromArgs(args, 0);
  const b = args[0] && typeof args[0] === 'object'
    ? pointFromArgs(args, 1)
    : pointFromArgs(args, 2);
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function isInRadius(...args) {
  const radius = args[0] && typeof args[0] === 'object'
    ? Number(args[2] ?? 0)
    : Number(args[4] ?? 0);
  return distance(...args) <= radius;
}

const MathUtils = { distance, isInRadius };

export default MathUtils;
