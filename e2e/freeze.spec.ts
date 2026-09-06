import { test, expect } from '@playwright/test';

test.describe('Streak Freeze Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home and click sign in
    await page.goto('/');
    await page.click('text=Sign in with GitHub');
    
    // Wait for dashboard to load
    await page.waitForURL('/dashboard');
    await page.waitForSelector('text=Streak Protection');
  });

  test('shows freeze widget with 1 token available', async ({ page }) => {
    // Check the widget displays correctly
    await expect(page.locator('text=1 token remaining')).toBeVisible();
    await expect(page.locator('text=Available')).toBeVisible();
    await expect(page.locator('button:has-text("Freeze Streak")')).toBeEnabled();
  });

  test('applies freeze when button is clicked', async ({ page }) => {
    // Click the freeze button
    await page.click('button:has-text("Freeze Streak")');
    
    // Wait for the success message
    await expect(page.locator('text=Streak frozen successfully! ❄️')).toBeVisible();
    
    // Verify the widget updates
    await expect(page.locator('text=0 tokens remaining')).toBeVisible();
    await expect(page.locator('text=Not available')).toBeVisible();
    await expect(page.locator('text=Last Freeze')).toBeVisible();
  });

  test('shows freeze history after freezing', async ({ page }) => {
    // Click freeze
    await page.click('button:has-text("Freeze Streak")');
    await page.waitForSelector('text=Streak frozen successfully! ❄️');
    
    // Check history section
    await expect(page.locator('text=Recent Freezes')).toBeVisible();
    await expect(page.locator('text=Manual freeze')).toBeVisible();
  });
});