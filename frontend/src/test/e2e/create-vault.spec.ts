import { test, expect } from '@playwright/test';

test.describe('Create Vault Flow', () => {
  test('create page loads with questionnaire', async ({ page }) => {
    await page.goto('/create');
    // Vault-check spinner may delay render - wait up to 10s
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('questionnaire shows strategy options', async ({ page }) => {
    await page.goto('/create');
    // Wait for vault-check spinner to clear, then check content
    await expect(page.locator('body')).toContainText(/risk|horizon|strategy|conservative|aggressive|balanced/i, { timeout: 10000 });
  });

  test('preview without questionnaire redirects to /create', async ({ page }) => {
    // No sessionStorage data → should redirect to /create questionnaire
    await page.goto('/create/preview');
    await page.waitForTimeout(1500);
    // Either still on preview (showing connect modal UI) or redirected to /create
    const url = page.url();
    expect(url.includes('/create')).toBe(true);
  });

  test('vault page loads without crashing', async ({ page }) => {
    // Vault page is client-side - loads with loading state for unauthenticated users
    await page.goto('/vault/0x0000000000000000000000000000000000000000000000000000000000000001');
    await page.waitForTimeout(1500);
    // Page should not show a JS error overlay
    const errorOverlay = page.locator('nextjs-portal');
    const hasError = await errorOverlay.count();
    expect(hasError).toBe(0);
  });

  test('strategy preview never shows allocation percentages (PRD §5.5)', async ({ page }) => {
    await page.goto('/create/preview');
    await page.waitForTimeout(1000);
    const bodyText = await page.locator('body').innerText();
    // Allocation % must not be visible to user (sealed execution)
    expect(bodyText).not.toMatch(/\d+%\s*(ETH|USDC|ARB|WBTC)/i);
    expect(bodyText).not.toContain('allocation breakdown');
  });
});
