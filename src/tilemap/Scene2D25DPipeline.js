import Camera from '../camera/Camera.js';
import Light2D from '../lighting/Light2D.js';
import { createArcade2DGameplayPlan } from '../physics/Arcade2DGameplayKit.js';
import Tilemap from './Tilemap.js';
import { createTilemapChunkStreamPlan } from './TilemapChunkStreaming.js';

/**
 * Builds one production-oriented 2D/2.5D scene plan for runtime, editor, debug, and export workflows.
 */
export const SCENE_2D_25D_PIPELINE_SCHEMA = 'omnicore.scene-2d-25d-pipeline.v1';

export function createScene2D25DPipeline(config = {}) {
  const { map, section: tilemap } = normalizeTilemap(config.tilemap);
  const entities = normalizeEntities(config);
  const cameraState = buildCameraState(config.camera, entities, tilemap.summary);
  const parallax = buildParallaxState(config.parallax, cameraState.instance);
  const streaming = buildStreamingState(config.streaming, cameraState.tileViewport, tilemap.summary);
  const collisions = buildCollisionState(map, config.collisions, tilemap.summary);
  const arcade2D = buildArcade2DState(config.arcade2D, entities, collisions);
  const depth25D = buildDepth25DState(entities);
  const lighting = buildLightingState(config.lights, entities);
  const editor = buildEditorState(config.editor, {
    tilemap,
    camera: cameraState.section,
    collisions,
    arcade2D,
    depth25D,
    lighting,
    streaming
  });
  const runtimeSync = buildRuntimeSyncState({ arcade2D });
  const quality = buildQualityChecks({
    camera: cameraState.section,
    collisions,
    arcade2D,
    depth25D,
    lighting,
    streaming,
    editor
  });

  const result = {
    schema: SCENE_2D_25D_PIPELINE_SCHEMA,
    tilemap,
    entities,
    camera: cameraState.section,
    parallax,
    streaming,
    collisions,
    arcade2D,
    lighting,
    editor,
    runtimeSync,
    quality
  };
  result.depth2_5D = depth25D;
  return result;
}

function normalizeTilemap(tilemap = {}) {
  const source = tilemap instanceof Tilemap
    ? tilemap
    : Tilemap.parse({
      width: numberOr(tilemap.width, 0),
      height: numberOr(tilemap.height, 0),
      tilewidth: numberOr(tilemap.tileWidth ?? tilemap.tilewidth, 16),
      tileheight: numberOr(tilemap.tileHeight ?? tilemap.tileheight, 16),
      tilesets: tilemap.tilesets || [],
      layers: Array.isArray(tilemap.layers) ? tilemap.layers : []
    });
  const layers = source.layers.map((layer, index) => ({
    id: layer.id ?? layer.name ?? `layer-${index}`,
    name: layer.name || `Layer ${index + 1}`,
    path: layer.path || layer.name || `Layer ${index + 1}`,
    type: layer.type || 'custom',
    width: numberOr(layer.width, source.width),
    height: numberOr(layer.height, source.height),
    visible: layer.visible !== false,
    opacity: numberOr(layer.opacity, 1)
  }));
  const worldWidth = source.width * source.tileWidth;
  const worldHeight = source.height * source.tileHeight;

  return {
    map: source,
    section: {
      summary: {
        width: source.width,
        height: source.height,
        tileWidth: source.tileWidth,
        tileHeight: source.tileHeight,
        worldWidth,
        worldHeight,
        layerCount: layers.length
      },
      layers
    }
  };
}

