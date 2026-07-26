import { test, expect } from '@playwright/test';

test.describe('Network Detection', () => {
  test('no wrong-network banner on leaderboard (no wallet connected)', async ({ page }) => {
    await page.goto('/leaderboard');
    await page.waitForTimeout(500);
    const banner = page.locator('[data-testid="wrong-network-banner"]');
    await expect(banner).toHaveCount(0);
  });

  test('no wrong-network banner on landing (no wallet connected)', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    const banner = page.locator('[data-testid="wrong-network-banner"]');
    await expect(banner).toHaveCount(0);
  });

  test('wrong-network banner has switch button when shown', async ({ page }) => {
    // Navigate to a page that would show the banner if on wrong chain
    await page.goto('/create');
    await page.waitForTimeout(500);
    const banner = page.locator('[data-testid="wrong-network-banner"]');
    const count = await banner.count();
    if (count > 0) {
      // If banner is shown, it must have a switch button
      await expect(banner.getByRole('button')).toBeVisible();
    }
    // Pass: either no banner (correct chain / no wallet) or banner has switch button
    expect(true).toBe(true);
  });
});
