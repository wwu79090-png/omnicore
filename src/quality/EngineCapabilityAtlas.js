export const ENGINE_FAMILY_SOURCES = Object.freeze({
  unreal: source('Unreal', [
    'https://dev.epicgames.com/documentation/unreal-engine/replication-graph-in-unreal-engine',
    'https://dev.epicgames.com/documentation/unreal-engine/world-partition-in-unreal-engine'
  ]),
  unity: source('Unity', [
    'https://docs.unity3d.com/6000.4/Documentation/Manual/UnityManual.html',
    'https://unity.com/dots'
  ]),
  godot: source('Godot', [
    'https://docs.godotengine.org/en/stable/getting_started/step_by_step/signals.html',
    'https://docs.godotengine.org/en/stable/tutorials/networking/high_level_multiplayer.html'
  ]),
  gamemaker: source('GameMaker', [
    'https://manual.gamemaker.io/',
    'https://gamemaker.io/en/blog/gamemaker-studio-2-dot-3-new-ide-features'
  ]),
  rpgMaker: source('RPG Maker', [
    'https://rpgmakerofficial.com/product/MZ_help-en/index.html'
  ]),
  renpy: source('RenPy', [
    'https://www.renpy.org/doc/html/label.html',
    'https://www.renpy.org/doc/html/save_load_rollback.html'
  ]),
  phaser: source('Phaser', [
    'https://docs.phaser.io/phaser/concepts/scenes',
    'https://docs.phaser.io/phaser/concepts/physics'
  ]),
  defold: source('Defold', [
    'https://www.defold.com/manuals/introduction/',
    'https://www.defold.com/manuals/collection-factory/'
  ]),
  bevy: source('Bevy', [
    'https://bevyengine.org/examples/',
    'https://bevyengine.org/learn/migration-guides/0-15-to-0-16/'
  ]),
  monogame: source('MonoGame', [
    'https://docs.monogame.net/'
  ]),
  libgdx: source('libGDX', [
    'https://libgdx.com/wiki/'
  ]),
  cocosCreator: source('Cocos Creator', [
    'https://docs.cocos.com/creator/manual/en/'
  ]),
  construct: source('Construct', [
    'https://www.construct.net/en/make-games/manuals/construct-3'
  ])
});

