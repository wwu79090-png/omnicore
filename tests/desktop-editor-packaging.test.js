import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditorApp } from 'omnicore-editor/src/editor-app.js';
import editorViteConfig from 'omnicore-editor/vite.config.js';

describe('standalone desktop-grade OmniCore Editor', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function expectDesktopCommandWindow(root, commandId, expectedText) {
    const commandWindow = root.querySelector('[data-desktop-command-window]');
    expect(commandWindow).toBeTruthy();
    expect(commandWindow?.dataset.desktopCommandWindow).toBe(commandId);
    expect(commandWindow?.querySelector('[data-desktop-command-window-title]')?.textContent).toContain(expectedText);
    expect(commandWindow?.querySelector('[data-desktop-command-window-action="execute"]')).toBeTruthy();
    expect(commandWindow?.querySelectorAll('[data-desktop-window-step]').length).toBeGreaterThanOrEqual(3);
    expect(commandWindow?.querySelector('[data-desktop-command-window-result]')?.textContent.trim()).not.toBe('');
    expect(commandWindow?.querySelector('[data-desktop-command-window-result-state]')?.textContent).toMatch(/已执行|执行中|等待/);
  }

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
    expect(editorPackage.dependencies['lucide-static']).toMatch(/^\^\d+\.\d+\.\d+/);
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
    const editorHtml = readFileSync('packages/omnicore-editor/index.html', 'utf8');

    expect(editorViteConfig.base).toBe('./');
    expect(editorHtml).toContain('rel="icon"');
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
    expect(hub?.getAttribute('data-desktop-layout')).toBe('integrated-workbench');
    expect(root.querySelector('[data-desktop-nav="projects"]')).toBeTruthy();
    expect(root.querySelector('[data-desktop-nav="editor"]')).toBeTruthy();
    expect(root.querySelector('[data-desktop-nav="assets"]')).toBeTruthy();
    expect(root.querySelector('[data-desktop-command="template-platformer"]')).toBeTruthy();
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
    expect(root.textContent).toContain('EXE 工作台');
    expect(root.textContent).toContain('功能入口已整合');

    root.querySelector('[data-desktop-template="platformer"]').click();
    expectDesktopCommandWindow(root, 'template-platformer', '横版动作');
    expect(root.querySelector('[data-desktop-command-window-result]')?.textContent).toContain('模板已选择');
    expect(root.querySelector('[data-editor-feedback]')?.textContent).toContain('模板已选择：横版动作');
    expect(root.querySelector('[data-desktop-template="platformer"]')?.classList.contains('selected')).toBe(true);

    root.querySelector('[data-desktop-recent-project="demo-action"]').click();
    expectDesktopCommandWindow(root, 'recent-demo-action', '示例动作游戏');
    expect(root.querySelector('[data-editor-feedback]')?.textContent).toContain('已定位项目：示例动作游戏');

    root.querySelector('[data-desktop-diagnostic-action="release-check"]').click();
    expectDesktopCommandWindow(root, 'release-check', '一键体检');
    expect(root.querySelector('[data-editor-feedback]')?.textContent).toContain('发布诊断完成');
    expect(root.querySelector('[data-desktop-diagnostic-result]')?.textContent).toContain('9 项通过');

    root.querySelector('[data-desktop-nav="diagnostics"]').click();
    expect(hub?.getAttribute('data-active-desktop-section')).toBe('diagnostics');

    app.destroy();
  });

  it('organizes the EXE launcher into complete uniform command groups with useful actions', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: {
        scene: {
          entities: []
        }
      }
    });

    const navButtons = [...root.querySelectorAll('[data-desktop-nav]')];
    expect(navButtons.map((button) => button.dataset.desktopNav)).toEqual([
      'projects',
      'editor',
      'assets',
      'systems',
      'render',
      'publish',
      'learning',
      'diagnostics'
    ]);
    for (const button of navButtons) {
      expect(button.querySelector('[data-desktop-icon-source="lucide-static"] svg')).toBeTruthy();
    }

    const launchSplash = root.querySelector('.desktop-launch-splash');
    expect(launchSplash).toBeTruthy();
    expect(launchSplash.querySelector('[data-desktop-icon-source="lucide-static"] svg')).toBeTruthy();
    expect(launchSplash.textContent).toContain('启动资源库');

    expect([...root.querySelectorAll('[data-desktop-feature-group]')].map((section) => section.dataset.desktopFeatureGroup)).toEqual([
      'projects',
      'editor-workbench',
      'assets-scenes',
      'systems-2d-3d-physics',
      'render-performance',
      'platform-publish',
      'learning',
      'diagnostics'
    ]);

    const cards = [...root.querySelectorAll('[data-desktop-command-card]')];
    expect(cards.length).toBeGreaterThanOrEqual(32);
    for (const card of cards) {
      expect(card.classList.contains('desktop-command-card')).toBe(true);
      const icon = card.querySelector('[data-desktop-command-icon]');
      expect(icon?.dataset.desktopIconSource).toBe('lucide-static');
      expect(icon?.querySelector('svg')).toBeTruthy();
      expect(icon?.textContent.trim()).toBe('');
      expect(card.querySelector('[data-desktop-command-title]')?.textContent.trim()).not.toBe('');
      expect(card.querySelector('[data-desktop-command-purpose]')?.textContent.trim()).not.toBe('');
      expect(card.querySelector('[data-desktop-command-status]')?.textContent.trim()).not.toBe('');
      expect(card.dataset.desktopCommand).toBeTruthy();
    }

    for (const button of root.querySelectorAll('.desktop-hub-actions [data-desktop-command]')) {
      expect(button.querySelector('[data-desktop-icon-source="lucide-static"] svg')).toBeTruthy();
    }

    const usefulCommands = [
      'scene-view',
      'inspector',
      'assets',
      'prefabs',
      'visual-scripting',
      'physics-view',
      'profiler',
      'build-settings',
      'webgpu-diagnostics',
      'wechat-export',
      'beginner-tutorial',
      'release-check'
    ];
    for (const command of usefulCommands) {
      expect(root.querySelector(`[data-desktop-command="${command}"]`)).toBeTruthy();
    }

    root.querySelector('[data-desktop-command="assets"]').click();
    expectDesktopCommandWindow(root, 'assets', '资源库');
    expect(app.getDockLayout().left).toContain('assets');
    expect(root.querySelector('[data-editor-feedback]')?.textContent).toContain('资源库');

    root.querySelector('[data-desktop-command="visual-scripting"]').click();
    expectDesktopCommandWindow(root, 'visual-scripting', '可视化脚本');
    expect(app.getDockLayout().center).toContain('visual-scripting');
    expect(root.querySelector('[data-editor-feedback]')?.textContent).toContain('可视化脚本');

    root.querySelector('[data-desktop-command="profiler"]').click();
    expectDesktopCommandWindow(root, 'profiler', '性能分析器');
    expect(app.getState().profilerOpen).toBe(true);
    expect(root.querySelector('[data-desktop-hub]')?.dataset.lastDesktopCommand).toBe('profiler');

    app.destroy();
  });

  it('keeps the launcher visual, focused, searchable, and backed by actionable command details', () => {
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
    const search = root.querySelector('[data-desktop-command-search]');
    const visiblePanels = () => [...root.querySelectorAll('[data-desktop-feature-group]')].filter((panel) => !panel.hidden);

    expect(search).toBeTruthy();
    expect(root.querySelector('[data-desktop-command-window-layer]')).toBeTruthy();
    expect(root.querySelector('[data-desktop-command-details]')).toBeFalsy();
    expect(root.querySelector('[data-desktop-section-board]')).toBeTruthy();
    expect(root.querySelector('[data-desktop-section-map]')).toBeTruthy();
    expect(root.querySelectorAll('[data-desktop-section-node]').length).toBeGreaterThanOrEqual(4);
    expect(visiblePanels()).toHaveLength(1);
    expect(visiblePanels()[0]?.dataset.desktopFeatureGroup).toBe('projects');
    expect(root.querySelector('[data-desktop-feature-group="projects"]')?.classList.contains('is-focused')).toBe(true);

    const cards = [...root.querySelectorAll('[data-desktop-command-card]')];
    expect(cards.length).toBeGreaterThanOrEqual(32);
    for (const card of cards) {
      expect(card.dataset.desktopCommandUseful).toBe('true');
      expect(card.dataset.desktopCommandOutcome).toBeTruthy();
      expect(card.dataset.desktopCommandTarget).toBeTruthy();
    }

    root.querySelector('[data-desktop-command="visual-scripting"]').click();
    expect(hub?.dataset.lastDesktopCommand).toBe('visual-scripting');
    expect(root.querySelector('[data-desktop-command="visual-scripting"]')?.classList.contains('selected')).toBe(true);
    expectDesktopCommandWindow(root, 'visual-scripting', '可视化脚本');
    expect(root.querySelector('[data-desktop-command-window]')?.textContent).toContain('拖拽节点');
    expect(root.querySelector('[data-desktop-command-window]')?.textContent).toContain('查看 Trace');

    root.querySelector('[data-desktop-nav="render"]').click();
    expect(hub?.dataset.activeDesktopSection).toBe('render');
    expect(visiblePanels()).toHaveLength(1);
    expect(visiblePanels()[0]?.dataset.desktopFeatureGroup).toBe('render-performance');
    expect(root.querySelector('[data-desktop-feature-group="render-performance"]')?.classList.contains('is-focused')).toBe(true);
    expect(root.querySelector('[data-desktop-section-count]')?.textContent).toContain('渲染与性能');

    search.value = 'GLTF';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const visibleCards = cards.filter((card) => !card.hidden);
    expect(visibleCards.length).toBeGreaterThan(0);
    expect(visibleCards.every((card) => card.textContent.toLowerCase().includes('gltf'))).toBe(true);
    expect(root.querySelector('[data-desktop-search-count]')?.textContent).toContain(String(visibleCards.length));

    app.destroy();
  });

  it('opens desktop launcher commands in complete focused feature windows with real execution feedback', async () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: {
        scene: {
          entities: []
        }
      }
    });

    const commandSamples = [
      ['template-rpg', '剧情 RPG'],
      ['assets', '资源库'],
      ['hot-reload', '热重载'],
      ['scene-3d-demo', '3D 场景 Demo'],
      ['webgpu-diagnostics', 'WebGPU 诊断'],
      ['wechat-export', '微信小游戏导出'],
      ['beginner-tutorial', '0 基础新手教程'],
      ['governance-report', '项目治理报告']
    ];

    for (const [commandId, title] of commandSamples) {
      root.querySelector(`[data-desktop-command="${commandId}"]`)?.click();
      await Promise.resolve();
      expectDesktopCommandWindow(root, commandId, title);
      expect(root.querySelector('[data-desktop-command-window]')?.textContent).toContain('执行结果');
      expect(root.querySelector('[data-desktop-command-window]')?.textContent).toContain('下一步');
    }

    root.querySelector('[data-desktop-command-window-close]')?.click();
    expect(root.querySelector('[data-desktop-command-window]')).toBeFalsy();

    app.destroy();
  });

  it('connects all major engine strengths through a compact launcher capability matrix', async () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: {
        scene: {
          entities: []
        }
      }
    });

    const matrix = root.querySelector('[data-desktop-capability-matrix]');
    const rows = [...root.querySelectorAll('[data-desktop-capability-row]')];

    expect(matrix).toBeTruthy();
    expect(matrix?.textContent).toContain('能力矩阵');
    expect(rows).toHaveLength(8);
    expect(rows.map((row) => row.dataset.desktopCapabilityRow)).toEqual([
      '2d-authoring',
      '25d-world',
      '3d-runtime',
      'visual-logic',
      'asset-pipeline',
      'render-performance',
      'physics-debug',
      'publish-quality'
    ]);

    for (const row of rows) {
      expect(row.querySelector('[data-desktop-capability-source]')?.textContent.trim()).not.toBe('');
      expect(row.querySelector('[data-desktop-capability-target]')?.textContent.trim()).not.toBe('');
      expect(row.querySelector('[data-desktop-capability-status]')?.textContent.trim()).toMatch(/已接入|可执行|实时|闭环/);
      expect(row.querySelector('[data-desktop-capability-open]')?.dataset.desktopCommand).toBeTruthy();
      expect(row.querySelector('[data-desktop-icon-source="lucide-static"] svg')).toBeTruthy();
    }

    const threeRuntime = root.querySelector('[data-desktop-capability-row="3d-runtime"]');
    expect(threeRuntime?.textContent).toContain('Three.js');
    expect(threeRuntime?.textContent).toContain('GLTF');
    expect(threeRuntime?.textContent).toContain('scene-3d-viewport');

    threeRuntime?.querySelector('[data-desktop-capability-open]')?.click();
    await Promise.resolve();
    expectDesktopCommandWindow(root, 'scene-3d-demo', '3D 场景 Demo');
    expect(root.querySelector('[data-desktop-command-window]')?.textContent).toContain('examples/3d-runtime-demo');
    expect(app.getDockLayout().center).toContain('scene-3d-viewport');

    const assetPipeline = root.querySelector('[data-desktop-capability-row="asset-pipeline"]');
    assetPipeline?.querySelector('[data-desktop-capability-open]')?.click();
    await Promise.resolve();
    expectDesktopCommandWindow(root, 'asset-refresh', '资源增量刷新');
    expect(root.querySelector('[data-editor-feedback]')?.textContent).toContain('资源库已增量刷新');

    app.destroy();
  });

  it('starts with an unobstructed launcher and exposes resizable editor splitters', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: {
        scene: {
          entities: []
        }
      }
    });

    const frame = root.querySelector('.editor-frame');
    const shell = root.querySelector('.editor-shell');
    const workspaceResizer = root.querySelector('[data-editor-workspace-resizer]');

    expect(frame?.dataset.workspaceMode).toBe('launcher');
    expect(shell?.getAttribute('aria-hidden')).toBe('true');
    expect(workspaceResizer).toBeTruthy();
    expect(workspaceResizer?.dataset.workspaceMode).toBe('launcher');
    expect([...root.querySelectorAll('[data-dock-resizer]')].map((node) => node.dataset.dockResizer)).toEqual([
      'left',
      'bottom',
      'right'
    ]);

    workspaceResizer.click();
    expect(frame?.dataset.workspaceMode).toBe('editor');
    expect(shell?.getAttribute('aria-hidden')).toBe('false');
    expect(workspaceResizer?.dataset.workspaceMode).toBe('editor');

    root.querySelector('[data-desktop-command="visual-scripting"]').click();
    expect(frame?.dataset.workspaceMode).toBe('editor');
    expect(app.getDockLayout().center).toContain('visual-scripting');

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
