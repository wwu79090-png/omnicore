# OmniCore Live Edit Play Mode Design

## Goal

Build the first production-shaped vertical slice for Unity/Godot-style Live Edit and Play Mode in OmniCore: the game can run, pause simulation, accept editor mutations against the live world, render the edited state immediately, and resume from that edited state without a restart.

## Recommended Direction

Use a core-first vertical slice. The first phase adds the runtime edit state machine, a stronger Live Sync command protocol, direct entity mutation, tilemap/database command hooks, and a compact per-frame profiler waterfall. It does not attempt to ship the full Game Database UI, full tilemap authoring suite, or full overlay scene editor in the same pass.

This keeps the highest-value workflow small enough to verify:

- Start a game in debug/editor sync mode.
- Press Play in the desktop editor.
- Pause simulation while the current frame remains visible.
- Change an entity property such as position, size, rotation, alpha, or gameplay fields like hp.
- See the renderer update immediately while simulation stays paused.
- Resume and continue from the edited world state.

## Current Context

The current codebase already has several useful foundations:

- `src/loop/Loop.js` exposes `pause()` and `resume()`, but it pauses the loop rather than modelling editor play states.
- `src/editor/RuntimeLiveSyncBridge.js` can publish a scene and apply a simple `{ id, patch }` editor command.
- `packages/omnicore-editor/src/live-sync-protocol.js` carries scene snapshots, editor entity updates, tilemap state, and simulation flags.
- `packages/omnicore-editor/src/editor-app.js` already has toolbar Play/Pause buttons, scene dragging, inspector editing, a basic tilemap brush panel, and Live Sync message emission.
- `src/database/Database.js` and `src/data/DataTableEditor.js` exist, but they are not yet unified into a project-wide editor database panel.
- `src/debug/PerformanceMetrics.js` records named durations, and `src/debug/PerformanceMonitor.js` shows FPS/render/object/memory stats, but there is no per-frame waterfall UI.
- `src/scene/SceneManager.js` has a stack API, but the Store-driven scene path replaces the active scene rather than preserving lower layers for overlays.

## Phase 1 Scope

Phase 1 includes:

- Runtime play-mode state machine: `editing`, `playing`, `paused`.
- Live editor commands for entity patches, entity creation, tilemap patches, database record patches, and play-state changes.
- Runtime command application while paused, with immediate render refresh.
- Entity field preservation for custom gameplay fields, so `hp`, `speed`, `aiState`, or plugin fields are not dropped by sync normalization.
- Editor toolbar state connected to the runtime state instead of local-only simulation flags.
- Minimal profiler waterfall panel in debug/editor mode using existing metric collectors plus explicit frame sections.
- Focused tests proving the edit loop works without restarting the game.

Phase 1 does not include:

- Full Excel-like Game Database panel with sorting, type-aware validation, formula import, or workbook support.
- Full tilemap editor with tileset image slicing, multi-layer object editing, terrain brushes, stamp brushes, or autotile rules.
- Full overlay scene authoring UI.
- Multi-user collaborative conflict resolution.
- Persisting edited runtime state back to project files automatically.

## Architecture

### Runtime Play Session

Add a small `PlaySession` controller under the runtime/editor boundary. It owns the editor-facing state, not the low-level loop:

- `mode`: `editing`, `playing`, or `paused`.
- `startedAt`, `pausedAt`, `frame`, and `lastCommandId`.
- `setMode(mode)` emits `runtime:play-state`.
- `applyCommand(command)` validates and routes editor commands.
- `requestRender()` calls `game.renderer.renderScene(game.scene.current)` without advancing simulation.

The loop remains responsible for ticking. The play session decides whether scene update should advance:

- `editing`: simulation is stopped or idle. Editor changes can still render.
- `playing`: normal loop updates and renders.
- `paused`: simulation update is skipped, but editor commands still mutate entities and request render.

This avoids using `Loop.pause()` as the main edit-mode primitive, because a hard-paused loop can also stop useful editor repaint and monitoring behavior. The loop can still be paused for browser visibility and shutdown.

### Scene Update Gate

Add a play-mode guard in `SceneManager.update(delta, time)`:

