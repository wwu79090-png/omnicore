import { createOmniError } from '../core/OmniError.js';

/**
 * Natural language scene importer backed by an LLM endpoint.
 *
 * @example
 * const importer = new AIImporter({ endpoint: '/api/llm' });
 * const sceneJson = await importer.generateScene('maze with 3 monsters');
 */
export class AIImporter {
  constructor({
    endpoint = '',
    model = 'omnicore-level-designer',
    fetcher = globalThis.fetch?.bind(globalThis),
    injectScene = null
  } = {}) {
    this.endpoint = endpoint;
    this.model = model;
    this.fetcher = fetcher;
    this.injectScene = injectScene;
  }

  async generateScene(prompt, options = {}) {
    let scene = null;
    if (this.endpoint || options.endpoint) {
      scene = await this._requestScene(prompt, options);
    } else if (this.fetcher) {
      try {
        scene = await this._requestScene(prompt, options);
      } catch {
        scene = null;
      }
    }

    const result = scene || this._generateLocalScene(prompt);
    this.injectScene?.(result);
    return result;
  }

  generate25DLevel({ name = 'ai-25d-level', boundaries = [] } = {}) {
    const assets = [];
    const entities = [];
    const shadows = [];
    const depthOcclusion = [];
    boundaries.forEach((boundary, index) => {
      const center = centroid(boundary.points || []);
      const sortY = center.y + (boundary.type === 'forest' ? 24 : 8);
      if (boundary.type === 'river') {
        const asset = {
          id: `river-${index}`,
          kind: 'water-plane',
          model: 'models/water-plane.glb',
          x: center.x,
          y: center.y,
          z: -0.1,
          sortY
        };
        assets.push(asset);
        entities.push({ ...asset, type: 'Dimension3DModel' });
      } else if (boundary.type === 'forest') {
        for (let tree = 0; tree < Math.max(1, Math.min(4, (boundary.points || []).length)); tree += 1) {
          const asset = {
            id: `tree-${index}-${tree}`,
            kind: 'tree-model',
            model: 'models/tree-lowpoly.glb',
            x: center.x + tree * 18,
            y: center.y + tree * 10,
            z: 1 + tree * 0.1,
            sortY: sortY + tree * 10
          };
          assets.push(asset);
          entities.push({ ...asset, type: 'Dimension3DModel' });
          shadows.push({
            id: `${asset.id}-shadow`,
            source: asset.id,
            x: asset.x + 8,
            y: asset.y + 14,
            alpha: 0.28
          });
        }
      }
    });
    for (const entity of entities) {
      depthOcclusion.push({
        id: entity.id,
        sortY: Number(entity.sortY || entity.y || 0),
        z: Number(entity.z || 0),
        shadow: shadows.find((shadow) => shadow.source === entity.id)?.id || null
      });
    }
    entities.sort((left, right) => Number(left.sortY || 0) - Number(right.sortY || 0));
    return {
      format: 'OmniCore.25DProceduralLevel',
      version: 1,
      name,
      assets,
      entities,
      shadows,
      depthOcclusion
    };
  }

  async _requestScene(prompt, options = {}) {
    if (!this.fetcher) throw createOmniError('AIImporter', 'AI 场景导入需要可用的 fetcher 或本地回退。');
    const response = await this.fetcher(options.endpoint || this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
      body: JSON.stringify({
        model: options.model || this.model,
        prompt,
        format: 'omnicore.scene.v1'
      })
    });
    if (!response.ok) throw createOmniError('AIImporter', `AI 场景请求失败，HTTP ${response.status || 500}`);
    const data = await response.json();
    return data.scene || data;
  }

  _generateLocalScene(prompt) {
    const monsterCount = readCount(prompt, ['monster', 'monsters', '怪物']) || 1;
    const chestCount = readCount(prompt, ['chest', 'chests', '宝箱']) || 0;
    const children = [];
    for (let index = 0; index < monsterCount; index += 1) {
      children.push({ type: 'sprite', name: `monster-${index + 1}`, texture: 'enemy', x: 64 + index * 48, y: 96 });
    }
    for (let index = 0; index < chestCount; index += 1) {
      children.push({ type: 'sprite', name: `chest-${index + 1}`, texture: 'chest', x: 96 + index * 64, y: 180 });
    }
    return {
      name: /maze|迷宫/i.test(prompt) ? 'maze' : 'ai-scene',
      type: 'scene',
      children
    };
  }
}

function centroid(points = []) {
  if (!points.length) return { x: 0, y: 0 };
  const sum = points.reduce((acc, point) => ({
    x: acc.x + Number(point.x || 0),
    y: acc.y + Number(point.y || 0)
  }), { x: 0, y: 0 });
  return {
    x: sum.x / points.length,
    y: sum.y / points.length
  };
}

function readCount(prompt, labels) {
  for (const label of labels) {
    const direct = new RegExp(`(\\d+)\\s*${label}`, 'i').exec(prompt);
    if (direct) return Number(direct[1]);
  }
  if (labels.includes('怪物')) {
    if (/三个怪物/.test(prompt)) return 3;
    if (/两个怪物/.test(prompt)) return 2;
    if (/一个怪物/.test(prompt)) return 1;
  }
  if (labels.includes('宝箱')) {
    if (/三个宝箱/.test(prompt)) return 3;
    if (/两个宝箱/.test(prompt)) return 2;
    if (/一个宝箱/.test(prompt)) return 1;
  }
  return 0;
}

export default AIImporter;
