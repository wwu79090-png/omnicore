const DEFAULT_RULES = [
  {
    plugin: 'PhysicsBody',
    when: ['velocity'],
    reason: '检测到 velocity 属性，可绑定物理运动组件。',
    confidence: 0.85,
    cascades: [
      {
        plugin: 'PhysicsCollision',
        reason: '建议同样配置碰撞体，避免刚体穿透。',
        confidence: 0.82
      }
    ]
  },
  {
    plugin: 'ParticleOnHit',
    when: ['health'],
    reason: '检测到 health 属性，可在受击时触发粒子反馈。',
    confidence: 0.8,
    cascades: [
      {
        plugin: 'SFXReactor',
        reason: '与受击特效配套时推荐音效处理。',
        confidence: 0.68
      }
    ]
  },
  {
    plugin: 'InventoryPanel',
    when: ['inventory'],
    reason: '检测到 inventory 属性，可接入背包 UI。',
    confidence: 0.76,
    cascades: [
      {
        plugin: 'SlotTooltip',
        reason: '背包通常会配套道具预览。',
        confidence: 0.63
      }
    ]
  },
  {
    plugin: 'DialogueTree',
    when: ['dialogue'],
    reason: '检测到 dialogue 属性，可接入对话树编辑器。',
    confidence: 0.81,
    cascades: [
      {
        plugin: 'SubtitleOverlay',
        reason: '建议配套字幕层提高对话展示体验。',
        confidence: 0.71
      }
    ]
  }
];

function normalizeWhen(rule = {}) {
  if (typeof rule.whenPredicate === 'function') return null;
  return Array.isArray(rule.when) ? rule.when.filter(Boolean) : [];
}

function normalizeCascade(cascade = {}) {
  if (typeof cascade === 'string') {
    const plugin = cascade.trim();
    if (!plugin) return null;
    return {
      plugin,
      reason: `基于级联链建议安装 ${plugin}。`,
      confidence: 0.7,
      when: null,
      cascades: []
    };
  }

  if (!cascade || !cascade.plugin) return null;
  return {
    plugin: String(cascade.plugin).trim(),
    reason: String(cascade.reason || `基于级联链建议安装 ${cascade.plugin}。`),
    confidence: Number.isFinite(cascade.confidence) ? cascade.confidence : 0.7,
    when: normalizeWhen(cascade),
    whenPredicate: cascade.whenPredicate || null,
    cascades: normalizeCascades(cascade.cascades)
  };
}

function normalizeCascades(cascades = []) {
  return (Array.isArray(cascades) ? cascades : [])
    .map((item) => normalizeCascade(item))
    .filter(Boolean);
}

function hasEntityProperty(entity, key) {
  if (!entity) return false;
  if (Object.prototype.hasOwnProperty.call(entity, key)) return entity[key] != null;
  if (entity.props && Object.prototype.hasOwnProperty.call(entity.props, key)) return entity.props[key] != null;
  if (entity.properties && Object.prototype.hasOwnProperty.call(entity.properties, key)) return entity.properties[key] != null;
  return false;
}

function clampConfidence(value, fallback = 0.5) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0.05, Math.min(1, Number(value)));
}

/**
 * Built-in rule engine for editor plugin recommendations.
 *
 * 支持：
 * - 规则级联推荐：主推荐会自动展开子推荐；
 * - 局部去重：同插件只保留最高优先级实例；
 * - 统一推荐结构：支持 reason/confidence/source/depth 透传。
 */
export class PluginRecommendationEngine {
  constructor(rules = DEFAULT_RULES) {
    this.rules = rules.map((rule) => ({
      plugin: rule.plugin,
      when: normalizeWhen(rule),
      whenPredicate: rule.whenPredicate || null,
      reason: String(rule.reason || `检测到场景特征，建议安装 ${rule.plugin}。`),
      confidence: clampConfidence(rule.confidence, 0.75),
      source: rule.source || 'builtin',
      cascades: normalizeCascades(rule.cascades)
    }));
    this.ruleIndex = new Map(this.rules.map((rule) => [rule.plugin, rule]));
  }

  recommend(entity = {}) {
    const { pluginByName, recommendations } = this._run(entity, false);
    return this._sortedRecommendations(recommendations, pluginByName);
  }

  recommendWithTree(entity = {}) {
    const { pluginByName, recommendations, roots } = this._run(entity, true);
    return {
      recommendations: this._sortedRecommendations(recommendations, pluginByName),
      tree: roots
    };
  }

