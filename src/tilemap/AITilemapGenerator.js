const TILE = Object.freeze({
  empty: 0,
  forest: 1,
  water: 2,
  cliff: 3,
  grass: 4
});

function fill(data, width, height, predicate, value) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (predicate(x, y)) data[y * width + x] = value;
    }
  }
}

/**
 * Deterministic prompt-to-tilemap fallback for debug tooling.
 */
export class AITilemapGenerator {
  static generate(prompt, {
    width = 16,
    height = 12,
    tileWidth = 16,
    tileHeight = 16
  } = {}) {
    const text = String(prompt || '').toLowerCase();
    const data = Array(width * height).fill(TILE.grass);
    if (/forest|森林/.test(text)) {
      fill(data, width, height, (x, y) => x < Math.ceil(width * 0.35) || y < 2, TILE.forest);
    }
    if (/lake|water|湖|河/.test(text)) {
      const cx = Math.floor(width / 2);
      const cy = Math.floor(height / 2);
      fill(data, width, height, (x, y) => Math.abs(x - cx) + Math.abs(y - cy) <= 2, TILE.water);
    }
    if (/cliff|悬崖|峭壁/.test(text)) {
      fill(data, width, height, (x) => x >= Math.floor(width * 0.75), TILE.cliff);
    }

    const tilemapJson = {
      width,
      height,
      tilewidth: tileWidth,
      tileheight: tileHeight,
      layers: [
        {
          id: 1,
          name: 'AI Terrain',
          type: 'tilelayer',
          width,
          height,
          data
        }
      ],
      properties: {
        generatedBy: 'OmniCore.AITilemapGenerator',
        prompt
      }
    };

    return {
      tilemapJson,
      sceneJson: {
        format: 'OmniCore.Scene.json',
        version: 1,
        name: 'ai-tilemap',
        entities: [
          {
            id: 'ai-terrain',
            type: 'tilemap',
            x: 0,
            y: 0,
            width: width * tileWidth,
            height: height * tileHeight,
            tileWidth,
            tileHeight,
            layer: 'AI Terrain'
          }
        ]
      },
      legend: TILE
    };
  }
}

export default AITilemapGenerator;
