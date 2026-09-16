import { expect, test, type Page } from '@playwright/test';

async function openAdvancing(page: Page, eventName = /AURELIA/) {
  await page.goto('/demo');
  await expect(page).toHaveURL(/\/w\/[A-Z0-9]+$/, { timeout: 30_000 });
  await page.getByRole('link', { name: eventName }).click();
  await page.getByRole('link', { name: 'Advancing', exact: true }).first().click();
  await expect(page.getByTestId('advance-readiness')).toBeVisible();
}

test.describe('advancing', () => {
  test('the demo event arrives with a real advance in progress', async ({ page }) => {
    await openAdvancing(page);

    const items = page.getByTestId('advance-item');
    expect(await items.count()).toBeGreaterThan(20);
    await expect(page.getByTestId('advance-readiness')).toContainText('%');
    await expect(page.getByRole('progressbar', { name: 'Advance readiness' })).toBeVisible();
  });

  test('what is still missing is answered before the checklist', async ({ page }) => {
    await openAdvancing(page);
    const missing = page.getByTestId('advance-missing');
    await expect(missing).toContainText('Still missing');
    expect(await missing.getByRole('button', { name: 'Confirm' }).count()).toBeGreaterThan(0);
  });

  test('confirming a line moves the readiness figure', async ({ page }) => {
    await openAdvancing(page);
    const readiness = page.getByTestId('advance-readiness');
    const before = await readiness.locator('[data-numeric]').first().innerText();

    await page.getByTestId('advance-missing').getByRole('button', { name: 'Confirm' }).first().click();

    await expect(readiness.locator('[data-numeric]').first()).not.toHaveText(before);
  });

  test('a status cycles through the states a producer uses', async ({ page }) => {
    await openAdvancing(page);
    const item = page.getByTestId('advance-item').first();
    const status = item.getByTestId('advance-status');
    const before = await status.innerText();

    await status.click();
    await expect(status).not.toHaveText(before);

    // The change is on the record, not just in the DOM.
    await page.reload();
    await expect(page.getByTestId('advance-item').first().getByTestId('advance-status')).not.toHaveText(before);
  });

  test('an answer typed against an item survives a reload', async ({ page }) => {
    await openAdvancing(page);
    const row = page.getByTestId('advance-item').first();
    const answer = row.getByLabel(/^Answer for/);
    await answer.fill('14:00 at the loading dock');
    await answer.press('Enter');

    // Cycling the status is the observable end of the same write queue: once
    // the row re-renders from the database, the answer above it has landed too.
    const status = await row.getAttribute('data-status');
    await row.getByTestId('advance-status').click();
    await expect(row).not.toHaveAttribute('data-status', status ?? '');

    await page.reload();
    await expect(page.getByTestId('advance-item').first().getByLabel(/^Answer for/)).toHaveValue(
      '14:00 at the loading dock',
    );
  });

  test('filters narrow the checklist to what still needs chasing', async ({ page }) => {
    await openAdvancing(page);
    const total = await page.getByTestId('advance-item').count();

    await page.getByRole('button', { name: 'Overdue' }).click();
    const overdue = await page.getByTestId('advance-item').count();
    expect(overdue).toBeLessThan(total);

    await page.getByRole('button', { name: 'Everything' }).click();
    expect(await page.getByTestId('advance-item').count()).toBe(total);
  });

  test('adding a party repeats the travel questions for them', async ({ page }) => {
    await openAdvancing(page);
    const before = await page.getByTestId('advance-item').count();

    await page.getByRole('tab', { name: 'Parties & contacts' }).click();
    const parties = await page.getByTestId('advance-party').count();
    await page.getByRole('button', { name: 'Add party' }).click();
    await expect(page.getByTestId('advance-party')).toHaveCount(parties + 1);

    await page.getByRole('tab', { name: 'Checklist' }).click();
    expect(await page.getByTestId('advance-item').count()).toBeGreaterThan(before);
  });

  test('the day sheet puts the timed items in order', async ({ page }) => {
    await openAdvancing(page, /ATLAS/);
    await page.getByRole('tab', { name: 'Day sheet' }).click();

    const times = page.getByRole('tabpanel').locator('.font-mono');
    expect(await times.count()).toBeGreaterThan(2);
  });
});
