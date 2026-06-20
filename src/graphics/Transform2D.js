function number(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function multiply(left, right) {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5]
  ];
}

function vectorProxy(owner, xKey, yKey, defaults = {}) {
  let x = number(defaults.x);
  let y = number(defaults.y);
  return {
    get x() {
      return owner && xKey in owner ? number(owner[xKey], x) : x;
    },
    set x(value) {
      x = number(value);
      if (owner) owner[xKey] = x;
    },
    get y() {
      return owner && yKey in owner ? number(owner[yKey], y) : y;
    },
    set y(value) {
      y = number(value);
      if (owner) owner[yKey] = y;
    }
  };
}

function localValueTransform(owner, options = {}) {
  let rotation = number(options.rotation ?? owner?.rotation);
  const scale = vectorProxy(owner, 'scaleX', 'scaleY', { x: options.scale?.x ?? 1, y: options.scale?.y ?? 1 });
  let skew = { x: number(options.skew?.x), y: number(options.skew?.y) };
  let pivot = { x: number(options.pivot?.x), y: number(options.pivot?.y) };
  const transform = {
    position: vectorProxy(owner, 'x', 'y', options.position || {}),
    get rotation() {
      return owner && 'rotation' in owner ? number(owner.rotation, rotation) : rotation;
    },
    set rotation(value) {
      rotation = number(value);
      if (owner) owner.rotation = rotation;
    },
    get scale() {
      return scale;
    },
    set scale(value) {
      scale.x = number(value?.x, 1);
      scale.y = number(value?.y, 1);
    },
    get skew() {
      return skew;
    },
    set skew(value) {
      skew = { x: number(value?.x), y: number(value?.y) };
    },
    get pivot() {
      return pivot;
    },
    set pivot(value) {
      pivot = { x: number(value?.x), y: number(value?.y) };
    }
  };
  return transform;
}

export const Transform2D = {
  identity() {
    return [1, 0, 0, 1, 0, 0];
  },

  create(owner = null, options = {}) {
    return localValueTransform(owner, options);
  },

  multiply,

  localMatrix(target = {}) {
    const transform = target.transform || Transform2D.create(target);
    const position = transform.position || {};
    const scale = transform.scale || {};
    const skew = transform.skew || {};
    const pivot = transform.pivot || {};
    const cos = Math.cos(number(transform.rotation));
    const sin = Math.sin(number(transform.rotation));
    const translate = [1, 0, 0, 1, number(position.x ?? target.x), number(position.y ?? target.y)];
    const rotate = [cos, sin, -sin, cos, 0, 0];
    const skewMatrix = [1, Math.tan(number(skew.y)), Math.tan(number(skew.x)), 1, 0, 0];
    const scaleMatrix = [number(scale.x ?? target.scaleX, 1), 0, 0, number(scale.y ?? target.scaleY, 1), 0, 0];
    const pivotMatrix = [1, 0, 0, 1, -number(pivot.x), -number(pivot.y)];
    return [translate, rotate, skewMatrix, scaleMatrix, pivotMatrix].reduce(multiply);
  },

  worldMatrix(target = {}) {
    const local = Transform2D.localMatrix(target);
    if (!target.parent || target.parent.children == null) return local;
    return multiply(Transform2D.worldMatrix(target.parent), local);
  },

  applyToContext(ctx, target = {}) {
    const transform = target.transform || Transform2D.create(target);
    const position = transform.position || {};
    const scale = transform.scale || {};
    const skew = transform.skew || {};
    const pivot = transform.pivot || {};
    ctx.translate?.(number(position.x ?? target.x), number(position.y ?? target.y));
    if (number(transform.rotation)) ctx.rotate?.(number(transform.rotation));
    if (number(skew.x) || number(skew.y)) ctx.transform?.(1, Math.tan(number(skew.y)), Math.tan(number(skew.x)), 1, 0, 0);
    ctx.scale?.(number(scale.x ?? target.scaleX, 1), number(scale.y ?? target.scaleY, 1));
    if (number(pivot.x) || number(pivot.y)) ctx.translate?.(-number(pivot.x), -number(pivot.y));
  }
};

export default Transform2D;
