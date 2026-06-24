import { createArcade2DGameplayPlan } from '../physics/Arcade2DGameplayKit.js';
import Tilemap from './Tilemap.js';

export const TILEMAP_2D_25D_AUTHORING_SCHEMA = 'omnicore.tilemap-2d-25d-authoring-loop.v1';

/**
 * Builds one editor-ready 2D/2.5D authoring loop for tilemaps, stamps, animation, playtest, and save patches.
 */
export function createTilemap2D25DAuthoringLoop(config = {}) {
  const tilemap = normalizeTilemap(config.tilemap);
  const tilemapState = applyTileOperations(tilemap, config.tileOperations || config.operations || []);
  const collision = buildCollisionPainter(tilemap, config.collisionPaint || config.collision || []);
  const stamps = buildStampPlacements(tilemap, config.stampPalette || [], config.stampPlacements || []);
  const animation = buildAnimationPreview(config.animation || {}, stamps.placements);
  const playtest = buildPlaytestState(config.playtest || {}, {
    tilemapState,
    collision,
    stamps,
    animation
  });
  const savePatch = buildSavePatch({ tilemapState, collision, stamps, animation });
  const editor = buildEditorState();
  const quality = buildQualityChecks({ tilemapState, collision, stamps, animation, playtest });

  return {
    schema: TILEMAP_2D_25D_AUTHORING_SCHEMA,
    editor,
    tilemap: tilemapState,
    collision,
    stamps,
    animation,
    playtest,
    savePatch,
    quality
  };
}

function normalizeTilemap(tilemapInput = {}) {
  const source = tilemapInput instanceof Tilemap
    ? tilemapInput
    : Tilemap.parse({
      width: numberOr(tilemapInput.width, 0),
      height: numberOr(tilemapInput.height, 0),
      tilewidth: numberOr(tilemapInput.tileWidth ?? tilemapInput.tilewidth, 16),
      tileheight: numberOr(tilemapInput.tileHeight ?? tilemapInput.tileheight, 16),
      layers: Array.isArray(tilemapInput.layers) ? tilemapInput.layers : [],
      tilesets: tilemapInput.tilesets || []
    });
  const layers = new Map(source.layers.map((layer) => [
    layer.name,
    {
      ...layer,
      width: numberOr(layer.width, source.width),
      height: numberOr(layer.height, source.height),
      tileWidth: layer.tileWidth || source.tileWidth,
      tileHeight: layer.tileHeight || source.tileHeight,
      data: [...(layer.data || [])]
    }
  ]));
  return {
    width: source.width,
    height: source.height,
    tileWidth: source.tileWidth,
    tileHeight: source.tileHeight,
    layers
  };
}

function applyTileOperations(tilemap, operations) {
  const edits = [];
  const previewBounds = [];
  for (const operationInput of operations) {
    const operation = operationInput || {};
    if (operation.tool === 'brush') applyBrush(tilemap, operation, edits, previewBounds);
    else if (operation.tool === 'rect-fill') applyRectFill(tilemap, operation, edits, previewBounds);
    else if (operation.tool === 'erase') applyErase(tilemap, operation, edits, previewBounds);
    else if (operation.tool === 'selection-copy') applySelectionCopy(tilemap, operation, edits, previewBounds);
    else if (operation.tool === 'terrain-rule' || operation.tool === 'autotile') applyTerrainRule(tilemap, operation, edits, previewBounds);
  }
  return {
    format: 'omnicore.tilemap-authoring-state.v1',
    summary: {
      width: tilemap.width,
      height: tilemap.height,
      tileWidth: tilemap.tileWidth,
      tileHeight: tilemap.tileHeight,
      layerCount: tilemap.layers.size
    },
    edits,
    changedCells: edits.map((edit) => ({
      layer: edit.layer,
      x: edit.x,
      y: edit.y,
      from: edit.from,
      to: edit.to,
      tool: edit.tool
    })),
    previewBounds,
    hotReloadTopics: edits.length > 0 ? ['tilemap:changed', 'tilemap:preview-invalidated'] : []
  };
}

function applyBrush(tilemap, operation, edits, previewBounds) {
  const layer = resolveLayer(tilemap, operation.layer);
  writeTile(tilemap, layer, operation.x, operation.y, operation.tile, operation.tool, edits);
  previewBounds.push(tileBounds(tilemap, operation.x, operation.y, 1, 1, operation.tool));
}