- Input and camera update can be controlled by play-state options.
- Scene child update is skipped when `playSession.mode === 'paused'`.
- Render still happens after editor commands and optionally on frame updates when useful.
- Performance stats still update in debug mode so the UI remains alive.

The initial implementation should keep this conservative: while paused, do not run scene logic, physics, timers, tweens, animation controllers, or behavior trees.

### Live Sync Protocol

Extend the protocol around typed commands rather than ad hoc payloads.

Runtime to editor:

- `runtime:hello`: runtime version and capability flags.
- `runtime:scene`: current scene snapshot with preserved custom fields.
- `runtime:play-state`: current play session state.
- `runtime:profiler-frame`: latest per-frame timing sections.
- `runtime:database`: optional database snapshot or changed table metadata.
- `runtime:tilemap`: tilemap snapshot or patch acknowledgement.

Editor to runtime:

- `editor:set-play-mode`: `{ mode: 'editing' | 'playing' | 'paused' }`
- `editor:update-entity`: `{ id, patch, commandId }`
- `editor:create-entity`: `{ entity, commandId }`
- `editor:update-tilemap`: `{ patch | tilemap, commandId }`
- `editor:update-database-record`: `{ table, id, patch, commandId }`
- `editor:request-scene`: `{ reason }`
- `editor:request-profiler`: `{ enabled }`

Commands are idempotent by `commandId` where possible. The runtime stores the last applied IDs in a small bounded set to avoid duplicate WebSocket delivery causing repeated entity creation.

### Entity Mutation

Entity mutation remains shallow for Phase 1:

- Locate by `id` first, then `name`.
- Patch primitive own fields directly.
- Keep numeric parsing in editor UI, but runtime also rejects `NaN`/infinite numeric values.
- Preserve unknown entity fields in scene serialization and editor normalization.
- Emit `runtime:entity-updated` or republish `runtime:scene` after applying a command.

This allows gameplay fields like `hp` to round-trip even before a full component inspector exists.

### Database Hook

Phase 1 adds command-level support, not full UI:

- Runtime command `editor:update-database-record` calls `game.database.register(table, id, mergedRecord)`.
- Runtime emits a store event such as `database:record-updated`.
- Existing scenes can subscribe manually or read from `DB.get()` on demand.

Automatic live rebind of every scene reference is deferred. This prevents a broad and risky data dependency system from blocking the Live Edit vertical slice.

### Tilemap Hook

The current editor tilemap panel can already paint a flat grid and export Tiled JSON. Phase 1 should wire its output to runtime more formally:

- `editor:update-tilemap` applies either a full tilemap replacement or a small patch.
- Runtime stores the latest tilemap under `game.store` and emits `tilemap:updated`.
- If the current scene contains a tilemap-like entity, the bridge updates its data/layers when the shape is compatible.

Full Tiled parity and tileset authoring remain Phase 2.

### Profiler Waterfall

Add a debug-only `FrameProfiler` that records sections for the latest N frames:

- `loop.frame`
- `input.update`
- `camera.update`
- `scene.update`
- `entity.update`
- `renderer.renderScene`
- `performance.monitor`
- optional named `game.metrics` buckets already recorded by renderer/physics.

The first UI is a compact bar waterfall, not a full call-stack flamegraph:

- Lives in debug mode and/or the desktop editor bottom panel.
- Shows the latest frame total and section bars.
- Highlights sections over a threshold.
- Emits no data when debug/profiler is disabled.

This provides the practical visibility needed to answer "which system caused the frame spike" without overbuilding a browser DevTools clone.

## Components

- `src/editor/PlaySession.js`: runtime play/edit state machine and command router.
- `src/editor/RuntimeLiveSyncBridge.js`: command decoding, play-session integration, scene/database/tilemap/profiler publishing.
- `packages/omnicore-editor/src/live-sync-protocol.js`: normalized play state, profiler frames, database metadata, custom entity field preservation.
- `packages/omnicore-editor/src/editor-app.js`: toolbar mode binding, inspector custom fields, profiler panel slot, runtime command sending.
- `src/debug/FrameProfiler.js`: frame section recorder and export surface.
- `src/debug/ProfilerWaterfallPanel.js`: debug DOM panel for runtime-only usage.
- `src/scene/SceneManager.js`: play-session update gate and profiler section instrumentation.
- `src/core/OmniCore.js`: construct optional play session/profiler in debug/editor sync mode.
- `tests/live-edit-play-mode.test.js`: focused runtime and protocol coverage.
- Existing editor tests: update where current toolbar simulation flags assume local-only state.

