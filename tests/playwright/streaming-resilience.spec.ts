import { test, expect } from '@playwright/test';

test.skip(!process.env.GATE_GB_STREAMING_URL, 'GATE_GB_STREAMING_URL not configured');

test('StreamingStatusPanel emits heartbeat updates within five seconds', async ({ page }) => {
  const targetUrl = process.env.GATE_GB_STREAMING_URL!;

  await page.goto(targetUrl);

  const heartbeat = page.getByTestId('streaming-heartbeat');
  await expect(heartbeat).toHaveAttribute('data-status', 'online', { timeout: 5000 });
});