function applyRectFill(tilemap, operation, edits, previewBounds) {
  const layer = resolveLayer(tilemap, operation.layer);
  const width = Math.max(1, Math.round(numberOr(operation.width, 1)));
  const height = Math.max(1, Math.round(numberOr(operation.height, 1)));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      writeTile(tilemap, layer, operation.x + x, operation.y + y, operation.tile, operation.tool, edits);
    }
  }
  previewBounds.push(tileBounds(tilemap, operation.x, operation.y, width, height, operation.tool));
}

function applyErase(tilemap, operation, edits, previewBounds) {
  const layer = resolveLayer(tilemap, operation.layer);
  writeTile(tilemap, layer, operation.x, operation.y, 0, operation.tool, edits);
  previewBounds.push(tileBounds(tilemap, operation.x, operation.y, 1, 1, operation.tool));
}

function applySelectionCopy(tilemap, operation, edits, previewBounds) {
  const layer = resolveLayer(tilemap, operation.layer);
  const width = Math.max(1, Math.round(numberOr(operation.width, 1)));
  const height = Math.max(1, Math.round(numberOr(operation.height, 1)));
  const copied = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) copied.push(readTile(layer, operation.x + x, operation.y + y));
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = copied[y * width + x];
      writeTile(tilemap, layer, operation.target.x + x, operation.target.y + y, tile, operation.tool, edits);
    }
  }
  previewBounds.push(tileBounds(tilemap, operation.target.x, operation.target.y, width, height, operation.tool));
}

function applyTerrainRule(tilemap, operation, edits, previewBounds) {
  const layer = resolveLayer(tilemap, operation.layer);
  const rule = operation.rule || {};
  writeTile(tilemap, layer, operation.x, operation.y, operation.tile, operation.tool, edits, { ruleId: rule.id || null });
  const neighbors = Array.isArray(rule.neighbors) && rule.neighbors.length > 0 ? rule.neighbors : ['n', 'e', 's', 'w'];
  for (const direction of neighbors) {
    const offset = neighborOffset(direction);
    writeTile(
      tilemap,
      layer,
      operation.x + offset.x,
      operation.y + offset.y,
      rule.edgeTile ?? operation.tile,
      'autotile-neighbor',
      edits,
      { ruleId: rule.id || null, direction }
    );
  }
  previewBounds.push(tileBounds(tilemap, operation.x - 1, operation.y - 1, 3, 3, operation.tool));
}

function buildCollisionPainter(tilemap, paintInput) {
  const paint = Array.isArray(paintInput) ? paintInput : [paintInput];
  const colliders = paint.filter(Boolean).map((item, index) => {
    const type = normalizeCollisionKind(item.kind || item.type);
    const collider = {
      id: item.id || `${type}-${index}`,
      type,
      x: numberOr(item.x, 0) * tilemap.tileWidth,
      y: numberOr(item.y, 0) * tilemap.tileHeight,
      width: Math.max(1, numberOr(item.width, 1)) * tilemap.tileWidth,
      height: Math.max(1, numberOr(item.height, 1)) * tilemap.tileHeight,
      velocity: normalizeVector(item.velocity),
      sourceTileRect: {
        x: numberOr(item.x, 0),
        y: numberOr(item.y, 0),
        width: Math.max(1, numberOr(item.width, 1)),
        height: Math.max(1, numberOr(item.height, 1))
      }
    };
    if (type === 'slope') collider.slope = { direction: item.direction || item.slope?.direction || 'ascending' };
    return collider;
  });
  return {
    format: 'omnicore.tilemap-collision-painter.v1',
    colliders,
    debugDraw: colliders.map((collider) => ({
      op: `debug:collision-${collider.type}`,
      id: collider.id,
      x: collider.x,
      y: collider.y,
      width: collider.width,
      height: collider.height,
      velocity: collider.velocity,
      slope: collider.slope || null
    })),
    editorLayer: {
      name: 'CollisionPainter',
      visible: true,
      tools: ['one-way', 'slope', 'moving-platform']
    }
  };
}

