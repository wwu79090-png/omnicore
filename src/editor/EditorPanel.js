import EditorPlugin from './EditorPlugin.js';

/**
 * Debug-mode in-game entity editor panel.
 *
 * @example
 * const panel = new EditorPanel(game);
 * panel.attach();
 */
export class EditorPanel extends EditorPlugin {
  attach() {
    super.attach();
    this.root?.setAttribute?.('data-omnicore-editor-panel', 'true');
    return this;
  }

  setSelectedProperty(key, value) {
    this._setSelectedProperty(key, value);
    return this.selected;
  }

  saveLayout() {
    return this.saveScene();
  }

  _syncSceneStore() {
    const payload = this._serializeScene();
    this.game.store?.set?.('editor:scene', payload);
    this.game.store?.set?.('config/scene.json', payload);
  }
}

export default EditorPanel;
