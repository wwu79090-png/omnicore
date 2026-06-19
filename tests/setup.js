const noop = () => {};

const canvasContext = {
  save: noop,
  restore: noop,
  clearRect: noop,
  fillRect: noop,
  strokeRect: noop,
  beginPath: noop,
  moveTo: noop,
  lineTo: noop,
  quadraticCurveTo: noop,
  closePath: noop,
  fill: noop,
  stroke: noop,
  fillText: noop,
  strokeText: noop,
  drawImage: noop,
  measureText: (text) => ({ width: String(text).length * 8 }),
  setTransform: noop,
  translate: noop,
  rotate: noop,
  scale: noop,
  getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }),
  putImageData: noop,
  globalCompositeOperation: 'source-over'
};

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value(type) {
    if (type === '2d') return { ...canvasContext, canvas: this };
    return null;
  }
});