function normalizeEntities(config) {
  const safeConfig = config || {};
  const fromPlayer = safeConfig.player ? [safeConfig.player] : [];
  const source = [...fromPlayer, ...(Array.isArray(safeConfig.entities) ? safeConfig.entities : [])];
  const seen = new Set();
  return source.map((entityInput, index) => {
    const entity = entityInput || {};
    const baseId = entity.id || entity.name || `entity-${index}`;
    const id = seen.has(baseId) ? `${baseId}-${index}` : baseId;
    seen.add(id);
    const width = numberOr(entity.width ?? entity.w, 0);
    const height = numberOr(entity.height ?? entity.h, 0);
    const x = numberOr(entity.x, 0);
    const y = numberOr(entity.y, 0);
    const depthY = numberOr(entity.depthY ?? entity.depth ?? (y + height), y + height);
    return {
      ...entity,
      id,
      type: entity.type || 'entity',
      x,
      y,
      width,
      height,
      depthY,
      occludes: Array.isArray(entity.occludes) ? [...entity.occludes] : []
    };
  });
}

function buildCameraState(cameraInput, entityInput, tilemapInput) {
  const camera = cameraInput || {};
  const entities = entityInput || [];
  const tilemapSummary = tilemapInput || {};
  const viewport = normalizeRect(camera.viewport, { width: 320, height: 180 });
  const bounds = normalizeRect(camera.bounds, {
    x: 0,
    y: 0,
    width: tilemapSummary.worldWidth || viewport.width,
    height: tilemapSummary.worldHeight || viewport.height
  });
  const instance = new Camera({
    x: numberOr(camera.x, bounds.x),
    y: numberOr(camera.y, bounds.y),
    zoom: numberOr(camera.zoom, 1)
  });
  instance.setViewport(viewport);
  instance.setBounds(bounds);
  const followTargetId = typeof camera.follow === 'string'
    ? camera.follow
    : camera.follow?.id || camera.followTargetId || null;
  const followTarget = entities.find((entity) => entity.id === followTargetId) || null;
  if (followTarget) {
    instance.follow({ x: followTarget.x, y: followTarget.y }, { lerp: numberOr(camera.lerp, 1) });
    instance.update(numberOr(camera.initialDelta, 16));
  }
  const viewTransform = instance.getViewTransform();
  const zoom = viewTransform.zoom || 1;
  const worldViewport = {
    x: viewTransform.x,
    y: viewTransform.y,
    width: viewport.width / zoom,
    height: viewport.height / zoom
  };
  const tileViewport = {
    x: tilemapSummary.tileWidth ? worldViewport.x / tilemapSummary.tileWidth : 0,
    y: tilemapSummary.tileHeight ? worldViewport.y / tilemapSummary.tileHeight : 0,
    width: tilemapSummary.tileWidth ? worldViewport.width / tilemapSummary.tileWidth : 0,
    height: tilemapSummary.tileHeight ? worldViewport.height / tilemapSummary.tileHeight : 0
  };

  return {
    instance,
    tileViewport,
    section: {
      followTargetId,
      followFound: Boolean(followTarget),
      viewport,
      bounds,
      deadzone: normalizeRect(camera.deadzone, { x: 0, y: 0, width: 0, height: 0 }),
      lerp: numberOr(camera.lerp, 1),
      viewTransform,
      worldViewport,
      tileViewport
    }
  };
}

function buildParallaxState(parallaxInput, camera) {
  const parallax = parallaxInput || [];
  const layers = Array.isArray(parallax)
    ? parallax
    : Object.entries(parallax || {}).map(([id, value]) => (
      typeof value === 'number' ? { id, factorX: value, factorY: value } : { id, ...value }
    ));
  layers.forEach((layerInput, index) => {
    const layer = layerInput || {};
    camera.addParallaxLayer(
      { id: layer.id || layer.name || `parallax-${index}` },
      {
        factorX: numberOr(layer.factorX ?? layer.factor, 1),
        factorY: numberOr(layer.factorY ?? layer.factor ?? layer.factorX, 1),
        offsetX: numberOr(layer.offsetX, 0),
        offsetY: numberOr(layer.offsetY, 0)
      }
    );
  });
  return {
    layers: camera.getParallaxTransforms().map((layer) => ({
      id: layer.id,
      x: layer.x,
      y: layer.y,
      factorX: layer.factorX,
      factorY: layer.factorY
    })),
    debugDraw: camera.getParallaxTransforms().map((layer) => ({
      op: 'debug:parallax-layer',
      id: layer.id,
      x: layer.x,
      y: layer.y,
      factorX: layer.factorX,
      factorY: layer.factorY
    }))
  };
}

