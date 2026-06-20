import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

let createEditorApp;

describe('standalone desktop-grade OmniCore Editor', () => {
  beforeAll(async () => {
    ({ createEditorApp } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/editor-app.js')).href));
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('declares a no-browser Electron command and desktop package targets', () => {
    const rootPackage = JSON.parse(readFileSync('package.json', 'utf8'));
    const editorPackage = JSON.parse(readFileSync('packages/omnicore-editor/package.json', 'utf8'));
    const electronMain = readFileSync('packages/omnicore-editor/electron.main.cjs', 'utf8');
    const packageScript = readFileSync('packages/omnicore-editor/scripts/package-desktop.cjs', 'utf8');

    expect(rootPackage.bin['omnicore-editor']).toBe('packages/omnicore-editor/bin/omnicore-editor.cjs');
    expect(rootPackage.scripts.editor).toBe('node packages/omnicore-editor/bin/omnicore-editor.cjs');
    expect(editorPackage.scripts['package:desktop']).toContain('package-desktop.cjs');
    expect(editorPackage.build.productName).toBe('OmniCore Editor');
    expect(editorPackage.build.desktopTargets).toEqual(expect.arrayContaining(['omnicore-editor.exe', 'OmniCore Editor.app']));
    expect(electronMain).toContain('BrowserWindow');
    expect(electronMain).toContain('loadFile');
    expect(packageScript).toContain('omnicore-editor.exe');
    expect(packageScript).toContain('OmniCore Editor.app');
    expect(existsSync('packages/omnicore-editor/bin/omnicore-editor.cjs')).toBe(true);
  });

  it('supports QWER edit shortcuts and drag docking panels between regions', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: {
        scene: {
          entities: [{ id: 'hero', name: 'Hero', x: 10, y: 10 }]
        }
      }
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true }));
    expect(app.getState().gizmoMode).toBe('select');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));
    expect(app.getState().gizmoMode).toBe('translate');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
    expect(app.getState().gizmoMode).toBe('rotate');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
    expect(app.getState().gizmoMode).toBe('scale');

    app.movePanelToRegion('assets', 'right', 0);
    expect(app.getDockLayout().right[0]).toBe('assets');
    expect(root.querySelector('[data-dock-region="right"] [data-dock-panel="assets"]')).toBeTruthy();
    expect(root.querySelector('[data-dock-panel="scene-view"]')?.draggable).toBe(true);

    app.destroy();
  });

  it('renders a unified visual shell, first-run guidance, and save feedback', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: {
        scene: {
          entities: []
        }
      }
    });

    expect(root.dataset.editorTheme).toBe('omnicore-unified');
    expect(root.querySelector('[data-editor-surface="topbar"]')).toBeTruthy();
    expect(root.querySelector('[data-editor-surface="sidebar"]')).toBeTruthy();
    expect(root.querySelector('[data-editor-surface="panel"]')).toBeTruthy();
    expect(root.querySelectorAll('[data-editor-icon]')).toHaveLength(9);
    expect(root.querySelector('[data-editor-onboarding]')?.textContent).toContain('Open Project');
    expect(root.querySelector('[data-editor-onboarding]')?.textContent).toContain('W/E/R');

    app.saveSnapshot('manual');

    expect(root.querySelector('[data-editor-feedback]')?.textContent).toContain('Saved manual');

    app.destroy();
  });

  it('keeps QWER gizmo shortcuts disabled while an editor text field has input focus', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: {
        scene: {
          entities: [{ id: 'hero', name: 'Hero', x: 10, y: 10 }]
        }
      }
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
    expect(app.getState().gizmoMode).toBe('rotate');

    const scriptInput = document.createElement('textarea');
    root.appendChild(scriptInput);
    scriptInput.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(app.InputFocusManager.areGizmoShortcutsEnabled()).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true, cancelable: true }));
    expect(app.getState().gizmoMode).toBe('rotate');

    root.querySelector('.scene-canvas').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(app.InputFocusManager.areGizmoShortcutsEnabled()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true, cancelable: true }));
    expect(app.getState().gizmoMode).toBe('translate');

    app.destroy();
  });
});
