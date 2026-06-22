import { afterEach, describe, expect, it } from 'vitest';
import { createEditorApp } from 'omnicore-editor/src/editor-app.js';
import { createEditorState } from 'omnicore-editor/src/live-sync-protocol.js';

describe('mature desktop editor UI', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a dock workbench, toolbar commands, status bar, and keyboard shortcuts', () => {
    const sent = [];
    const root = document.createElement('main');
    document.body.appendChild(root);

    const app = createEditorApp(root, {
      state: createEditorState({
        scene: {
          name: 'maturity-scene',
          entities: [{ id: 'hero', name: 'Hero', x: 10, y: 16, width: 32, height: 32 }]
        },
        dockLayout: {
          left: ['hierarchy', 'prefabs', 'assets'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['animation-timeline', 'tilemap', 'flow-graph']
        }
      }),
      transport: {
        send(message) {
          sent.push(JSON.parse(message));
        }
      }
    });

    expect(root.querySelector('[data-editor-toolbar]')).toBeTruthy();
    expect(root.querySelector('[data-dock-layout]')).toBeTruthy();
    expect(root.querySelector('[data-editor-statusbar]')?.textContent).toContain('maturity-scene');
    expect([...root.querySelectorAll('[data-dock-region]')].map((node) => node.dataset.dockRegion)).toEqual(
      expect.arrayContaining(['left', 'center', 'right', 'bottom'])
    );
    expect(root.querySelector('[data-panel="flow-graph"]')?.textContent).toContain('流程图');
    expect([...root.querySelectorAll('[data-editor-tool]')].map((node) => node.dataset.editorTool)).toEqual(
      expect.arrayContaining(['save', 'undo', 'redo', 'play', 'pause', 'dock-reset'])
    );
    expect(app.getDockLayout()).toMatchObject({ center: ['scene-view'], right: ['inspector'] });

    const xInput = root.querySelector('[data-inspector-field="x"]');
    xInput.value = '48';
    xInput.dispatchEvent(new Event('input', { bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Z',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true
    }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
    root.querySelector('[data-editor-tool="play"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(app.getState().simulation.active).toBe(true);
    expect(sent.map((message) => message.type)).toEqual(expect.arrayContaining([
      'editor:update-entity',
      'editor:undo',
      'editor:redo',
      'editor:save-snapshot',
      'editor:play'
    ]));

    app.setDockLayout({ left: ['assets'], center: ['scene-view'], right: ['inspector'], bottom: ['animation-timeline'] });
    expect(root.querySelector('[data-dock-region="left"]')?.textContent).toContain('资源');
    app.destroy();
  });

  it('edits a flow graph panel and exports EventSheet JSON for runtime logic', () => {
    const sent = [];
    const root = document.createElement('main');
    document.body.appendChild(root);

    const app = createEditorApp(root, {
      state: createEditorState({
        flowGraph: {
          nodes: [
            {
              id: 'on-start',
              type: 'event',
              label: 'Game Start',
              x: 16,
              y: 18,
              data: { when: { onStart: true } }
            },
            {
              id: 'has-key',
              type: 'condition',
              label: 'Has Key',
              x: 190,
              y: 18,
              scope: { doorId: 'north' },
              data: { op: 'equals', left: 'state.key', right: true }
            },
            {
              id: 'open-door',
              type: 'action',
              label: 'Open Door',
              x: 360,
              y: 18,
              data: { op: 'set', target: 'state.door', value: 'open' }
            }
          ],
          edges: [
            { from: 'on-start', to: 'has-key' },
            { from: 'has-key', to: 'open-door' }
          ]
        },
        dockLayout: {
          left: ['hierarchy'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['flow-graph']
        }
      }),
      transport: {
        send(message) {
          sent.push(JSON.parse(message));
        }
      }
    });

    expect(root.querySelector('[data-flow-node-id="on-start"]')?.textContent).toContain('Game Start');
    expect(root.querySelector('[data-flow-edge="on-start->has-key"]')?.textContent).toContain('Game Start -> Has Key');

    const eventSheet = app.exportFlowGraphEventSheet();
    expect(eventSheet.events[0]).toMatchObject({
      name: 'Game Start',
      when: { onStart: true },
      actions: [{ op: 'set', target: 'state.door', value: 'open' }]
    });
    expect(eventSheet.events[0].conditions[0].scope).toEqual({ doorId: 'north' });

    root.querySelector('[data-flow-export="eventsheet"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(sent.at(-1)).toMatchObject({
      type: 'editor:flow-graph-export',
      payload: { eventSheet }
    });

    app.destroy();
  });
});
