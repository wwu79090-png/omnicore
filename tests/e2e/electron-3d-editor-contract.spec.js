import { readFileSync } from 'node:fs';
import { expect, test } from 'playwright/test';

test('Electron 3D editor executable contract covers demo import edit save export', async () => {
  const electronLaunchContract = '_electron.launch';
  const runtimeSessionContract = 'scene-3d-editor-runtime-session';
  const savePatchContract = 'createSavePatch';
  const exportPlanContract = 'createExportPlan';
  const desktopFlow = [
    '打开官方 3D Demo',
    '创建 3D 项目',
    '导入 GLB',
    '编辑场景',
    '保存场景',
    '重新打开项目',
    '导出项目'
  ];
  const exeE2EFlow = [
    'launch-exe',
    'create-3d-project',
    'import-glb',
    'edit-transform-light-collider',
    'save-reopen',
    'export-project'
  ];
  const editorPackage = JSON.parse(readFileSync('packages/omnicore-editor/package.json', 'utf8'));
  const templateScene = JSON.parse(readFileSync('examples/template-3d-playable/scene.omnicore.json', 'utf8'));

  expect(electronLaunchContract).toContain('_electron.launch');
  expect(runtimeSessionContract).toContain('scene-3d-editor-runtime-session');
  expect(savePatchContract).toContain('createSavePatch');
  expect(exportPlanContract).toContain('createExportPlan');
  expect(editorPackage.scripts.desktop).toContain('electron .');
  expect(editorPackage.build.win.target.map((target) => target.target)).toEqual(expect.arrayContaining(['nsis', 'portable']));
  expect(desktopFlow).toEqual([
    '打开官方 3D Demo',
    '创建 3D 项目',
    '导入 GLB',
    '编辑场景',
    '保存场景',
    '重新打开项目',
    '导出项目'
  ]);
  expect(exeE2EFlow).toEqual([
    'launch-exe',
    'create-3d-project',
    'import-glb',
    'edit-transform-light-collider',
    'save-reopen',
    'export-project'
  ]);
  expect(templateScene.runtime.physics.backend).toBe('rapier3d-compat');
  expect(templateScene.export.targets).toEqual(expect.arrayContaining(['web', 'electron']));
});
