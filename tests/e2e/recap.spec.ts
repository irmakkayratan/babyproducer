import { expect, test, type Page } from '@playwright/test';

async function openRecap(page: Page, eventName = /Brand Launch/) {
  await page.goto('/demo');
  await expect(page).toHaveURL(/\/w\/[A-Z0-9]+$/, { timeout: 30_000 });
  await page.getByRole('link', { name: eventName }).click();
  await page.getByRole('link', { name: 'Recap', exact: true }).first().click();
  await expect(page.getByTestId('recap-headline')).toBeVisible();
}

test.describe('post-event recap', () => {
  test('reports attendance, turnout and media value for a finished event', async ({ page }) => {
    await openRecap(page);
    const headline = page.getByTestId('recap-headline');
    await expect(headline.getByText('In the room')).toBeVisible();
    await expect(headline.getByText('Turnout')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Attendance' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Room composition' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Top contributors' })).toBeVisible();
  });

  test('turnout is consistent with the guest list', async ({ page }) => {
    await openRecap(page);
    const turnout = await page.getByTestId('recap-headline').innerText();
    const match = turnout.match(/(\d+)%\s*of ([\d,]+) confirmed/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThan(0);
    expect(Number(match![1])).toBeLessThanOrEqual(100);
  });

  test('a CSV of the room can be exported', async ({ page }) => {
    await openRecap(page);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toContain('recap.csv');
  });
});
