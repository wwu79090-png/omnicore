# OmniCore Editor Features

This document defines the concrete editor surface expected from the OmniCore desktop and web editor demos.

## 场景树

- Display Entity / Node hierarchy with parent-child indentation.
- Support collapse and expand for nested nodes; this is the official 折叠 interaction.
- Support rename from the tree row; this is the official 重命名 interaction.
- Support delete for selected entities; this is the official 删除 interaction with undo/redo integration.
- Keep selected Entity synchronized with the scene canvas and inspector.

## 属性面板

- Show selected entity fields: `x`, `y`, `scale`, `rotation`, `width`, `height`, and `alpha`.
- Show mounted components with component name, enabled state, and editable public fields.
- Validate numeric input before committing changes.
- Record every committed edit as one history entry.

## Gizmo

- 平移（W）.
- 旋转（E）.
- 缩放（R）.
- Show the active mode in the toolbar and on the selected transform handle.
- Use grid snapping when snap is enabled.

## Tilemap

- Support brush painting.
- Support erasing and fill tools.
- Show 碰撞层可视化 as an overlay.
- Allow collision painting separately from visual tile painting.

## 预览模式

- Standard control wording: 运行/暂停/逐帧播放.
- Run the current scene without leaving the editor.
- Pause the runtime.
- Step one frame at a time for deterministic debugging.
- Keep inspector state readable while the preview is paused.

## Interaction standard

- All destructive actions require undo support.
- Scene canvas selection, scene tree selection, and inspector focus must stay synchronized.
- Keyboard shortcuts must not trigger while typing in an input field.
- New users should be able to open `examples/editor-demo/` and directly experience editing flow without building a project first.
