import { test, expect } from '@playwright/test';

test.describe('Leaderboard - strategy never exposed', () => {
  test('leaderboard page loads', async ({ page }) => {
    await page.goto('/leaderboard');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('no allocation percentages in DOM (PRD §5.5)', async ({ page }) => {
    await page.goto('/leaderboard');
    await page.waitForTimeout(1500);

    const bodyText = await page.locator('body').innerText();

    // Must NOT contain strategy allocation keywords
    expect(bodyText).not.toMatch(/allocation.*%|ETH\s+\d+%|USDC\s+\d+%|ARB\s+\d+%|WBTC\s+\d+%/i);
    expect(bodyText).not.toContain('Strategy Details');
  });

  test('wrong network banner absent on correct chain', async ({ page }) => {
    await page.goto('/leaderboard');
    const banner = page.locator('[data-testid="wrong-network-banner"]');
    const count = await banner.count();
    expect(count).toBe(0);
  });
});
