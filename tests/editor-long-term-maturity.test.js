import { describe, expect, it, vi } from 'vitest';
import { createEditorApp } from 'omnicore-editor/src/editor-app.js';
import { createEditorState } from 'omnicore-editor/src/live-sync-protocol.js';
import { buildEditorLongTermMaturity } from '../src/editor/EditorLongTermMaturity.js';

describe('editor long-term maturity', () => {
  it('exports governance, asset workflow, and collaboration evidence for mature teams', () => {
    const root = document.createElement('main');
    window.omnicoreEditor = {
      saveSnapshot: vi.fn(async () => ({ ok: true, path: 'project.omni' })),
      saveDatabaseConfig: vi.fn(async () => ({ ok: true, path: 'config/data.json' }))
    };
    document.body.appendChild(root);

    const app = createEditorApp(root, {
      state: createEditorState({
        workspace: {
          root: 'C:/studio/space-rpg',
          name: 'space-rpg',
          directories: ['assets', 'src', 'scenes', 'config'],
          assets: [
            { path: 'assets/hero.webp', type: 'image' },
            { path: 'assets/ui/start.json', type: 'json' },
            { path: 'scenes/level-1.scene.json', type: 'scene' }
          ],
          sourceFiles: ['src/main.js', 'src/player.js'],
          scenes: ['scenes/level-1.scene.json']
        },
        scene: {
          name: 'level-1',
          entities: [
            { id: 'hero', name: 'Hero', texture: 'assets/hero.webp', x: 4, y: 8, width: 32, height: 32 },
            { id: 'npc', name: 'NPC', texture: 'assets/hero.webp', x: 60, y: 8, width: 32, height: 32 }
          ]
        },
        projectFiles: {
          'src/main.js': 'export function boot() {}',
          'src/player.js': 'export const speed = 120;',
          'config/data.json': '{"version":1}'
        },
        buildSettings: {
          targets: ['web', 'wechat'],
          budgets: { maxBundleKb: 900, maxWechatBytes: 4194304 }
        },
        dockLayout: {
          left: ['hierarchy', 'assets'],
          center: ['scene-view'],
          right: ['inspector', 'database'],
          bottom: ['graph-editor', 'profiler']
        }
      })
    });

    app.EditorAPI.createNPCProximityRecipe({ npcId: 'npc', playerId: 'hero', animation: 'talk', dialog: 'Ready' });
    app.EditorAPI.addUIButton({ id: 'start', text: 'Start', action: 'scene:start' });
    app.recordProfilerFrame({ frame: 1, totalMs: 15, sections: [{ name: 'render', duration: 9.5 }] });

    const assetIndex = app.createAssetWorkflowIndex();
    const handoff = app.createCollaborationHandoff({ author: 'designer', reviewer: 'engineer', note: 'handoff-ready' });
    const governance = app.createProjectGovernanceReport();
    const bundle = app.exportMatureEditorBundle({ author: 'designer', reviewer: 'engineer', generatedAt: '2026-06-20T00:00:00.000Z' });
    const maturity = buildEditorLongTermMaturity({ app });

    expect(assetIndex).toMatchObject({
      totalAssets: 3,
      byType: expect.objectContaining({ image: 1, json: 1, scene: 1 }),
      sceneReferences: expect.arrayContaining([
        expect.objectContaining({ entityId: 'hero', path: 'assets/hero.webp', resolved: true })
      ]),
      orphanAssets: expect.arrayContaining(['assets/ui/start.json'])
    });
    expect(handoff).toMatchObject({
      format: 'OmniCore.EditorCollaborationHandoff',
      author: 'designer',
      reviewer: 'engineer',
      note: 'handoff-ready',
      readiness: expect.objectContaining({ ready: true }),
      files: expect.objectContaining({ projectFiles: 3, assets: 3, scenes: 1 })
    });
    expect(governance).toMatchObject({
      format: 'OmniCore.EditorGovernanceReport',
      workspace: expect.objectContaining({ name: 'space-rpg' }),
      coverage: expect.objectContaining({
        projectFiles: 3,
        assets: 3,
        buildTargets: expect.arrayContaining(['web', 'wechat'])
      }),
      checklist: expect.arrayContaining([
        expect.objectContaining({ id: 'asset-workflow-index', status: 'covered' }),
        expect.objectContaining({ id: 'collaboration-handoff', status: 'covered' })
      ])
    });
    expect(bundle).toMatchObject({
      format: 'OmniCore.MatureEditorBundle',
      generatedAt: '2026-06-20T00:00:00.000Z',
      assetWorkflow: expect.objectContaining({ totalAssets: 3 }),
      collaboration: expect.objectContaining({ reviewer: 'engineer' }),
      governance: expect.objectContaining({ format: 'OmniCore.EditorGovernanceReport' })
    });
    expect(maturity).toMatchObject({
      target: 95,
      score: expect.any(Number),
      ready: true,
      evidence: {
        assetWorkflowIndex: true,
        collaborationHandoff: true,
        projectGovernance: true,
        matureEditorBundle: true,
        workspaceCoverage: true,
        editorAutomationSurface: true
      }
    });
    expect(maturity.score).toBeGreaterThanOrEqual(95);
    app.destroy();
  });
});
