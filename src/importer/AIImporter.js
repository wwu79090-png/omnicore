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