## Data Flow

1. Game starts with `debug: true` or explicit editor sync.
2. Runtime creates `PlaySession` and connects `RuntimeLiveSyncBridge`.
3. Runtime publishes `runtime:hello`, `runtime:play-state`, and `runtime:scene`.
4. Editor receives the snapshot and renders hierarchy, scene view, inspector, tilemap, and profiler panels.
5. User presses Play. Editor sends `editor:set-play-mode`.
6. Runtime switches to `playing`, emits `runtime:play-state`, and the scene updates normally.
7. User presses Pause. Runtime switches to `paused`; scene update stops advancing.
8. User edits an entity field or drags a node. Editor sends `editor:update-entity`.
9. Runtime validates and applies the patch to the live entity, then renders the current scene without ticking simulation.
10. User resumes. Runtime switches to `playing`, and the next frame continues from the edited state.

## Error Handling

- Malformed commands return a structured `runtime:command-error` message and do not mutate the scene.
- Missing entity IDs are reported as command errors and do not create implicit entities.
- Invalid play modes are rejected.
- Database commands with missing table/id are rejected.
- Tilemap commands with incompatible dimensions are rejected unless explicitly marked as full replacement.
- Profiler UI failures must not break the game loop.
- WebSocket parse failures remain isolated from runtime update.

Warnings and errors should remain visible in tests and debug output. Do not suppress console warnings to satisfy tests.

## Testing

Focused tests should cover:

- Play session starts in `editing`, transitions to `playing`, then `paused`, then `playing`.
- While paused, scene child `update()` is not called.
- While paused, `editor:update-entity` mutates the live entity and calls `renderScene`.
- Custom fields such as `hp` survive runtime serialization, editor normalization, and command application.
- Duplicate `commandId` does not create duplicate entities.
- `editor:update-database-record` updates `Database` records and emits a store/event signal.
- `editor:update-tilemap` updates store state and compatible tilemap data.
- Profiler records named frame sections and exports the latest frame.
- Editor toolbar reflects runtime play state from `runtime:play-state`.

Regression tests should include the existing editor and protocol suites around:

- `tests/industrialization-decoupled.test.js`
- `tests/industrialization-complete.test.js`
- `tests/editor-maturity-ui.test.js`
- `tests/omnicore-2d-performance-crown.test.js`

## Rollout

The feature is opt-in at first:

- Enabled by `debug: true` plus editor sync, or by `editorLiveEdit: true`.
- No effect on production builds unless explicitly enabled.
- Existing `Loop.pause()` remains available for low-level pause needs.
- Existing `Database`, `DataTableEditor`, and tilemap APIs remain compatible.
- Existing scene APIs remain compatible; play-mode gating is additive.

## Acceptance Criteria

- A running scene can be paused from the editor without destroying or replacing it.
- Paused scenes stop gameplay updates but remain visible.
- Editing an entity property in the desktop editor mutates the live runtime object immediately.
- Resume continues from the edited runtime state.
- Custom gameplay fields round-trip through Live Sync.
- Runtime command errors are structured and testable.
- A debug profiler waterfall shows per-frame section timing beyond FPS.
- Existing focused editor/runtime tests pass without ignored warnings.

## Follow-Up Phases

Phase 2 should build the visible Game Database panel:

- Project-wide table registry.
- Table schema metadata.
- Spreadsheet-like editing.
- Record reference picker in inspector.
- Explicit "apply to running world" commands.

Phase 3 should upgrade tilemap authoring:

- Tileset image import/slicing.
- Multi-layer tile editing.
- Collision/object layer editing.
- Brush, rectangle fill, eraser, stamp, and collision paint tools.
- Import/export with Tiled compatibility.

Phase 4 should add true overlay layers:

- Separate world and UI layer stacks.
- Pause menu and inventory overlay scenes.
- Input focus routing.
- Background scene freeze/resume controls.

Phase 5 should expand profiler depth:

- Rolling history.
- Spike capture.
- Entity/system breakdown.
- Exportable JSON report.
- Optional desktop-editor profiler panel.
