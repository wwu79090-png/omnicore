import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'playwright/test';

test('online scene editor supports drag, save, and visual baseline comparison', async ({ page }, testInfo) => {
  await page.goto('/website/editor/index.html');
  await expect(page.getByText('editor.omnicore.dev')).toBeVisible();
  const saveButton = page.locator('#saveScene');
  await expect(saveButton).toBeVisible();

  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box.x + 110, box.y + 110);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + 150, { steps: 6 });
  await page.mouse.up();
  await saveButton.click();

  await expect(page.locator('#output')).toContainText('localStorage');
  await expect(page.locator('#output')).toContainText('"entities"');

  const screenshot = await page.screenshot({ fullPage: true });
  const snapshotDir = path.resolve('tests/e2e/__screenshots__');
  const projectName = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const current = path.join(snapshotDir, `editor-current-${projectName}.png`);
  mkdirSync(snapshotDir, { recursive: true });
  writeFileSync(current, screenshot);

  if (testInfo.project.name === 'chromium') {
    await expect(page).toHaveScreenshot('editor-baseline.png', {
      fullPage: true,
      mask: [page.getByText(/^FPS:/)],
      maxDiffPixelRatio: 0.12,
      threshold: 0.25
    });
  } else {
    expect(screenshot.length).toBeGreaterThan(1000);
  }
});
