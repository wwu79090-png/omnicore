import Tilemap from './Tilemap.js';

/**
 * Tiled JSON loader for OmniCore tilemaps.
 *
 * @example
 * const loader = new TilemapLoader();
 * const map = await loader.load('/maps/world.json');
 */
export class TilemapLoader {
  constructor({ fetcher = globalThis.fetch?.bind(globalThis) } = {}) {
    this.fetcher = fetcher;
  }

  async load(source) {
    if (typeof source === 'object') return Tilemap.parse(source);
    const response = await this.fetcher(source);
    return Tilemap.parse(await response.json());
  }
}

export default TilemapLoader;