function buildStreamingState(streamingInput, viewportInput, tilemapInput) {
  const streaming = streamingInput || {};
  const tileViewport = viewportInput || {};
  const tilemapSummary = tilemapInput || {};
  const chunkWidth = Math.max(1, Math.round(numberOr(streaming.chunkWidth ?? streaming.chunkSize, 16)));
  const chunkHeight = Math.max(1, Math.round(numberOr(streaming.chunkHeight ?? streaming.chunkSize ?? chunkWidth, chunkWidth)));
  const mapWidth = Math.max(1, Math.ceil((tilemapSummary.width || 0) / chunkWidth));
  const mapHeight = Math.max(1, Math.ceil((tilemapSummary.height || 0) / chunkHeight));
  const sourcePlan = createTilemapChunkStreamPlan({
    viewport: tileViewport,
    chunkSize: chunkWidth,
    loadedChunks: streaming.loadedChunks || [],
    preloadRadius: numberOr(streaming.preloadRadius, 1),
    mapWidth,
    mapHeight
  });
  return {
    format: 'omnicore.scene-2d-25d-streaming.v1',
    chunkWidth,
    chunkHeight,
    visibleChunks: sourcePlan.visible,
    loadChunks: sourcePlan.load,
    keepChunks: sourcePlan.keep,
    unloadChunks: sourcePlan.unload,
    preloadRadius: sourcePlan.preloadRadius,
    sourcePlan,
    debugDraw: sourcePlan.visible.map((key) => ({
      op: 'debug:tilemap-chunk',
      key,
      chunkWidth,
      chunkHeight
    }))
  };
}

function buildCollisionState(map, collisionsInput, tilemapInput) {
  const collisions = collisionsInput || {};
  const tilemapSummary = tilemapInput || {};
  const layerName = collisions.layer || collisions.layerName || 'Collision';
  const layer = map.getTileLayer(layerName) || map.layers.find((item) => item.type === 'tilelayer') || null;
  const solidTileIds = Array.isArray(collisions.solidTileIds) && collisions.solidTileIds.length > 0
    ? collisions.solidTileIds
    : [1];
  const bakeInput = layer ? {
    ...layer,
    tileWidth: layer.tileWidth || tilemapSummary.tileWidth,
    tileHeight: layer.tileHeight || tilemapSummary.tileHeight,
    collisionTileIds: solidTileIds
  } : {};
  const baked = Tilemap.bakeStaticCollision(bakeInput);
  const arcadeBodies = baked.polygons.map((polygon, index) => ({
    id: `${layer?.name || layerName}-static-${index}`,
    type: 'static',
    backend: 'arcade',
    layer: layer?.name || layerName,
    x: polygon.x,
    y: polygon.y,
    width: polygon.width,
    height: polygon.height,
    mergedTiles: polygon.mergedTiles,
    immovable: true
  }));
  return {
    format: 'omnicore.scene-2d-25d-collisions.v1',
    layer: layer?.name || layerName,
    solidTileIds,
    arcadeEnabled: collisions.arcade !== false,
    staticColliderCount: baked.colliderCount,
    sourceTiles: baked.sourceTiles,
    staticColliders: baked.polygons,
    arcadeBodies,
    debugDraw: arcadeBodies.map((body) => ({
      op: 'debug:rect',
      layer: body.layer,
      id: body.id,
      x: body.x,
      y: body.y,
      width: body.width,
      height: body.height,
      color: '#ffcc33'
    }))
  };
}

function buildArcade2DState(arcadeInput, entities = [], collisions = {}) {
  if (!arcadeInput) return null;
  const actors = arcadeInput.actors || arcadeInput.actor || entities;
  const colliders = arcadeInput.colliders || collisions.arcadeBodies || [];
  return createArcade2DGameplayPlan({
    ...arcadeInput,
    actors,
    colliders
  });
}

