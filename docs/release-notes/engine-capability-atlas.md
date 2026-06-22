# OmniCore Engine Capability Atlas

Generated: 1970-01-01T00:00:00.000Z
Engine families: 13
Categories: 26
Coverage score: 100
P0 gaps: 0

## Engine Families
- Unreal: https://dev.epicgames.com/documentation/unreal-engine/replication-graph-in-unreal-engine, https://dev.epicgames.com/documentation/unreal-engine/world-partition-in-unreal-engine
- Unity: https://docs.unity3d.com/6000.4/Documentation/Manual/UnityManual.html, https://unity.com/dots
- Godot: https://docs.godotengine.org/en/stable/getting_started/step_by_step/signals.html, https://docs.godotengine.org/en/stable/tutorials/networking/high_level_multiplayer.html
- GameMaker: https://manual.gamemaker.io/, https://gamemaker.io/en/blog/gamemaker-studio-2-dot-3-new-ide-features
- RPG Maker: https://rpgmakerofficial.com/product/MZ_help-en/index.html
- RenPy: https://www.renpy.org/doc/html/label.html, https://www.renpy.org/doc/html/save_load_rollback.html
- Phaser: https://docs.phaser.io/phaser/concepts/scenes, https://docs.phaser.io/phaser/concepts/physics
- Defold: https://www.defold.com/manuals/introduction/, https://www.defold.com/manuals/collection-factory/
- Bevy: https://bevyengine.org/examples/, https://bevyengine.org/learn/migration-guides/0-15-to-0-16/
- MonoGame: https://docs.monogame.net/
- libGDX: https://libgdx.com/wiki/
- Cocos Creator: https://docs.cocos.com/creator/manual/en/
- Construct: https://www.construct.net/en/make-games/manuals/construct-3

## Capability Coverage

| Capability | Status | Inspired by | Evidence |
| --- | --- | --- | --- |
| Scene architecture | covered | Unreal, Unity, Godot, Phaser, Defold | src/scene/Scene.js<br>src/scene/SceneDocument.js<br>src/scene/SceneTransitionStack.js |
| Entity/component/ECS | covered | Unity, Bevy, Godot, libGDX | src/core/ECS/World.js<br>src/core/ECS/QueryFilter.js<br>src/scene/ComponentTreeRuntime.js |
| Rendering pipeline | covered | Unreal, Unity, Godot, Phaser, Cocos Creator | src/renderer/RenderGraphPlanner.js<br>src/renderer/ShaderVariantCollection.js<br>src/renderer/TextureStreamingBudget.js |
| Asset pipeline | covered | Unity, Godot, Defold, Cocos Creator | src/assets/AddressableCatalog.js<br>src/assets/AssetResidencyManager.js<br>src/assets/AssetImportMetadata.js<br>src/assets/AssetImportProfile.js<br>src/assets/AssetImportPreview.js<br>src/assets/AssetImportTransaction.js |
| Editor authoring | covered | Unreal, Unity, Godot, GameMaker, Cocos Creator | src/editor/EditorInspectorModel.js<br>src/editor/EditorPluginCascade.js<br>src/editor/RuntimeLiveSyncBridge.js |
| Visual scripting | covered | Unreal, Construct, RPG Maker, GameMaker | src/visualgraph/VisualEventGraph.js<br>src/data/EventSheet.js<br>src/data/EventCommandQueue.js |
| Gameplay framework | covered | Unreal, Unity, Godot, RPG Maker | src/gameplay/AbilitySystem.js<br>src/gameplay/QuestStateMachine.js<br>src/core/GameplayTags.js |
| Netcode | covered | Unreal, Unity, Godot, Phaser | src/net/NetworkSnapshotBuffer.js<br>src/net/ReplicationInterestGraph.js<br>src/net/RemoteEventContract.js |
| Save, rollback, and persistence | covered | RenPy, Unity, Godot, RPG Maker | src/store/SaveGameArchive.js<br>src/store/PersistentSaveSlot.js<br>src/core/RuntimeStateSerializer.js |
| Platform export | covered | Unity, Unreal, Godot, GameMaker, Cocos Creator | src/platform/ExportPreset.js<br>src/platform/GameSettingsProfile.js<br>src/platform/RuntimeConfigFlags.js |
| Input stack | covered | Unity, Godot, Phaser, MonoGame, libGDX | src/input/InputActionContextStack.js<br>src/input/InputDeviceMap.js<br>src/input/InputManager.js |
| Physics and collision | covered | Unity, Unreal, Godot, Phaser, libGDX | src/physics/PhysicsWorld.js<br>src/physics/PhysicsQuery.js<br>src/physics/Physics.js |
| Animation and timeline | covered | Unity, Unreal, GameMaker, RenPy | src/animation/Animation.js<br>src/animation/AnimationManager.js<br>src/timeline/Timeline.js |
| Tilemaps and worlds | covered | Godot, GameMaker, RPG Maker, Phaser | src/tilemap/Tilemap.js<br>src/tilemap/TilemapAuthoringTools.js<br>src/scene/WorldPartitionGrid.js |
| UI, dialogue, and narrative | covered | RenPy, RPG Maker, Godot, Unity | src/data/DialogueGraph.js<br>src/data/NarrativeRuntime.js<br>src/data/VisualNovelScript.js |
| Audio runtime | covered | Unity, Unreal, Godot, Phaser | src/audio/AudioManager.js<br>src/addons/Audio.js |
| Plugins and marketplace | covered | Unreal, Unity, Godot, Cocos Creator | src/core/PluginManifest.js<br>src/core/PluginPermissionSandbox.js<br>src/package/PackageManager.js |
| Quality and profiling | covered | Unreal, Unity, Godot, Bevy | src/quality/EngineQualityHarness.js<br>scripts/engine-doctor.js<br>src/performance/FramePacingController.js |
| Data and localization | covered | RPG Maker, RenPy, Unity, Godot | src/data/DataAsset.js<br>src/data/DataTable.js<br>src/data/Localization.js |
| Low-code authoring | covered | Construct, RPG Maker, GameMaker, RenPy | src/data/BehaviorDefinition.js<br>src/data/RpgEventPageResolver.js<br>src/data/EventCommandQueue.js |
| Prefabs and factories | covered | Unity, Unreal, Defold, Godot | src/prefab/PrefabVariantRegistry.js<br>src/scene/CollectionFactory.js<br>src/assets/VirtualAssetFS.js |
| Scripting lifecycle | covered | love, libGDX, MonoGame, Phaser | src/core/CallbackGameLoop.js<br>src/scene/ScreenFlowController.js<br>src/core/SystemSchedule.js |
| Commercial and monetization | covered | Unity, Unreal, Cocos Creator, GameMaker | src/commercial/ExportPaywall.js<br>src/addons/Payment.js<br>src/addons/Ad.js |
| AI authoring and procedural tools | covered | Unreal, Unity, Godot, Bevy | src/ai/AICommandService.js<br>src/importer/AIImporter.js<br>src/tilemap/AITilemapGenerator.js |
| Build, docs, and CI | covered | Unity, Unreal, Godot, Bevy | scripts/build.js<br>scripts/generate-api-docs.js<br>docs/engine-handbook.md |
| Migration and compatibility | covered | Phaser, pixijs, Unity, Defold | src/compat/phaser/PhaserCompat.js<br>scripts/omni-migrate.js<br>src/renderer/PixiFrameworkBridge.js |

## Next Actions
- No blocking capability gaps.
