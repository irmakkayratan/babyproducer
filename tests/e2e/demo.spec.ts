import { expect, test, type Page } from '@playwright/test';

async function loadDemo(page: Page) {
  await page.goto('/demo');
  await expect(page).toHaveURL(/\/w\/[A-Z0-9]+$/, { timeout: 30_000 });
  await expect(page.getByTestId('demo-banner')).toBeVisible();
}

async function firstGuestName(page: Page): Promise<string> {
  await page.getByRole('link', { name: /Club Night/ }).click();
  await page.getByRole('link', { name: 'Guests', exact: true }).first().click();
  await expect(page.getByTestId('guest-table-scroll')).toBeVisible();
  return page.getByTestId('guest-row').first().getByTestId('guest-name').innerText();
}

test.describe('demo experience', () => {
  test('the banner says what the data is and offers a way out', async ({ page }) => {
    await loadDemo(page);
    const banner = page.getByTestId('demo-banner');
    await expect(banner).toContainText('Demo data');
    await expect(banner.getByRole('button', { name: /Copy to my workspace/ })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Reset' })).toBeVisible();
  });

  test('each production is named for what it is, with the detail underneath', async ({ page }) => {
    await loadDemo(page);
    for (const [name, subtitle] of [
      ['Club Night', 'Electronic, 700 cap'],
      ['Festival Stage', 'Main stage, one day'],
      ['Brand Launch', 'Keynote and reception'],
      ['Tour Date', 'Two day load-in'],
    ]) {
      const card = page.getByRole('link', { name: new RegExp(name) });
      await expect(card).toBeVisible();
      await expect(card).toContainText(subtitle);
    }
  });

  test('reset rebuilds byte-identical data from the same seed', async ({ page }) => {
    await loadDemo(page);
    const before = await firstGuestName(page);

    await page.getByRole('link', { name: 'Events' }).click();
    await page.getByTestId('demo-banner').getByRole('button', { name: 'Reset' }).click();
    await page.getByRole('button', { name: 'Rebuild demo data' }).click();
    await expect(page.getByText('Demo data rebuilt')).toBeVisible({ timeout: 30_000 });

    const after = await firstGuestName(page);
    expect(after).toBe(before);
  });

  test('forking copies the demo into a workspace of your own', async ({ page }) => {
    await loadDemo(page);
    await page.getByTestId('demo-banner').getByRole('button', { name: /Copy to my workspace/ }).click();
    await expect(page.getByText('Copied into your own workspace')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('demo-banner')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Club Night/ })).toBeVisible();
  });

  test('the tour walks the product and can be finished', async ({ page }) => {
    await loadDemo(page);
    await page.getByRole('button', { name: /Take the tour/ }).click();
    const tour = page.getByTestId('tour');
    await expect(tour).toContainText('Step 1 of 8');
    await expect(page).toHaveURL(/\/guests$/);

    await tour.getByRole('button', { name: 'Next' }).click();
    await expect(tour).toContainText('Step 2 of 8');
    await expect(page).toHaveURL(/\/seating$/);

    // Walk the rest of the tour to its end.
    for (let step = 0; step < 7; step++) {
      await tour.getByRole('button', { name: /Next|Finish/ }).click();
    }
    await expect(tour).toHaveCount(0);

    // Finished once, never nagged again.
    await page.reload();
    await expect(page.getByTestId('tour')).toHaveCount(0);
  });

  test('diagnostics report where the data lives', async ({ page }) => {
    await loadDemo(page);
    await page.getByRole('link', { name: 'Studio' }).click();
    await page.getByRole('tab', { name: 'Data' }).click();
    const panel = page.getByTestId('diagnostics');
    await expect(panel).toContainText('Storage');
    await expect(panel).toContainText('guests');
  });
});