function buildDepth25DState(entities = []) {
  const sortedEntities = [...entities]
    .sort((left, right) => left.depthY - right.depthY || String(left.id).localeCompare(String(right.id)))
    .map((entity, index) => ({
      id: entity.id,
      type: entity.type,
      x: entity.x,
      y: entity.y,
      width: entity.width,
      height: entity.height,
      depthY: entity.depthY,
      drawIndex: index
    }));
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const occlusionBands = entities.flatMap((entity) => entity.occludes.map((targetId) => {
    const target = entityById.get(targetId);
    return {
      occluderId: entity.id,
      targetId,
      active: Boolean(target),
      x: entity.x,
      y: entity.y,
      width: entity.width,
      height: entity.height,
      targetDepthY: target?.depthY ?? null,
      occluderDepthY: entity.depthY
    };
  }));
  return {
    format: 'omnicore.scene-2d-25d-depth.v1',
    mode: 'y-sort-with-occlusion',
    sortedEntities,
    occlusionBands,
    drawCommands: sortedEntities.map((entity) => ({
      op: 'draw:entity',
      id: entity.id,
      depthY: entity.depthY,
      drawIndex: entity.drawIndex
    })),
    debugDraw: occlusionBands.map((band) => ({
      op: 'debug:occlusion-band',
      occluderId: band.occluderId,
      targetId: band.targetId,
      x: band.x,
      y: band.y,
      width: band.width,
      height: band.height,
      color: '#66aaff'
    }))
  };
}

function buildLightingState(lightInput, entityInput) {
  const lights = lightInput || [];
  const entities = entityInput || [];
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const normalizedLights = (Array.isArray(lights) ? lights : []).map((lightConfig, index) => {
    const light = lightConfig || {};
    const instance = light.type === 'directional'
      ? Light2D.directional(light)
      : Light2D.point(light);
    return {
      id: light.id || `light-${index}`,
      instance,
      shadowCasters: Array.isArray(light.shadowCasters) ? light.shadowCasters : []
    };
  });
  const drawCommands = normalizedLights.map((light) => ({
    id: light.id,
    ...light.instance.toDrawCommand()
  }));
  const shadowCommands = normalizedLights.flatMap((light) => light.shadowCasters
    .map((casterId) => {
      const caster = entityById.get(casterId);
      if (!caster) return null;
      return {
        op: 'light2d:shadow-rect',
        lightId: light.id,
        casterId,
        rect: {
          x: caster.x,
          y: caster.y,
          width: caster.width,
          height: caster.height
        },
        polygon: light.instance.shadowForRect(caster)
      };
    })
    .filter(Boolean));
  return {
    format: 'omnicore.scene-2d-25d-lighting.v1',
    lights: drawCommands,
    shadowCommands,
    debugDraw: [
      ...drawCommands.map((command) => ({
        op: 'debug:light-radius',
        id: command.id,
        x: command.x,
        y: command.y,
        radius: command.radius,
        color: command.resolvedColor
      })),
      ...shadowCommands.map((command) => ({
        op: 'debug:shadow-polygon',
        lightId: command.lightId,
        casterId: command.casterId,
        polygon: command.polygon,
        color: '#000000'
      }))
    ]
  };
}

