import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/playwright',
  timeout: 30 * 1000,
  retries: 0,
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    headless: true,
  },
});
