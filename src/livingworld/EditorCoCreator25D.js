function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function includesAny(text, tokens) {
  return tokens.some((token) => text.includes(token));
}

function entityText(entity) {
  return normalizeText(`${entity?.id || ''} ${entity?.type || ''} ${entity?.name || ''}`);
}

function resolveAnchor(scene, prompt) {
  const entities = Array.isArray(scene?.entities) ? scene.entities : [];
  const promptText = normalizeText(prompt);
  const wantsMoon = includesAny(promptText, ['moon', '月亮']);
  const wantsForest = includesAny(promptText, ['forest', '树林', '森林', '林']);
  const anchorKind = wantsMoon ? 'moon' : (wantsForest ? 'forest' : 'scene');
  const tokens = anchorKind === 'moon'
    ? ['moon', '月亮']
    : ['forest', '树林', '森林'];
  const anchor = entities.find((entity) => includesAny(entityText(entity), tokens));
  return { anchor, anchorKind };
}

function number(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function boundsOf(entity) {
  return {
    width: number(entity?.bounds?.width ?? entity?.width, 96),
    height: number(entity?.bounds?.height ?? entity?.height, 96)
  };
}

export class EditorCoCreator25D {
  constructor({ debug = false } = {}) {
    this.debug = Boolean(debug);
  }

  plan({ prompt = '', scene = {}, terrain = null, availableAssets = [] } = {}) {
    const text = normalizeText(prompt);
    const { anchor, anchorKind } = resolveAnchor(scene, prompt);
    const warnings = [];
    if (!anchor && anchorKind !== 'scene') warnings.push(`anchor-not-found:${anchorKind}`);

    const structure = includesAny(text, ['tower', '高塔', '塔']) ? 'tower' : 'structure';
    const relation = includesAny(text, ['behind', '后']) ? 'behind' : 'near';
    const propType = includesAny(text, ['sword', '剑']) ? 'sword' : null;
    const propRelation = includesAny(text, ['on-top', 'top', '塔顶', '顶部']) ? 'on-top' : 'attached';
    const anchorId = anchor?.id ? String(anchor.id) : anchorKind;
    const entityId = `${anchorId}-${structure}`;
    const anchorBounds = boundsOf(anchor);
    const anchorX = number(anchor?.x);
    const anchorY = number(anchor?.y);
    const baselineY = relation === 'behind'
      ? anchorY + Math.max(16, anchorBounds.height * 0.35)
      : anchorY + anchorBounds.height;
    const towerX = anchorX + Math.round(anchorBounds.width * 0.5);
    const towerY = baselineY - 48;
    const confidence = warnings.length ? 0.35 : 0.86;

    return {
      protocol: 'omnicore-editor-25d-cocreation/v1',
      prompt,
      confidence,
      warnings,
      intent: {
        structure,
        placement: { relation, anchor: anchorId },
        prop: propType ? { type: propType, relation: propRelation } : null
      },
      placement: {
        entityId,
        x: towerX,
        y: towerY,
        z: 0,
        baselineY,
        terrainSample: terrain?.id || terrain?.name || null
      },
      assets: this._assetTasks({ entityId, structure, propType, availableAssets }),
      occlusion: [{
        entityId,
        anchorId,
        relation,
        baselineY,
        sortKey: baselineY
      }],
      shadows: [{
        entityId,
        type: 'ellipse',
        x: towerX,
        y: baselineY,
        radiusX: 28,
        radiusY: 10,
        opacity: 0.3
      }],
      eventGraph: this._eventGraph(entityId, propType)
    };
  }

  _assetTasks({ entityId, structure, propType, availableAssets }) {
    const assets = Array.isArray(availableAssets) ? availableAssets : [];
    const reuse = (kind) => assets.find((asset) => (
      normalizeText(`${asset.id || ''} ${asset.type || ''} ${asset.name || ''}`).includes(kind)
    ));
    return [
      {
        kind: 'model-task',
        id: `${entityId}-model`,
        target: structure,
        prompt: `Generate a 2.5D ${structure} model`,
        reuseAssetId: reuse(structure)?.id || null
      },
      {
        kind: 'model-task',
        id: `${entityId}-${propType || 'prop'}-model`,
        target: propType || 'prop',
        prompt: `Generate a 2.5D ${propType || 'prop'} for ${structure}`,
        reuseAssetId: propType ? reuse(propType)?.id || null : null
      }
    ];
  }

  _eventGraph(entityId, propType) {
    return {
      format: 'OmniCore.VisualEventGraph',
      version: 1,
      nodes: [
        {
          id: propType === 'sword' ? 'inspect-sword' : 'inspect-prop',
          type: 'interaction',
          entityId,
          action: 'inspect'
        }
      ],
      edges: []
    };
  }
}

export default EditorCoCreator25D;
