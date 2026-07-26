import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('loads with correct hero text', async ({ page }) => {
    await page.goto('/');
    // First hit triggers Next.js dev compilation - can take 20-30s on Windows
    await expect(page.locator('h1')).toContainText('strategy', { timeout: 30000 });
    await expect(page.getByText('Create My Vault')).toBeVisible();
    await expect(page.getByText('View Leaderboard')).toBeVisible();
  });

  test('three pillars visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Personalized')).toBeVisible();
    await expect(page.getByText('Sealed Execution')).toBeVisible();
    await expect(page.getByText('Followable Alpha')).toBeVisible();
  });

  test('Create My Vault navigates to /create', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Create My Vault').click();
    await expect(page).toHaveURL('/create');
  });

  test('View Leaderboard navigates to /leaderboard', async ({ page }) => {
    await page.goto('/');
    await page.getByText('View Leaderboard').click();
    await expect(page).toHaveURL('/leaderboard');
  });
});
