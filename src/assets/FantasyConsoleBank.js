import { createOmniError } from '../core/OmniError.js';

export class FantasyConsoleBank {
  constructor({ palette = [], sprites = {}, map = [], sounds = {} } = {}) {
    this.palette = palette.map(String);
    this.sprites = clone(sprites || {});
    this.map = clone(map || []);
    this.sounds = clone(sounds || {});
  }

  sprite(id) {
    const sprite = this.sprites[id];
    if (!sprite) throw createOmniError('FantasyConsoleBank', `Sprite is not registered: ${id}`);
    return clone(sprite);
  }

  tileAt(x, y) {
    return this.map[y]?.[x] ?? null;
  }

  exportCartridge({ name = 'cart' } = {}) {
    return {
      name,
      palette: [...this.palette],
      sprites: Object.keys(this.sprites).sort(),
      sounds: Object.keys(this.sounds).sort(),
      mapSize: {
        width: Math.max(0, ...this.map.map((row) => row.length)),
        height: this.map.length
      }
    };
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default FantasyConsoleBank;
