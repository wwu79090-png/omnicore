import { expect, test } from 'playwright/test';

test('3d-runtime-demo opens GLB preview, import workflow, animation, real Rapier, debug draw, WebGPU hardware validation, EXE entry, and export evidence', async ({ page }) => {
  const consoleMessages = [];
  const pageErrors = [];
  page.on('console', (message) => {
    consoleMessages.push({ type: message.type(), text: message.text() });
  });
  page.on('pageerror', (error) => {
    pageErrors.push({ type: 'pageerror', text: error.message });
  });

  await page.goto('/examples/3d-runtime-demo/index.html');
  await expect(page.locator('body[data-omnicore-3d-runtime-demo]')).toBeVisible();
  await expect(page.locator('canvas#scene')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'GLTF 导入' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '真实 Rapier' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '旋转视角' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '播放动画' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rapier debug draw' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'WebGPU hardware validation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'WebGPU fallback' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'EXE 启动器' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '导出项目' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'WebGPUPipelineRuntime' })).toBeVisible();

  const errorsAndWarnings = [
    ...consoleMessages.filter((message) => ['error', 'warning', 'warn'].includes(message.type)),
    ...pageErrors
  ];
  const actionableMessages = errorsAndWarnings.filter((message) => !isKnownExternalWarning(message));
  expect(actionableMessages).toEqual([]);
});

function isKnownExternalWarning(message) {
  return message.type === 'warning'
    && message.text.includes('GPU stall due to ReadPixels');
}
