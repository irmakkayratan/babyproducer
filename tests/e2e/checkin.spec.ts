import { expect, test, type Page } from '@playwright/test';

async function openDemoCheckin(page: Page) {
  await page.goto('/demo');
  await expect(page).toHaveURL(/\/w\/[A-Z0-9]+$/, { timeout: 30_000 });
  await page.getByRole('link', { name: /AURELIA/ }).click();
  await page.getByRole('link', { name: 'Check-in', exact: true }).first().click();
  await expect(page.getByTestId('checkin')).toBeVisible();
}

async function firstGuestName(page: Page): Promise<string> {
  await page.getByTestId('checkin-search').fill('a');
  await page.getByTestId('checkin-search').fill('ar');
  await expect(page.getByTestId('checkin-match').first()).toBeVisible();
  return page.getByTestId('checkin-match').first().locator('p').first().innerText();
}

test.describe('onsite check-in', () => {
  test('searching the list and admitting a guest', async ({ page }) => {
    await openDemoCheckin(page);
    const name = await firstGuestName(page);

    await page.getByTestId('checkin-match').first().getByRole('button', { name: 'Check in' }).click();
    await expect(page.getByTestId('checkin-feedback')).toContainText(`${name} is in`);

    await page.getByTestId('checkin-search').fill(name);
    await expect(page.getByTestId('checkin-match').first().getByText('In')).toBeVisible();
  });

  test('a second attempt is refused with the time of the first', async ({ page }) => {
    await openDemoCheckin(page);
    const name = await firstGuestName(page);
    await page.getByTestId('checkin-match').first().getByRole('button', { name: 'Check in' }).click();
    await expect(page.getByTestId('checkin-feedback')).toContainText('is in');

    await page.getByTestId('checkin-search').fill(name);
    await page.getByTestId('checkin-search').press('Enter');
    await expect(page.getByTestId('checkin-feedback')).toContainText('was already checked in at');
  });

  test('check-in works with the network down and survives a reload', async ({ page, context }) => {
    await openDemoCheckin(page);
    const name = await firstGuestName(page);

    await context.setOffline(true);
    await page.getByTestId('checkin-match').first().getByRole('button', { name: 'Check in' }).click();
    await expect(page.getByTestId('checkin-feedback')).toContainText('is in');
    await expect(page.getByTestId('status-chip')).toContainText('Offline');

    await context.setOffline(false);
    await page.reload();
    await expect(page.getByTestId('checkin')).toBeVisible();
    await page.getByTestId('checkin-search').fill(name);
    await expect(page.getByTestId('checkin-match').first().getByText('In')).toBeVisible();
  });

  test('a typo still finds the guest', async ({ page }) => {
    await openDemoCheckin(page);
    const name = await firstGuestName(page);
    const surname = name.split(' ').pop()!;
    const typo = `${surname.slice(0, -2)}${surname.slice(-1)}x`;

    await page.getByTestId('checkin-search').fill(typo);
    await expect(page.getByTestId('checkin-matches')).toBeVisible();
  });

  test('an unknown name offers a walk-in, which is created and admitted', async ({ page }) => {
    await openDemoCheckin(page);
    await page.getByTestId('checkin-search').fill('Zzyzx Unlisted');
    await page.getByRole('button', { name: 'Add as a walk-in' }).click();
    await page.getByRole('button', { name: 'Add and check in' }).click();
    await expect(page.getByTestId('checkin-feedback')).toContainText('Zzyzx Unlisted is in');
  });

  test('a badge renders with a locally generated code', async ({ page }) => {
    await openDemoCheckin(page);
    await firstGuestName(page);
    await page.getByTestId('checkin-match').first().getByRole('button', { name: /^Badge for/ }).click();
    const badge = page.getByTestId('badge');
    await expect(badge).toBeVisible();
    await expect(badge.locator('img')).toBeVisible();
  });

  test('a check-in at one desk appears at the other and is refused there', async ({ context, page }) => {
    await openDemoCheckin(page);
    const name = await firstGuestName(page);

    const desk2 = await context.newPage();
    await desk2.goto(page.url());
    await expect(desk2.getByTestId('checkin')).toBeVisible();
    await desk2.getByTestId('checkin-search').fill(name);
    await expect(desk2.getByTestId('checkin-match').first()).toBeVisible();

    await page.getByTestId('checkin-match').first().getByRole('button', { name: 'Check in' }).click();
    await expect(page.getByTestId('checkin-feedback')).toContainText('is in');

    await expect(desk2.getByTestId('checkin-match').first().getByText('In')).toBeVisible({ timeout: 5_000 });
    await desk2.close();
  });
});
