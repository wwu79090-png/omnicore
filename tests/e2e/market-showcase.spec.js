import { expect, test } from 'playwright/test';

test('market showcase renders and switches 2.5D story mode without console noise', async ({ page }) => {
  const consoleMessages = [];
  const pageErrors = [];
  page.on('console', (message) => {
    consoleMessages.push({
      type: message.type(),
      text: message.text()
    });
  });
  page.on('pageerror', (error) => {
    pageErrors.push({
      type: 'pageerror',
      text: error.message
    });
  });

  await page.goto('/examples/market-showcase/index.html');
  await expect(page.locator('body[data-market-showcase]')).toBeVisible();
  await expect(page.locator('[data-html-overlay]')).toContainText('1000 Sprite');
  await expect(page.locator('canvas').first()).toBeVisible();

  await page.getByRole('button', { name: '2.5D 故事' }).click();
  await expect(page.getByRole('button', { name: '2.5D 故事' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => globalThis.OmniCoreMarketShowcase?.htmlOverlayState?.mode)).toBe('story');

  const screenshot = await page.screenshot({ fullPage: false });
  const errorsAndWarnings = [
    ...consoleMessages.filter((message) => ['error', 'warning', 'warn'].includes(message.type)),
    ...pageErrors
  ];
  expect(screenshot.length).toBeGreaterThan(1000);
  expect(errorsAndWarnings).toEqual([]);
});
