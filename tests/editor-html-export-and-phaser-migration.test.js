import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('editor standalone export and Phaser migration docs', () => {
  it('adds a browser editor button that exports the current scene as a standalone HTML preview', () => {
    const editor = readFileSync('website/editor/index.html', 'utf8');

    expect(editor).toContain('id="exportHtml"');
    expect(editor).toContain('导出为独立 HTML');
    expect(editor).toContain('function buildStandaloneHtml');
    expect(editor).toContain('window.exportStandaloneHtml');
    expect(editor).toContain('OmniCoreScenePreview.html');
    expect(editor).toContain('window.__OMNICORE_SCENE__');
    expect(editor).toContain('<canvas id="preview"');
  });

  it('documents at least 20 Phaser 3 to OmniCore migration mappings', () => {
    const doc = readFileSync('docs/migration/from-phaser.md', 'utf8');
    const mappingRows = doc.match(/\| `[^`]+` \| `[^`]+` \|/g) || [];

    expect(doc).toContain('20 个常用 API 对照表');
    expect(mappingRows.length).toBeGreaterThanOrEqual(20);
    expect(doc).toContain('this.scene.start');
    expect(doc).toContain('OmniCore.SceneManager.push');
    expect(doc).toContain('this.add.sprite');
    expect(doc).toContain('OmniCore.Entity.create');
    expect(doc).toContain('this.physics.add.sprite');
    expect(doc).toContain('loadPhysics()');
    expect(doc).toContain('this.input.keyboard.on');
    expect(doc).toContain('InputManager');
  });
});