export const ENGINE_CAPABILITY_CATEGORIES = Object.freeze([
  capability('scene-architecture', 'Scene architecture', ['unreal', 'unity', 'godot', 'phaser', 'defold'], [
    'src/scene/Scene.js',
    'src/scene/SceneDocument.js',
    'src/scene/SceneTransitionStack.js'
  ]),
  capability('entity-component-ecs', 'Entity/component/ECS', ['unity', 'bevy', 'godot', 'libgdx'], [
    'src/core/ECS/World.js',
    'src/core/ECS/QueryFilter.js',
    'src/scene/ComponentTreeRuntime.js'
  ]),
  capability('rendering-pipeline', 'Rendering pipeline', ['unreal', 'unity', 'godot', 'phaser', 'cocosCreator'], [
    'src/renderer/RenderGraphPlanner.js',
    'src/renderer/ShaderVariantCollection.js',
    'src/renderer/TextureStreamingBudget.js'
  ]),
  capability('asset-pipeline', 'Asset pipeline', ['unity', 'godot', 'defold', 'cocosCreator'], [
    'src/assets/AddressableCatalog.js',
    'src/assets/AssetResidencyManager.js',
    'src/assets/AssetImportMetadata.js'
  ]),
  capability('editor-authoring', 'Editor authoring', ['unreal', 'unity', 'godot', 'gamemaker', 'cocosCreator'], [
    'src/editor/EditorInspectorModel.js',
    'src/editor/EditorPluginCascade.js',
    'src/editor/RuntimeLiveSyncBridge.js'
  ]),
  capability('visual-scripting', 'Visual scripting', ['unreal', 'construct', 'rpgMaker', 'gamemaker'], [
    'src/visualgraph/VisualEventGraph.js',
    'src/data/EventSheet.js',
    'src/data/EventCommandQueue.js'
  ]),
  capability('gameplay-framework', 'Gameplay framework', ['unreal', 'unity', 'godot', 'rpgMaker'], [
    'src/gameplay/AbilitySystem.js',
    'src/gameplay/QuestStateMachine.js',
    'src/core/GameplayTags.js'
  ]),
  capability('netcode', 'Netcode', ['unreal', 'unity', 'godot', 'phaser'], [
    'src/net/NetworkSnapshotBuffer.js',
    'src/net/ReplicationInterestGraph.js',
    'src/net/RemoteEventContract.js'
  ]),
  capability('save-rollback', 'Save, rollback, and persistence', ['renpy', 'unity', 'godot', 'rpgMaker'], [
    'src/store/SaveGameArchive.js',
    'src/store/PersistentSaveSlot.js',
    'src/core/RuntimeStateSerializer.js'
  ]),
  capability('platform-export', 'Platform export', ['unity', 'unreal', 'godot', 'gamemaker', 'cocosCreator'], [
    'src/platform/ExportPreset.js',
    'src/platform/GameSettingsProfile.js',
    'src/platform/RuntimeConfigFlags.js'
  ]),
  capability('input-stack', 'Input stack', ['unity', 'godot', 'phaser', 'monogame', 'libgdx'], [
    'src/input/InputActionContextStack.js',
    'src/input/InputDeviceMap.js',
    'src/input/InputManager.js'
  ]),
  capability('physics-collision', 'Physics and collision', ['unity', 'unreal', 'godot', 'phaser', 'libgdx'], [
    'src/physics/PhysicsWorld.js',
    'src/physics/PhysicsQuery.js',
    'src/physics/Physics.js'
  ]),
  capability('animation-timeline', 'Animation and timeline', ['unity', 'unreal', 'gamemaker', 'renpy'], [
    'src/animation/Animation.js',
    'src/animation/AnimationManager.js',
    'src/timeline/Timeline.js'
  ]),
  capability('tilemap-worlds', 'Tilemaps and worlds', ['godot', 'gamemaker', 'rpgMaker', 'phaser'], [
    'src/tilemap/Tilemap.js',
    'src/tilemap/TilemapAuthoringTools.js',
    'src/scene/WorldPartitionGrid.js'
  ]),
  capability('ui-dialogue-narrative', 'UI, dialogue, and narrative', ['renpy', 'rpgMaker', 'godot', 'unity'], [
    'src/data/DialogueGraph.js',
    'src/data/NarrativeRuntime.js',
    'src/data/VisualNovelScript.js'
  ]),
  capability('audio-runtime', 'Audio runtime', ['unity', 'unreal', 'godot', 'phaser'], [
    'src/audio/AudioManager.js',
    'src/addons/Audio.js'
  ]),
  capability('plugins-marketplace', 'Plugins and marketplace', ['unreal', 'unity', 'godot', 'cocosCreator'], [
    'src/core/PluginManifest.js',
    'src/core/PluginPermissionSandbox.js',
    'src/package/PackageManager.js'
  ]),
  capability('quality-profiling', 'Quality and profiling', ['unreal', 'unity', 'godot', 'bevy'], [
    'src/quality/EngineQualityHarness.js',
    'scripts/engine-doctor.js',
    'src/performance/FramePacingController.js'
  ]),
  capability('data-localization', 'Data and localization', ['rpgMaker', 'renpy', 'unity', 'godot'], [
    'src/data/DataAsset.js',
    'src/data/DataTable.js',
    'src/data/Localization.js'
  ]),
  capability('low-code-authoring', 'Low-code authoring', ['construct', 'rpgMaker', 'gamemaker', 'renpy'], [
    'src/data/BehaviorDefinition.js',
    'src/data/RpgEventPageResolver.js',
    'src/data/EventCommandQueue.js'
  ]),
  capability('prefabs-factories', 'Prefabs and factories', ['unity', 'unreal', 'defold', 'godot'], [
    'src/prefab/PrefabVariantRegistry.js',
    'src/scene/CollectionFactory.js',
    'src/assets/VirtualAssetFS.js'
  ]),
  capability('scripting-lifecycle', 'Scripting lifecycle', ['love', 'libgdx', 'monogame', 'phaser'], [
    'src/core/CallbackGameLoop.js',
    'src/scene/ScreenFlowController.js',
    'src/core/SystemSchedule.js'
  ]),
  capability('commercial-monetization', 'Commercial and monetization', ['unity', 'unreal', 'cocosCreator', 'gamemaker'], [
    'src/commercial/ExportPaywall.js',
    'src/addons/Payment.js',
    'src/addons/Ad.js'
  ], 'P1'),
  capability('ai-authoring-procedural', 'AI authoring and procedural tools', ['unreal', 'unity', 'godot', 'bevy'], [
    'src/ai/AICommandService.js',
    'src/importer/AIImporter.js',
    'src/tilemap/AITilemapGenerator.js'
  ], 'P1'),
  capability('build-docs-ci', 'Build, docs, and CI', ['unity', 'unreal', 'godot', 'bevy'], [
    'scripts/build.js',
    'scripts/generate-api-docs.js',
    'docs/engine-handbook.md'
  ]),
  capability('migration-compatibility', 'Migration and compatibility', ['phaser', 'pixijs', 'unity', 'defold'], [
    'src/compat/phaser/PhaserCompat.js',
    'scripts/omni-migrate.js',
    'src/renderer/PixiFrameworkBridge.js'
  ])
]);

