/**
 * Axis-aligned rectangle utility for UI hit testing and simple bounds checks.
 *
 * @example
 * const bounds = new Rect(0, 0, 64, 64);
 * if (bounds.contains(pointer.x, pointer.y)) button.dispatch('click');
 */
export class Rect {
  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  get left() {
    return this.x;
  }

  get right() {
    return this.x + this.width;
  }

  get top() {
    return this.y;
  }

  get bottom() {
    return this.y + this.height;
  }

  contains(x, y) {
    return x >= this.left && x <= this.right && y >= this.top && y <= this.bottom;
  }

  intersects(other) {
    return this.left <= other.right && this.right >= other.left && this.top <= other.bottom && this.bottom >= other.top;
  }

  clone() {
    return new Rect(this.x, this.y, this.width, this.height);
  }
}

export default Rect;
