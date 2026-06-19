import { defineConfig, devices } from 'playwright/test';

const samsungGalaxyS10 = {
  viewport: { width: 360, height: 760 },
  userAgent: 'Mozilla/5.0 (Linux; Android 12; Samsung Galaxy S10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  defaultBrowserType: 'chromium'
};

export default defineConfig({
  testDir: 'tests/e2e',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:43174',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 43174 --strictPort',
    url: 'http://127.0.0.1:43174/website/editor/index.html',
    reuseExistingServer: false,
    timeout: 30000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'iPhone 12',
      use: { ...devices['iPhone 12'] }
    },
    {
      name: 'Pixel 5',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'Samsung Galaxy S10',
      use: { ...samsungGalaxyS10 }
    }
  ]
});
