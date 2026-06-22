export class TilemapAuthoringTools {
  constructor(tilemap) {
    this.tilemap = tilemap;
  }

  previewBrush(layerName, origin = {}, stamp = [[]]) {
    const layer = this.tilemap.getTileLayer(layerName);
    const edits = [];
    const startX = Number(origin.x || 0);
    const startY = Number(origin.y || 0);
    for (let row = 0; row < stamp.length; row += 1) {
      for (let column = 0; column < (stamp[row] || []).length; column += 1) {
        const to = stamp[row][column];
        if (to == null) continue;
        const x = startX + column;
        const y = startY + row;
        edits.push({
          layer: layer?.name || layerName,
          x,
          y,
          from: layer?.tileAt?.(x, y) || 0,
          to
        });
      }
    }
    return {
      layer: layer?.name || layerName,
      edits,
      worldBounds: {
        x: startX * this.tilemap.tileWidth,
        y: startY * this.tilemap.tileHeight,
        width: (stamp[0]?.length || 0) * this.tilemap.tileWidth,
        height: stamp.length * this.tilemap.tileHeight
      }
    };
  }

  collisionOverlay(layerName, options = {}) {
    const layer = this.tilemap.getTileLayer(layerName);
    const report = this.tilemap.constructor.bakeStaticCollision({
      ...(layer || {}),
      tileWidth: layer?.tileWidth || this.tilemap.tileWidth,
      tileHeight: layer?.tileHeight || this.tilemap.tileHeight,
      collisionTileIds: options.collisionTileIds
    });
    return {
      layer: layer?.name || layerName,
      polygons: report.polygons,
      colliderCount: report.colliderCount,
      sourceTiles: report.sourceTiles
    };
  }
}

export default TilemapAuthoringTools;
