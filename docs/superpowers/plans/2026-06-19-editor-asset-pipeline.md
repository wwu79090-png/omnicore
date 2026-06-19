# Editor Asset Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight editor overlay, sprite animation timeline, direct `Sprite.play('walk')` playback, and an asset import pipeline for source art files.

**Architecture:** Keep editor UI in DOM overlays so it does not obscure the playfield or add renderer coupling. Keep animation JSON compatible with the existing `Animation` runtime, and keep asset conversion in a standalone Node script that calls external production tools when present.

**Tech Stack:** OmniCore runtime modules, DOM overlay UI, Node.js filesystem and child process APIs, optional external tools `aseprite`, `magick`, and `ffmpeg`.

---

### Task 1: Sprite Animation Runtime

**Files:**
- Modify: `src/animation/Animation.js`
- Modify: `src/scene/Scene.js`

- [x] **Step 1: Extend Animation JSON parsing**

Support this animation payload:

```json
{
  "format": "OmniCore.Animation",
  "version": 1,
  "animations": {
    "walk": {
      "frameRate": 12,
      "loop": true,
      "keyframes": [
        { "time": 0, "frame": "walk-0", "texture": "walk-0", "rotation": 0, "scaleX": 1, "scaleY": 1, "alpha": 1 }
      ]
    }
  }
}
```

- [x] **Step 2: Add direct Sprite playback**

Expose:

```js
sprite.setAnimations(animationJson);
sprite.play('walk');
sprite.stopAnimation();
```

### Task 2: Animation Editor UI

**Files:**
- Create: `src/editor/AnimationEditor.js`

- [x] **Step 1: Build a lightweight timeline data model**

Support frame selection from arrays or atlas JSON:

```js
const editor = new AnimationEditor({ frames: ['walk-0', 'walk-1'] });
editor.addKeyframe('walk-0', { rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 });
const json = editor.exportAnimationJson();
```

- [x] **Step 2: Build DOM timeline controls**

Provide draggable frame buttons, a drop target timeline, transform fields for rotation/scale/alpha, and a readonly `animation.json` preview.

### Task 3: Editor Overlay Drag & Drop

**Files:**
- Create: `src/debug/EditorOverlay.js`
- Modify: `src/index.js`

- [x] **Step 1: Add debug overlay lifecycle**

When `debug: true`, attach `EditorOverlay` unless `editorOverlay: false`.

- [x] **Step 2: Add resource and prefab dragging**

Drag sprite entries or prefab entries onto the game canvas, instantiate at mouse position, and write generated scene JSON to `editor:sceneJson`.

### Task 4: Asset Import Pipeline

**Files:**
- Create: `scripts/import-assets.js`
- Modify: `package.json`

- [x] **Step 1: Scan source assets**

Scan `source-assets/` for `.png`, `.aseprite`, `.psd`, and `.mp3`.

- [x] **Step 2: Convert or explicitly skip**

Use:

```bash
aseprite -b input.aseprite --sheet out.png --data out.json --format json-array
magick input.psd[0] output.webp
ffmpeg -y -i input.mp3 output.ogg
```

If a converter is unavailable, write an explicit skipped entry to the manifest.

- [x] **Step 3: Generate manifest**

Write `assets/assets.manifest.json` with image, sprite sheet, audio, and skipped sections.

### Task 5: Follow-up Testing

**Files:**
- Test: `tests/tool-editors-mvp.test.js`
- Test: `tests/omnicore.test.js`

- [ ] **Step 1: Add editor model tests**

Test `AnimationEditor.exportAnimationJson()` and `Sprite.play('walk')`.

- [ ] **Step 2: Add import script smoke test**

Create temporary `source-assets/` files and verify manifest generation.

- [ ] **Step 3: Run validation**

Run:

```bash
npm test
npm run build
npm run import:assets
```