  _run(entity = {}, collectTree = false) {
    const context = {
      seen: new Set(),
      recommendations: [],
      pluginByName: new Map(),
      roots: [],
      entity,
      collectTree
    };

    for (const rule of this.rules) {
      if (!this._matchRule(entity, rule)) continue;
      this._appendRecommendation(rule, context, 0);
    }

    return context;
  }

  _matchRule(entity, rule) {
    if (typeof rule.whenPredicate === 'function') {
      return Boolean(rule.whenPredicate(entity));
    }
    if (!rule.when.length) return true;
    return rule.when.some((key) => hasEntityProperty(entity, key));
  }

  _matchCascade(entity, cascade) {
    if (typeof cascade.whenPredicate === 'function') return Boolean(cascade.whenPredicate(entity));
    if (!cascade.when?.length) return true;
    return cascade.when.some((key) => hasEntityProperty(entity, key));
  }

  _appendRecommendation(rule, context, depth) {
    return this._appendCascade(rule, context, {
      depth,
      source: rule.source,
      reason: rule.reason,
      confidence: rule.confidence,
      parent: null
    });
  }

  _appendCascade(cascade, context, contextMeta = {}) {
    if (!this._matchCascade(context.entity, cascade)) return null;

    const rule = this.ruleIndex.get(cascade.plugin) || {
      plugin: cascade.plugin,
      reason: cascade.reason,
      confidence: clampConfidence(cascade.confidence),
      source: 'cascade',
      when: [],
      whenPredicate: null,
      cascades: []
    };
    const node = this._registerNode({
      plugin: rule.plugin,
      reason: cascade.reason || rule.reason,
      confidence: clampConfidence(cascade.confidence, rule.confidence),
      source: cascade.source || rule.source,
      depth: contextMeta.depth || 0,
      parent: contextMeta.parent
    }, context);

    if (context.collectTree) {
      const parentNode = contextMeta.parent ? context.pluginByName.get(contextMeta.parent) : null;
      if (parentNode) {
        if (!parentNode.cascades.some((child) => child.plugin === node.plugin)) parentNode.cascades.push(node);
      } else if (!context.roots.includes(node)) {
        context.roots.push(node);
      }
    }

    const children = (cascade.cascades && cascade.cascades.length)
      ? cascade.cascades
      : rule.cascades;
    for (const childCascade of children || []) {
      this._appendCascade(childCascade, context, {
        depth: (contextMeta.depth || 0) + 1,
        source: 'cascade',
        parent: rule.plugin
      });
    }
    return node;
  }

  _registerNode(candidate, context) {
    const existing = context.pluginByName.get(candidate.plugin);
    if (!existing) {
      const item = {
        plugin: candidate.plugin,
        reason: candidate.reason,
        confidence: candidate.confidence,
        source: candidate.source || 'builtin',
        depth: candidate.depth || 0,
        parent: candidate.parent || null,
        cascades: []
      };
      if (candidate.parent != null) item.parent = candidate.parent;
      context.recommendations.push(item);
      context.pluginByName.set(candidate.plugin, item);
      context.seen.add(candidate.plugin);
      if (!context.collectTree) item.cascades = [];
      return item;
    }

    if (candidate.confidence > existing.confidence) existing.confidence = candidate.confidence;
    if (existing.parent == null && candidate.parent != null) existing.parent = candidate.parent;
    if (candidate.source === 'builtin' && existing.source !== 'builtin') existing.source = candidate.source;
    return existing;
  }

  _sortedRecommendations(recommendations, pluginByName) {
    return [...recommendations]
      .sort((left, right) => (right.confidence - left.confidence) || left.plugin.localeCompare(right.plugin))
      .map((item) => ({
        ...item,
        cascadePlugins: item.cascades?.length ? this._collectCascadePlugins(item.cascades, pluginByName) : []
      }));
  }

  _collectCascadePlugins(cascades = [], pluginByName = new Map()) {
    const next = [];
    for (const cascade of cascades) {
      if (!cascade?.plugin) continue;
      const canonical = pluginByName.get(cascade.plugin);
      if (canonical) next.push(canonical);
      next.push(...this._collectCascadePlugins(cascade.cascades, pluginByName));
    }
    return next;
  }
}

export default PluginRecommendationEngine;
