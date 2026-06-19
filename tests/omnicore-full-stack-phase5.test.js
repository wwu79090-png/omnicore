import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

async function importFile(relativePath) {
  return import(pathToFileURL(path.resolve(relativePath)).href);
}

describe('OmniCore full stack phase 5 editor tilemap completion', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('paints selected tiles into active layers and auto-generates collision objects from cropped local tilesets', async () => {
    const { createEditorApp } = await importFile('packages/omnicore-editor/src/editor-app.js');
    const { createEditorState } = await importFile('packages/omnicore-editor/src/live-sync-protocol.js');
    const root = document.createElement('main');
    const sent = [];
    document.body.appendChild(root);

    const app = createEditorApp(root, {
      state: createEditorState({
        tilemap: {
          width: 4,
          height: 2,
          tileWidth: 16,
          tileHeight: 16,
          activeLayerId: 'ground',
          layers: [
            { id: 'ground', name: 'Ground', data: Array(8).fill(1) },
            { id: 'decor', name: 'Decor', data: Array(8).fill(0) }
          ],
          tilesets: [{
            name: 'local-dungeon',
            image: 'assets/tiles/dungeon.png',
            firstgid: 1,
            columns: 4,
            tilecount: 12,
            tileWidth: 16,
            tileHeight: 16,
            collisionTiles: [7]
          }]
        }
      }),
      transport: {
        send(message) {
          sent.push(JSON.parse(message));
        }
      }
    });

    const solidTile = root.querySelector('[data-tileset-tile-id="7"]');
    expect(solidTile?.dataset.tileCrop).toBe('32,16,16,16');
    solidTile.click();
    root.querySelector('[data-tile-layer-id="decor"]').click();
    root.querySelector('[data-tile-index="5"]').click();

    const state = app.getState();
    const exported = app.exportTiledJson();

    expect(state.selectedTile).toBe(7);
    expect(state.tilemap.activeLayerId).toBe('decor');
    expect(state.tilemap.layers.find((layer) => layer.id === 'ground').data[5]).toBe(1);
    expect(state.tilemap.layers.find((layer) => layer.id === 'decor').data[5]).toBe(7);
    expect(state.tilemap.collisions).toContain(5);
    expect(exported.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Ground', type: 'tilelayer', data: expect.arrayContaining([1]) }),
      expect.objectContaining({ name: 'Decor', type: 'tilelayer', data: expect.arrayContaining([7]) }),
      expect.objectContaining({
        name: 'collision',
        type: 'objectgroup',
        objects: expect.arrayContaining([
          expect.objectContaining({ name: 'collision-5', x: 16, y: 16, width: 16, height: 16 })
        ])
      })
    ]));
    expect(exported.tilesets[0]).toMatchObject({
      name: 'local-dungeon',
      image: 'assets/tiles/dungeon.png',
      tiles: expect.arrayContaining([
        expect.objectContaining({ id: 7, source: { x: 32, y: 16, width: 16, height: 16 } })
      ])
    });
    expect(sent).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'editor:update-tilemap',
        payload: expect.objectContaining({
          tilemap: expect.objectContaining({
            activeLayerId: 'decor',
            collisions: expect.arrayContaining([5])
          })
        })
      })
    ]));
  });
});
