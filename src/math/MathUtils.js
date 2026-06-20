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

export function randomBetween(min = 0, max = 1) {
  const left = Number(min);
  const right = Number(max);
  const low = Math.min(left, right);
  const high = Math.max(left, right);
  return low + Math.random() * (high - low);
}

export function lerp(start = 0, end = 1, amount = 0) {
  const t = Math.max(0, Math.min(1, Number(amount)));
  return Number(start) + (Number(end) - Number(start)) * t;
}

export function angle(...args) {
  const a = pointFromArgs(args, 0);
  const b = args[0] && typeof args[0] === 'object'
    ? pointFromArgs(args, 1)
    : pointFromArgs(args, 2);
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export function random(min = 0, max = 1) {
  if (arguments.length === 0) return Math.random();
  return randomBetween(min, max);
}

const MathUtils = { distance, isInRadius, randomBetween, lerp, angle, random };

export default MathUtils;
