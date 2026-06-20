import Transform2D from '../graphics/Transform2D.js';
import { Sprite } from './Scene.js';

function number(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export class TileSprite extends Sprite {
  constructor(texture, options = {}) {
    super(texture, options);
    this.type = 'tile-sprite';
    this.tilePosition = {
      x: number(options.tilePosition?.x),
      y: number(options.tilePosition?.y)
    };
    this.tileScale = {
      x: number(options.tileScale?.x, 1),
      y: number(options.tileScale?.y, 1)
    };
  }

  render(ctx) {
    if (!this.visible || !ctx) return;
    ctx.save?.();
    ctx.globalAlpha = this.alpha;
    Transform2D.applyToContext(ctx, this);
    const pattern = ctx.createPattern?.(this.texture, 'repeat');
    ctx.fillStyle = pattern || this.color || '#38bdf8';
    ctx.save?.();
    ctx.translate?.(this.tilePosition.x, this.tilePosition.y);
    ctx.scale?.(this.tileScale.x, this.tileScale.y);
    ctx.fillRect?.(
      -this.tilePosition.x / this.tileScale.x,
      -this.tilePosition.y / this.tileScale.y,
      this.width / this.tileScale.x,
      this.height / this.tileScale.y
    );
    ctx.restore?.();
    this.renderChildren(ctx);
    ctx.restore?.();
  }
}

export default TileSprite;