export function buildEngineCapabilityAtlas({
  projectRoot = getDefaultProjectRoot(),
  generatedAt = '1970-01-01T00:00:00.000Z'
} = {}) {
  const categories = ENGINE_CAPABILITY_CATEGORIES.map((category) => normalizeCategory(category, projectRoot));
  const covered = categories.filter((category) => category.status === 'covered');
  const partial = categories.filter((category) => category.status === 'partial');
  const missing = categories.filter((category) => category.status === 'missing');
  const gaps = [...partial, ...missing].map((category) => ({
    id: category.id,
    label: category.label,
    priority: category.priority,
    status: category.status,
    missingEvidence: category.evidenceStatus.missing,
    command: category.command
  }));

  return {
    generatedBy: 'OmniCore engine capability atlas',
    generatedAt,
    engineFamilies: Object.fromEntries(Object.entries(ENGINE_FAMILY_SOURCES).map(([id, family]) => [id, clone(family)])),
    summary: {
      engineFamilyCount: Object.keys(ENGINE_FAMILY_SOURCES).length,
      categoryCount: categories.length,
      coveredCategoryCount: covered.length,
      partialCategoryCount: partial.length,
      missingCategoryCount: missing.length,
      coverageScore: categories.length ? Math.round((covered.length / categories.length) * 100) : 100,
      p0GapCount: gaps.filter((gap) => gap.priority === 'P0').length
    },
    categories,
    gaps,
    nextActions: gaps
      .slice()
      .sort((left, right) => priorityWeight(left.priority) - priorityWeight(right.priority) || left.id.localeCompare(right.id))
      .slice(0, 12)
  };
}

export function renderEngineCapabilityMarkdown(atlas = buildEngineCapabilityAtlas()) {
  const lines = [
    '# OmniCore Engine Capability Atlas',
    '',
    `Generated: ${atlas.generatedAt}`,
    `Engine families: ${atlas.summary.engineFamilyCount}`,
    `Categories: ${atlas.summary.categoryCount}`,
    `Coverage score: ${atlas.summary.coverageScore}`,
    `P0 gaps: ${atlas.summary.p0GapCount}`,
    '',
    '## Engine Families'
  ];

  for (const family of Object.values(atlas.engineFamilies)) {
    lines.push(`- ${family.name}: ${family.sources.join(', ')}`);
  }

  lines.push(
    '',
    '## Capability Coverage',
    '',
    '| Capability | Status | Inspired by | Evidence |',
    '| --- | --- | --- | --- |'
  );
  for (const category of atlas.categories) {
    lines.push(`| ${category.label} | ${category.status} | ${category.inspiredByLabels.join(', ')} | ${category.evidence.join('<br>')} |`);
  }

  lines.push('', '## Next Actions');
  if (!atlas.nextActions.length) lines.push('- No blocking capability gaps.');
  for (const action of atlas.nextActions) {
    lines.push(`- ${action.priority} ${action.id}: ${action.command}`);
  }
  return `${lines.join('\n')}\n`;
}

function source(name, sources) {
  return { name, sources };
}

function capability(id, label, inspiredBy, evidence, priority = 'P0') {
  return {
    id,
    label,
    inspiredBy,
    evidence,
    priority,
    command: 'npm test'
  };
}

function normalizeCategory(category, projectRoot) {
  const evidenceStatus = evaluateEvidence(category.evidence, projectRoot);
  const status = evidenceStatus.presentCount === category.evidence.length
    ? 'covered'
    : evidenceStatus.presentCount > 0
      ? 'partial'
      : 'missing';
  return {
    ...category,
    inspiredByLabels: category.inspiredBy.map((id) => ENGINE_FAMILY_SOURCES[id]?.name || id),
    evidenceStatus,
    status
  };
}

function evaluateEvidence(evidence, projectRoot) {
  const checks = evidence.map((file) => ({
    file,
    present: fileExists(projectRoot, file)
  }));
  const missing = checks.filter((check) => !check.present).map((check) => check.file);
  return {
    presentCount: checks.length - missing.length,
    totalCount: checks.length,
    missing,
    checks
  };
}

function fileExists(projectRoot, relativePath) {
  const fs = getNodeFs();
  if (!fs) return true;
  return fs.existsSync(joinPath(projectRoot, relativePath));
}

function joinPath(...parts) {
  const pathModule = getNodePath();
  if (pathModule) return pathModule.join(...parts);
  return parts.filter(Boolean).join('/').replace(/\/+/gu, '/');
}

function getDefaultProjectRoot() {
  return globalThis.process?.cwd?.() || '/';
}

function getNodeFs() {
  return globalThis.process?.getBuiltinModule?.('fs') || null;
}

function getNodePath() {
  return globalThis.process?.getBuiltinModule?.('path') || null;
}

function priorityWeight(priority) {
  if (priority === 'P0') return 0;
  if (priority === 'P1') return 1;
  if (priority === 'P2') return 2;
  return 3;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default {
  ENGINE_CAPABILITY_CATEGORIES,
  ENGINE_FAMILY_SOURCES,
  buildEngineCapabilityAtlas,
  renderEngineCapabilityMarkdown
};
