import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

let createEditorApp;
let editorViteConfig;

describe('standalone desktop-grade OmniCore Editor', () => {
  beforeAll(async () => {
    ({ createEditorApp } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/editor-app.js')).href));
    ({ default: editorViteConfig } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/vite.config.js')).href));
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
    expect(editorPackage.description).toContain('desktop scene editor');
    expect(editorPackage.author).toContain('Shalu');
    expect(editorPackage.build.productName).toBe('OmniCore Editor');
    expect(editorPackage.omnicoreEditor.desktopTargets).toEqual(expect.arrayContaining(['omnicore-editor.exe', 'OmniCore Editor.app']));
    expect(editorPackage.build.desktopTargets).toBeUndefined();
    expect(electronMain).toContain('BrowserWindow');
    expect(electronMain).toContain('loadFile');
    expect(packageScript).toContain('omnicore-editor.exe');
    expect(packageScript).toContain('OmniCore Editor.app');
    expect(existsSync('packages/omnicore-editor/bin/omnicore-editor.cjs')).toBe(true);
  });

  it('declares Windows installer packaging through electron-builder', () => {
    const editorPackage = JSON.parse(readFileSync('packages/omnicore-editor/package.json', 'utf8'));

    expect(editorPackage.devDependencies['electron-builder']).toMatch(/^\^\d+\.\d+\.\d+/);
    expect(editorPackage.scripts['package:win']).toContain('electron-builder --win');
    expect(editorPackage.scripts['package:win:dir']).toContain('electron-builder --win dir');
    expect(editorPackage.build.directories.output).toBe('dist-installers');
    expect(editorPackage.build.win.icon).toBe('../../assets/icons/electron/icon.ico');
    expect(editorPackage.build.win.target).toEqual([
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] }
    ]);
    expect(editorPackage.build.nsis.oneClick).toBe(false);
    expect(editorPackage.build.nsis.allowToChangeInstallationDirectory).toBe(true);
    expect(editorPackage.build.portable.artifactName).toContain('Portable');
    expect(existsSync('assets/icons/electron/icon.ico')).toBe(true);
  });

  it('builds desktop renderer assets with relative paths for Electron loadFile', () => {
    expect(editorViteConfig.base).toBe('./');
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

  it('renders a Chinese visual shell and keeps every toolbar action callable', async () => {
    window.omnicoreEditor = {
      openProjectFolder: async () => ({
        root: 'C:/game',
        name: 'game',
        assets: [],
        scenes: [],
        sourceFiles: []
      }),
      saveDockLayout: async () => ({ ok: true }),
      writeAutoSave: async () => ({ ok: true }),
      readPendingRecovery: async () => ({ exists: false }),
      clearAutoSave: async () => ({ ok: true })
    };
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
    expect([...root.querySelectorAll('[data-editor-tool]')].map((button) => button.textContent)).toEqual([
      '打开项目',
      '保存',
      '撤销',
      '重做',
      '运行',
      '暂停',
      '单步',
      '性能',
      '重置布局'
    ]);
    expect(root.querySelector('[data-panel="hierarchy"] h2')?.textContent).toBe('场景层级');
    expect(root.querySelector('[data-panel="scene-view"] h2')?.textContent).toBe('场景视图');
    expect(root.querySelector('[data-panel="inspector"] h2')?.textContent).toBe('属性检查器');
    expect(root.querySelector('[data-tile-layer-id="tiles"]')?.textContent).toBe('瓦片层');
    expect(root.querySelector('[data-flow-export="eventsheet"]')?.textContent).toBe('导出事件表');
    app.movePanelToRegion('ui-editor', 'bottom', 0);
    expect(root.querySelector('[data-ui-add="Button"]')?.textContent).toBe('按钮');
    expect(root.querySelector('[data-editor-onboarding]')?.textContent).toContain('打开项目');
    expect(root.querySelector('[data-editor-onboarding]')?.textContent).toContain('W/E/R');
    expect(root.textContent).not.toContain('Open Project');
    expect(root.textContent).not.toContain('Scene Hierarchy');
    expect(root.textContent).not.toContain('paint tiles');

    for (const button of root.querySelectorAll('[data-editor-tool]')) {
      expect(() => button.click()).not.toThrow();
      await Promise.resolve();
    }

    expect(app.getState().workspace.root).toBe('C:/game');
    expect(app.getState().profilerOpen).toBe(true);
    app.saveSnapshot('manual');

    expect(root.querySelector('[data-editor-feedback]')?.textContent).toContain('已保存 manual');

    app.destroy();
    delete window.omnicoreEditor;
  });

  it('renders the polished EXE launcher hub with boot animation, onboarding, and complete workflow actions', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: {
        scene: {
          entities: []
        }
      }
    });

    expect(root.querySelector('[data-desktop-boot-animation]')).toBeTruthy();
    expect(root.querySelector('[data-desktop-hub]')).toBeTruthy();
    expect(root.querySelector('[data-hub-section="project-center"]')).toBeTruthy();
    expect(root.querySelector('[data-hub-section="beginner-tutorial"]')).toBeTruthy();
    expect(root.querySelector('[data-hub-section="capability-map"]')).toBeTruthy();
    expect(root.querySelector('[data-motion-card]')).toBeTruthy();
    expect(root.textContent).toContain('0 基础新手教程');
    expect(root.textContent).toContain('功能完整度');
    expect(root.textContent).toContain('启动动画');
    expect(root.querySelectorAll('[data-desktop-tutorial-step]')).toHaveLength(4);
    expect(root.querySelector('[data-desktop-tutorial-code]')?.textContent).toContain('npm create omnicore-app');
    expect(root.querySelector('[data-desktop-capability="workflow"]')).toBeTruthy();
    expect(root.querySelector('[data-desktop-capability="engine-systems"]')).toBeTruthy();
    expect(root.querySelector('[data-desktop-capability="production"]')).toBeTruthy();
    expect(root.querySelector('[data-desktop-tutorial-action="play"]')).toBeTruthy();
    expect(root.querySelector('[data-desktop-tutorial-action="copy"]')).toBeTruthy();

    root.querySelector('[data-desktop-tutorial-step="2"]').click();
    expect(root.querySelector('[data-desktop-tutorial-code]')?.textContent).toContain('createScene');
    root.querySelector('[data-desktop-tutorial-action="play"]').click();
    expect(root.querySelector('[data-editor-feedback]')?.textContent).toContain('教程演示');

    app.destroy();
  });

  it('renders a complete desktop command center with actionable templates, diagnostics, and learning states', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: {
        scene: {
          entities: []
        }
      }
    });

    const hub = root.querySelector('[data-desktop-hub]');
    expect(hub?.getAttribute('data-desktop-layout')).toBe('command-center');
    expect(root.querySelector('[data-desktop-nav="projects"]')).toBeTruthy();
    expect(root.querySelector('[data-desktop-nav="templates"]')).toBeTruthy();
    expect(root.querySelector('[data-desktop-nav="diagnostics"]')).toBeTruthy();
    expect(root.querySelector('[data-hub-section="recent-projects"]')).toBeTruthy();
    expect(root.querySelector('[data-hub-section="template-lab"]')).toBeTruthy();
    expect(root.querySelector('[data-hub-section="release-diagnostics"]')).toBeTruthy();
    expect(root.querySelector('[data-hub-section="learning-path"]')).toBeTruthy();
    expect(root.querySelectorAll('[data-desktop-status-metric]')).toHaveLength(4);
    expect(root.querySelectorAll('[data-desktop-template]')).toHaveLength(4);
    expect(root.querySelectorAll('[data-desktop-recent-project]')).toHaveLength(3);
    expect(root.textContent).toContain('最近项目');
    expect(root.textContent).toContain('模板创建');
    expect(root.textContent).toContain('发布诊断');
    expect(root.textContent).toContain('系统状态');
    expect(root.textContent).toContain('启动序列');

    root.querySelector('[data-desktop-template="platformer"]').click();
    expect(root.querySelector('[data-editor-feedback]')?.textContent).toContain('模板已选择：横版动作');
    expect(root.querySelector('[data-desktop-template="platformer"]')?.classList.contains('selected')).toBe(true);

    root.querySelector('[data-desktop-recent-project="demo-action"]').click();
    expect(root.querySelector('[data-editor-feedback]')?.textContent).toContain('已定位项目：示例动作游戏');

    root.querySelector('[data-desktop-diagnostic-action="release-check"]').click();
    expect(root.querySelector('[data-editor-feedback]')?.textContent).toContain('发布诊断完成');
    expect(root.querySelector('[data-desktop-diagnostic-result]')?.textContent).toContain('9 项通过');

    root.querySelector('[data-desktop-nav="diagnostics"]').click();
    expect(hub?.getAttribute('data-active-desktop-section')).toBe('diagnostics');

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
