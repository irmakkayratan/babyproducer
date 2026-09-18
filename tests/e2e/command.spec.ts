import { expect, test, type Page } from '@playwright/test';

async function openDemoCommand(page: Page, eventName = /Brand Launch/) {
  await page.goto('/demo');
  await expect(page).toHaveURL(/\/w\/[A-Z0-9]+$/, { timeout: 30_000 });
  await page.getByRole('link', { name: eventName }).click();
  await page.getByRole('link', { name: 'Command', exact: true }).first().click();
  await expect(page.getByTestId('command-grid')).toBeVisible();
}

test.describe('command center', () => {
  test('opens with a populated dashboard over seeded telemetry', async ({ page }) => {
    await openDemoCommand(page);
    const widgets = await page.getByTestId('widget').count();
    expect(widgets).toBeGreaterThan(5);
    await expect(page.locator('[data-widget=arrivals]')).toContainText('In the room');
    await expect(page.locator('[data-widget=systems]')).toContainText('%');
  });

  test('a widget can be added and removed, and the layout persists', async ({ page }) => {
    await openDemoCommand(page);
    const before = await page.getByTestId('widget').count();

    await page.getByRole('button', { name: 'Add widget' }).click();
    await page.getByRole('menuitem', { name: /Interactions/ }).click();
    await expect(page.getByTestId('widget')).toHaveCount(before + 1);

    await page.reload();
    await expect(page.getByTestId('command-grid')).toBeVisible();
    await expect(page.getByTestId('widget')).toHaveCount(before + 1);

    await page.locator('[data-widget=interactions]').first().hover();
    await page.getByRole('button', { name: /^Remove Interactions/ }).first().click();
    await expect(page.getByTestId('widget')).toHaveCount(before);
  });

  test('widget settings change what a widget reports', async ({ page }) => {
    await openDemoCommand(page);
    const widget = page.locator('[data-widget=metric-total]').first();
    await widget.hover();
    await widget.getByRole('button', { name: /^Settings for/ }).click();
    await page.getByLabel('Scope').click();
    await page.getByRole('option', { name: 'Whole guest list' }).click();
    await expect(widget).toContainText('whole list');
  });

  test('the alerts widget reports a breached threshold from the simulated feed', async ({ page }) => {
    await openDemoCommand(page);
    await expect(page.locator('[data-widget=alerts]')).toBeVisible();
  });

  test('resetting the layout restores the default arrangement', async ({ page }) => {
    await openDemoCommand(page);
    await page.getByRole('button', { name: 'Add widget' }).click();
    await page.getByRole('menuitem', { name: /Next cue/ }).click();
    const grown = await page.getByTestId('widget').count();

    await page.getByRole('button', { name: 'Reset layout' }).click();
    await expect(page.getByTestId('widget')).not.toHaveCount(grown);
  });
});