function buildStampPlacements(tilemap, paletteInput, placementInput) {
  const palette = createStampPalette(paletteInput);
  const placements = [];
  const placementSource = Array.isArray(placementInput) ? placementInput : [placementInput];
  placementSource.filter(Boolean).forEach((placement, placementIndex) => {
    const stamp = palette.get(placement.stamp);
    if (!stamp) return;
    const count = Math.max(1, Math.round(numberOr(placement.count, 1)));
    for (let index = 0; index < count; index += 1) {
      const point = resolvePlacementPoint(tilemap, placement, index);
      placements.push({
        id: placement.id || `${stamp.id}-${placementIndex}-${index}`,
        stamp: stamp.id,
        type: stamp.type,
        prefab: stamp.prefab,
        x: point.x,
        y: point.y,
        width: stamp.size?.width || tilemap.tileWidth,
        height: stamp.size?.height || tilemap.tileHeight,
        components: stamp.components || [],
        light: stamp.light || null,
        trigger: stamp.trigger || null
      });
    }
  });
  return {
    format: 'omnicore.stamp-placement-state.v1',
    palette: [...palette.values()],
    placements,
    dependencies: collectStampDependencies(placements),
    undoRedo: {
      undoStack: [
        { op: 'tile-edit-batch', count: 1 },
        { op: 'stamp-place-batch', count: placements.length }
      ],
      redoStack: [],
      canUndo: placements.length > 0,
      canRedo: false
    }
  };
}

function createStampPalette(paletteInput) {
  const defaults = [
    { id: 'monster', type: 'monster', prefab: 'prefabs/monster.prefab.json' },
    { id: 'trap', type: 'trap', prefab: 'prefabs/trap.prefab.json' },
    { id: 'chest', type: 'chest', prefab: 'prefabs/chest.prefab.json' },
    { id: 'portal', type: 'portal', prefab: 'prefabs/portal.prefab.json' },
    { id: 'light', type: 'light', prefab: 'prefabs/light.prefab.json' },
    { id: 'trigger', type: 'trigger', prefab: 'prefabs/trigger.prefab.json' }
  ];
  return new Map([...defaults, ...(Array.isArray(paletteInput) ? paletteInput : [])].map((stamp) => [stamp.id, { ...stamp }]));
}

function buildAnimationPreview(animationInput, stampPlacements) {
  const actorId = animationInput.actorId || 'hero';
  const states = Array.isArray(animationInput.states) && animationInput.states.length > 0
    ? animationInput.states
    : ['idle', 'run', 'jump', 'fall', 'attack', 'hurt'];
  const current = resolveAnimationState(animationInput.arcadeState || {});
  const stateMachine = {
    format: 'OmniCore.AnimationStateMachine',
    initial: 'idle',
    current,
    states: Object.fromEntries(states.map((state) => [
      state,
      {
        animation: `${actorId}-${state}`,
        loop: !['attack', 'hurt'].includes(state)
      }
    ])),
    transitions: createDefaultAnimationTransitions()
  };
  const ySortPreview = animationInput.ySortPreview === false
    ? []
    : buildYSortPreview(animationInput.entities || [], stampPlacements, actorId, current);
  return {
    format: 'omnicore.2d-animation-preview.v1',
    actorId,
    current,
    stateMachine,
    ySortPreview
  };
}

function buildPlaytestState(playtestInput, context) {
  const enabled = playtestInput.runInEditor !== false;
  const debug = Array.isArray(playtestInput.debug) ? playtestInput.debug : [];
  const runtime = createArcade2DGameplayPlan({
    actors: context.animation.ySortPreview
      .filter((entry) => entry.type === 'player')
      .map((entry) => ({
        id: entry.id,
        x: entry.x,
        y: entry.y,
        width: entry.width,
        height: entry.height,
        velocity: { x: 0, y: 0 }
      })),
    colliders: context.collision.colliders,
    sensors: context.stamps.placements
      .filter((placement) => placement.type === 'trigger')
      .map((placement) => ({
        id: placement.id,
        channel: 'trigger',
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height
      })),
    editor: { debugDraw: true }
  });
  return {
    format: 'omnicore.editor-playtest-2d25d.v1',
    runAction: {
      type: 'editor:playtest:start',
      enabled,
      mode: '2d-25d'
    },
    runtime,
    debugPanels: normalizeDebugPanels(debug),
    hotReloadEvents: [
      ...(context.tilemapState.edits.length > 0 ? [{ type: 'tilemap:changed', edits: context.tilemapState.edits.length }] : []),
      ...(context.collision.colliders.length > 0 ? [{ type: 'collision:changed', colliders: context.collision.colliders.length }] : []),
      ...(context.stamps.placements.length > 0 ? [{ type: 'scene:stamps-changed', placements: context.stamps.placements.length }] : []),
      { type: 'animation:state-changed', actorId: context.animation.actorId, state: context.animation.current }
    ]
  };
}