function buildEditorState(editorInput, sectionInput) {
  const editor = editorInput || {};
  const sections = sectionInput || {};
  const exportTargets = Array.isArray(editor.exportTargets) && editor.exportTargets.length > 0
    ? [...editor.exportTargets]
    : ['web'];
  const inspectorSections = editor.inspector === false ? [] : [
    'Tilemap',
    'Camera2D',
    'Parallax',
    'ArcadePhysics',
    ...(sections.arcade2D ? ['Arcade2DGameplay'] : []),
    'Depth2.5D',
    'Light2D',
    'Streaming',
    'Export'
  ];
  return {
    format: 'omnicore.scene-2d-25d-editor.v1',
    inspectorSections,
    hotReload: editor.hotReload !== false,
    panels: [
      { id: 'tilemap', title: 'Tilemap', source: sections.tilemap.summary },
      { id: 'camera2d', title: 'Camera2D', source: sections.camera },
      { id: 'physics2d', title: 'Arcade Physics', source: sections.collisions },
      ...(sections.arcade2D ? [{ id: 'arcade2d-gameplay', title: 'Arcade 2D Gameplay', source: sections.arcade2D }] : []),
      { id: 'depth25d', title: 'Depth 2.5D', source: sections.depth25D },
      { id: 'light2d', title: 'Light2D', source: sections.lighting },
      { id: 'streaming', title: 'Tile Streaming', source: sections.streaming }
    ],
    exportPlan: {
      targets: exportTargets,
      saveProject: editor.saveProject !== false,
      steps: [
        'serialize-scene',
        'bake-tilemap-colliders',
        'write-streaming-manifest',
        'write-editor-runtime-sync',
        'emit-target-presets'
      ]
    },
    hotReloadTopics: [
      'tilemap:changed',
      'collision:rebaked',
      'camera:changed',
      'parallax:changed',
      'light2d:changed',
      'depth25d:changed'
    ]
  };
}

function buildRuntimeSyncState({ arcade2D = null } = {}) {
  return {
    protocol: 'omnicore.runtime-sync.2d25d/v1',
    payloads: [
      'tilemap',
      'camera',
      'parallax',
      'streaming',
      'collisions',
      ...(arcade2D ? ['arcade2D'] : []),
      'depth2_5D',
      'lighting',
      'editor'
    ],
    events: [
      'tilemap:stream',
      'physics2d:debug-draw',
      ...(arcade2D ? ['arcade2d:gameplay-step'] : []),
      'camera2d:follow',
      'depth25d:resort',
      'light2d:shadow-bake',
      'editor:export-plan'
    ]
  };
}

function buildQualityChecks({ camera, collisions, arcade2D, depth25D, lighting, streaming, editor }) {
  return {
    checks: [
      {
        id: '2d-camera-follow',
        pass: Boolean(camera.followTargetId && camera.followFound),
        detail: camera.followTargetId || 'no follow target'
      },
      {
        id: '2d-arcade-collision',
        pass: collisions.staticColliderCount > 0 && collisions.arcadeBodies.length > 0,
        detail: `${collisions.staticColliderCount} static colliders`
      },
      ...(arcade2D ? [{
        id: 'arcade2d-gameplay-loop',
        pass: arcade2D.contacts.length > 0 || arcade2D.sensorEvents.length > 0,
        detail: `${arcade2D.contacts.length} contacts, ${arcade2D.sensorEvents.length} sensor events`
      }] : []),
      {
        id: '25d-depth-occlusion',
        pass: depth25D.sortedEntities.length > 0,
        detail: `${depth25D.occlusionBands.length} occlusion bands`
      },
      {
        id: '2d-light-shadow',
        pass: lighting.lights.length > 0,
        detail: `${lighting.shadowCommands.length} shadow commands`
      },
      {
        id: '2d-tile-streaming',
        pass: streaming.visibleChunks.length > 0,
        detail: `${streaming.visibleChunks.length} visible chunks`
      },
      {
        id: 'editor-export-closure',
        pass: editor.exportPlan.targets.length > 0 && editor.inspectorSections.length > 0,
        detail: editor.exportPlan.targets.join(',')
      }
    ]
  };
}

function normalizeRect(rectInput, defaultsInput) {
  const rect = rectInput || {};
  const defaults = defaultsInput || {};
  return {
    x: numberOr(rect.x, defaults.x || 0),
    y: numberOr(rect.y, defaults.y || 0),
    width: numberOr(rect.width ?? rect.w, defaults.width || 0),
    height: numberOr(rect.height ?? rect.h, defaults.height || 0)
  };
}

function numberOr(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export default createScene2D25DPipeline;
