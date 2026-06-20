export function Grid(options = {}) {
  const {
    debug = false,
    width = 0,
    height = 0,
    cellSize = 32,
    color = 'rgba(255, 255, 255, 0.2)',
    lineWidth = 1,
    canvas = null,
    context = null
  } = options;
  const enabled = Boolean(debug);
  const grid = {
    enabled,
    width: Number(width) || 0,
    height: Number(height) || 0,
    cellSize: Math.max(1, Number(cellSize) || 32),
    color,
    lineWidth,
    lines: [],
    draw(targetContext = context || canvas?.getContext?.('2d')) {
      if (!this.enabled || !targetContext) return this;
      targetContext.save?.();
      targetContext.strokeStyle = this.color;
      targetContext.lineWidth = this.lineWidth;
      targetContext.beginPath?.();
      for (const line of this.lines) {
        targetContext.moveTo?.(line.x1, line.y1);
        targetContext.lineTo?.(line.x2, line.y2);
      }
      targetContext.stroke?.();
      targetContext.restore?.();
      return this;
    }
  };

  if (!enabled) return grid;
  for (let x = 0; x <= grid.width; x += grid.cellSize) {
    grid.lines.push({ x1: x, y1: 0, x2: x, y2: grid.height });
  }
  if (grid.lines.at(-1)?.x1 !== grid.width) {
    grid.lines.push({ x1: grid.width, y1: 0, x2: grid.width, y2: grid.height });
  }
  for (let y = 0; y <= grid.height; y += grid.cellSize) {
    grid.lines.push({ x1: 0, y1: y, x2: grid.width, y2: y });
  }
  if (grid.lines.at(-1)?.y1 !== grid.height) {
    grid.lines.push({ x1: 0, y1: grid.height, x2: grid.width, y2: grid.height });
  }
  grid.draw();
  return grid;
}

export default Grid;