function buildSavePatch({ tilemapState, collision, stamps, animation }) {
  return {
    schema: 'omnicore.2d25d-authoring-save-patch.v1',
    tilemap: {
      summary: tilemapState.summary,
      edits: tilemapState.edits
    },
    collision: {
      colliders: collision.colliders
    },
    scene: {
      entities: stamps.placements.map((placement) => ({
        id: placement.id,
        type: placement.type,
        prefab: placement.prefab,
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
        components: placement.components,
        light: placement.light,
        trigger: placement.trigger
      }))
    },
    animation: animation.stateMachine,
    dependencies: {
      prefabs: stamps.dependencies.prefabs
    }
  };
}

function buildEditorState() {
  return {
    format: 'omnicore.2d25d-authoring-editor.v1',
    tools: [
      'Brush',
      'RectFill',
      'Eraser',
      'SelectionCopy',
      'AutoTile',
      'TerrainRule',
      'CollisionPainter',
      'StampPalette',
      'Playtest'
    ],
    panels: [
      'Tilemap',
      'Collision',
      'Stamps',
      'Animation',
      'Playtest',
      'HotReload',
      'SavePatch'
    ]
  };
}

function buildQualityChecks({ tilemapState, collision, stamps, animation, playtest }) {
  return {
    checks: [
      { id: 'tilemap-edit-tools', pass: tilemapState.edits.length > 0, detail: `${tilemapState.edits.length} edits` },
      { id: 'collision-painter', pass: collision.colliders.length > 0, detail: `${collision.colliders.length} colliders` },
      { id: 'stamp-prefab-placement', pass: stamps.placements.length > 0, detail: `${stamps.placements.length} placements` },
      { id: 'animation-state-preview', pass: Boolean(animation.current), detail: animation.current },
      { id: 'editor-playtest-loop', pass: playtest.runAction.enabled, detail: playtest.debugPanels.join(',') }
    ]
  };
}

function resolveLayer(tilemap, layerName) {
  const layer = tilemap.layers.get(layerName);
  if (layer) return layer;
  const fallback = {
    name: layerName,
    width: tilemap.width,
    height: tilemap.height,
    tileWidth: tilemap.tileWidth,
    tileHeight: tilemap.tileHeight,
    data: new Array(tilemap.width * tilemap.height).fill(0)
  };
  tilemap.layers.set(layerName, fallback);
  return fallback;
}

function writeTile(tilemap, layer, xInput, yInput, toInput, tool, edits, extra = {}) {
  const x = Math.round(numberOr(xInput, 0));
  const y = Math.round(numberOr(yInput, 0));
  if (x < 0 || y < 0 || x >= layer.width || y >= layer.height) return null;
  const index = y * layer.width + x;
  const from = layer.data[index] || 0;
  const to = numberOr(toInput, 0);
  layer.data[index] = to;
  const edit = {
    layer: layer.name,
    x,
    y,
    from,
    to,
    tool,
    world: {
      x: x * tilemap.tileWidth,
      y: y * tilemap.tileHeight,
      width: tilemap.tileWidth,
      height: tilemap.tileHeight
    },
    ...extra
  };
  edits.push(edit);
  return edit;
}

function readTile(layer, xInput, yInput) {
  const x = Math.round(numberOr(xInput, 0));
  const y = Math.round(numberOr(yInput, 0));
  if (x < 0 || y < 0 || x >= layer.width || y >= layer.height) return 0;
  return layer.data[y * layer.width + x] || 0;
}

function tileBounds(tilemap, x, y, width, height, tool) {
  return {
    tool,
    x: numberOr(x, 0) * tilemap.tileWidth,
    y: numberOr(y, 0) * tilemap.tileHeight,
    width: Math.max(1, numberOr(width, 1)) * tilemap.tileWidth,
    height: Math.max(1, numberOr(height, 1)) * tilemap.tileHeight
  };
}

