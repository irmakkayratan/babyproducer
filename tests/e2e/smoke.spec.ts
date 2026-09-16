import { expect, test } from '@playwright/test';

test.describe('foundation', () => {
  test('landing offers the three doors and shows local-only status', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Run the whole show');
    await expect(page.getByRole('button', { name: /Explore the demo/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Start from a template/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Start blank/ })).toBeVisible();
    await expect(page.getByTestId('status-chip')).toBeVisible();
  });

  test('a blank workspace and an event can be created end to end', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Start blank/ }).click();

    await expect(page).toHaveURL(/\/w\/[A-Z0-9]+$/);
    await expect(page.getByRole('heading', { name: 'No events yet' })).toBeVisible();

    await page.getByRole('button', { name: /Create your first event/ }).click();
    await page.getByLabel('Name').fill('Playwright Showcase');
    await page.getByRole('button', { name: /Blank/ }).click();
    await page.getByRole('button', { name: 'Create event' }).click();

    await expect(page).toHaveURL(/\/events\/[A-Z0-9]+\/overview$/);
    await expect(page.getByRole('heading', { name: 'Playwright Showcase' })).toBeVisible();
    await expect(page.getByText('Doors in')).toBeVisible();
  });

  test('data survives a reload — the device holds the primary copy', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Start blank/ }).click();
    await page.getByRole('button', { name: /Create your first event/ }).click();
    await page.getByLabel('Name').fill('Persisted Event');
    await page.getByRole('button', { name: 'Create event' }).click();
    await expect(page.getByRole('heading', { name: 'Persisted Event' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Persisted Event' })).toBeVisible();
  });

  test('a deep link resolves through the SPA fallback', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Start blank/ }).click();
    // Wait for the navigation to land before reading the URL, or under load
    // we deep-link back to the landing page and test nothing.
    await expect(page).toHaveURL(/\/w\/[A-Z0-9]+$/);
    const url = page.url();
    await page.goto(url);
    await expect(page.getByRole('heading', { name: 'No events yet' })).toBeVisible();
  });
});
