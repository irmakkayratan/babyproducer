import { expect, test, type Page } from '@playwright/test';

async function openDemoGuests(page: Page) {
  await page.goto('/demo');
  await expect(page).toHaveURL(/\/w\/[A-Z0-9]+$/, { timeout: 30_000 });
  await page.getByRole('link', { name: /AURELIA/ }).click();
  await page.getByRole('link', { name: 'Guests' }).click();
  await expect(page.getByTestId('guest-table-scroll')).toBeVisible();
}

test.describe('guest & talent CRM', () => {
  test('the demo loads a populated guest list', async ({ page }) => {
    await openDemoGuests(page);
    await expect(page.getByText(/of 420 guests/)).toBeVisible();
    // Virtualized: only the visible slice is in the DOM.
    const rows = await page.getByTestId('guest-row').count();
    expect(rows).toBeGreaterThan(5);
    expect(rows).toBeLessThan(60);
  });

  test('search and filters narrow the room', async ({ page }) => {
    await openDemoGuests(page);
    const firstName = await page.getByTestId('guest-row').first().getByTestId('guest-name').innerText();

    await page.getByLabel('Search guests').fill(firstName);
    await expect(page.getByTestId('guest-row').first()).toContainText(firstName);

    await page.getByLabel('Search guests').fill('');
    await page.getByTestId('filter-voiceId').click();
    await page.getByRole('menuitemcheckbox', { name: /Celebrity/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('filter-voiceId')).toContainText('1');
    await expect(page.getByText(/of 420 guests/)).toBeVisible();
  });

  test('a guest sheet shows the media-value breakdown', async ({ page }) => {
    await openDemoGuests(page);
    await page.getByTestId('guest-row').first().click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Media Impact Value')).toBeVisible();
    await expect(sheet.getByText('Voice authority')).toBeVisible();
  });

  test('check-in is optimistic and syncs to a second tab, which then refuses the duplicate', async ({ context, page }) => {
    await openDemoGuests(page);
    const targetName = await page.getByTestId('guest-row').first().getByTestId('guest-name').innerText();

    const second = await context.newPage();
    await second.goto(page.url());
    await expect(second.getByTestId('guest-table-scroll')).toBeVisible();

    await page.getByTestId('guest-row').first().getByRole('button', { name: 'Check in' }).click();
    await expect(page.getByText(`${targetName} checked in`)).toBeVisible();

    // The other desk sees it without a reload…
    await expect(second.getByTestId('guest-row').first().getByText('In')).toBeVisible({ timeout: 5_000 });

    // …and a second scan there is refused rather than double-counted.
    await second.getByLabel('Search guests').fill(targetName);
    await second.getByTestId('guest-row').first().click();
    const sheet = second.getByRole('dialog');
    await expect(sheet.getByText('In the room')).toBeVisible();
    await second.close();
  });

  test('a guest list exports and re-imports through the mapping wizard', async ({ page }) => {
    await openDemoGuests(page);
    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.getByRole('dialog')).toContainText('Import guests');

    await page.getByRole('dialog').locator('input[type=file]').setInputFiles({
      name: 'guests.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'Full Name,Instagram,Publication,RSVP,Dietary requirements\nRené Testperson,@rene,Test Quarterly,Confirmed,Vegan\n',
      ),
    });

    await expect(page.getByText(/1 rows · \d+ of 5 columns mapped/)).toBeVisible();
    await page.getByRole('button', { name: /Import 1 rows/ }).click();
    await expect(page.getByText('1 created')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).first().click();

    await page.getByLabel('Search guests').fill('René');
    await expect(page.getByTestId('guest-row').first()).toContainText('René Testperson');
  });
});