function neighborOffset(direction) {
  if (direction === 'n') return { x: 0, y: -1 };
  if (direction === 'e') return { x: 1, y: 0 };
  if (direction === 's') return { x: 0, y: 1 };
  if (direction === 'w') return { x: -1, y: 0 };
  return { x: 0, y: 0 };
}

function resolvePlacementPoint(tilemap, placement, index) {
  const spacing = placement.spacing || {};
  const tile = placement.tile || null;
  if (tile) {
    return {
      x: (numberOr(tile.x, 0) + numberOr(spacing.x, 0) * index) * tilemap.tileWidth,
      y: (numberOr(tile.y, 0) + numberOr(spacing.y, 0) * index) * tilemap.tileHeight
    };
  }
  const grid = numberOr(placement.gridSize, tilemap.tileWidth);
  return {
    x: snap(numberOr(placement.x, 0) + numberOr(spacing.x, 0) * index, grid),
    y: snap(numberOr(placement.y, 0) + numberOr(spacing.y, 0) * index, grid)
  };
}

function collectStampDependencies(placements) {
  return {
    prefabs: [...new Set(placements.map((placement) => placement.prefab).filter(Boolean))].sort()
  };
}

function resolveAnimationState(arcadeState) {
  if (arcadeState.hurt) return 'hurt';
  if (arcadeState.attacking) return 'attack';
  if (!arcadeState.grounded && numberOr(arcadeState.velocity?.y, 0) < 0) return 'jump';
  if (!arcadeState.grounded && numberOr(arcadeState.velocity?.y, 0) >= 0) return 'fall';
  if (Math.abs(numberOr(arcadeState.velocity?.x, 0)) > 0.01) return 'run';
  return 'idle';
}

function createDefaultAnimationTransitions() {
  return [
    { from: 'idle', to: 'run', when: { moving: true } },
    { from: 'run', to: 'idle', when: { moving: false } },
    { from: 'idle', to: 'jump', when: { grounded: false, rising: true } },
    { from: 'jump', to: 'fall', when: { falling: true } },
    { from: 'fall', to: 'idle', when: { grounded: true } },
    { from: '*', to: 'attack', when: { attacking: true } },
    { from: '*', to: 'hurt', when: { hurt: true } }
  ];
}

function buildYSortPreview(entities, placements, actorId, currentAnimation) {
  return [
    ...entities.map((entity) => ({
      id: entity.id || actorId,
      type: entity.type || 'entity',
      x: numberOr(entity.x, 0),
      y: numberOr(entity.y, 0),
      width: numberOr(entity.width, 0),
      height: numberOr(entity.height, 0),
      animation: entity.id === actorId ? currentAnimation : null,
      depthY: numberOr(entity.depthY, numberOr(entity.y, 0) + numberOr(entity.height, 0))
    })),
    ...placements.map((placement) => ({
      id: placement.id,
      type: placement.type,
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      prefab: placement.prefab,
      depthY: placement.y + placement.height
    }))
  ].sort((left, right) => left.depthY - right.depthY || String(left.id).localeCompare(String(right.id)));
}

function normalizeDebugPanels(debug) {
  const requested = new Set(debug);
  const panels = [];
  if (requested.has('collisions')) panels.push('Collisions');
  if (requested.has('sensors')) panels.push('Sensors');
  if (requested.has('animation')) panels.push('Animation');
  if (requested.has('y-sort')) panels.push('YSort');
  if (panels.length === 0) panels.push('Collisions', 'Sensors', 'Animation', 'YSort');
  return panels;
}

function normalizeCollisionKind(kind) {
  if (kind === 'oneway' || kind === 'oneWay' || kind === 'one-way-platform') return 'one-way';
  if (kind === 'movingPlatform') return 'moving-platform';
  return kind || 'solid';
}

function normalizeVector(vector = {}) {
  return {
    x: numberOr(vector.x, 0),
    y: numberOr(vector.y, 0)
  };
}

function snap(value, grid) {
  const size = Math.max(1, grid);
  return Math.round(value / size) * size;
}

function numberOr(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export default createTilemap2D25DAuthoringLoop;
