# OmniCore HTML UI Migration Template

Use this template when porting older Phaser/Pixi games that keep DOM UI above the canvas.

Recommended modules:

- `Input.pointer.enableEventPropagation(domElement)`
- `InputManager({ keyboard: { ignoreTags: ['INPUT', 'TEXTAREA'] } })`
- `Storage.importLegacy(localStorageKey, formatMap)`
- `Store.snapshot('checkpoint')`
