import { expect, test, type Page } from '@playwright/test';

async function openStudio(page: Page) {
  await page.goto('/demo');
  await expect(page).toHaveURL(/\/w\/[A-Z0-9]+$/, { timeout: 30_000 });
  await page.getByRole('link', { name: 'Studio' }).click();
  await expect(page.getByRole('heading', { name: 'Studio' })).toBeVisible();
}

async function openGuests(page: Page) {
  await page.getByRole('link', { name: 'Events' }).click();
  await page.getByRole('link', { name: /AURELIA/ }).click();
  await page.getByRole('link', { name: 'Guests', exact: true }).first().click();
  await expect(page.getByTestId('guest-table-scroll')).toBeVisible();
}

test.describe('studio: customization', () => {
  test('renaming a voice renames it everywhere', async ({ page }) => {
    await openStudio(page);
    const field = page.getByLabel('Label for celebrity');
    await field.fill('Talent');
    await field.blur();

    await openGuests(page);
    await page.getByTestId('filter-voiceId').click();
    await expect(page.getByRole('menuitemcheckbox', { name: /Talent/ })).toBeVisible();
    await expect(page.getByRole('menuitemcheckbox', { name: /Celebrity/ })).toHaveCount(0);
  });

  test('a new custom field reaches the table and the detail sheet', async ({ page }) => {
    await openStudio(page);
    await page.getByRole('tab', { name: 'Fields' }).click();
    await page.getByLabel('New field name').first().fill('Dietary requirements');
    await page.getByRole('button', { name: 'Add field' }).first().click();
    await expect(page.locator('input[value="Dietary requirements"]')).toBeVisible();

    await openGuests(page);
    await page.getByRole('button', { name: 'Columns' }).click();
    await expect(page.getByRole('menuitemcheckbox', { name: 'Dietary requirements' })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('guest-row').first().click();
    await expect(page.getByRole('dialog').getByText('Dietary requirements')).toBeVisible();
  });

  test('a new vocabulary entry is immediately usable', async ({ page }) => {
    await openStudio(page);
    await page.getByLabel('New Tiers').fill('Photographers');
    await page.getByLabel('New Tiers').press('Enter');
    await expect(page.getByLabel('Label for photographers')).toBeVisible();

    await openGuests(page);
    await page.getByTestId('filter-tierId').click();
    await expect(page.getByRole('menuitemcheckbox', { name: /Photographers/ })).toBeVisible();
  });

  test('an in-use entry archives instead of vanishing', async ({ page }) => {
    await openStudio(page);
    const row = page.getByTestId('vocab-row').filter({ has: page.getByLabel('Label for celebrity') });
    await expect(row).toContainText('in use');
    await row.getByRole('button', { name: /^Archive/ }).click();
    await expect(page.getByLabel('Label for celebrity')).toBeVisible();
  });

  test('editing a metric weight moves the scores it feeds', async ({ page }) => {
    await openStudio(page);
    await page.getByRole('tab', { name: 'Metrics' }).click();
    const preview = page.getByTestId('metric-preview');
    await expect(preview).toBeVisible();
    const before = await preview.locator('.font-mono').innerText();

    // The preview names the guest's voice and tier, so the test edits a weight
    // that actually applies to them.
    // textContent, not innerText: the label is CSS-uppercased in the preview.
    const voice = (await preview.getByTestId('preview-voice').textContent())!.trim();
    const weight = page.getByLabel(voice, { exact: true }).first();
    await weight.fill('0.5');
    await weight.blur();
    await expect(preview.locator('.font-mono')).not.toHaveText(before);
  });

  test('an invalid formula is named on screen', async ({ page }) => {
    await openStudio(page);
    await page.getByRole('tab', { name: 'Metrics' }).click();
    await page.getByLabel('Formula').fill('reach * mystery');
    await expect(page.getByTestId('formula-error')).toContainText('mystery');
  });

  test('switching off a module removes its nav and stops its route resolving', async ({ page }) => {
    await openStudio(page);
    await page.getByRole('tab', { name: 'Modules' }).click();
    await page.getByLabel('Seating module').click();

    await page.getByRole('link', { name: 'Events' }).click();
    await page.getByRole('link', { name: /AURELIA/ }).click();
    // Gone from the sidebar and from the overview's quick links.
    await expect(page.getByRole('link', { name: 'Seating', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Guests', exact: true })).toHaveCount(1);

    const url = page.url().replace('/overview', '/seating');
    await page.goto(url);
    await expect(page).toHaveURL(/\/overview$/);
  });

  test('the product name is a token', async ({ page }) => {
    await openStudio(page);
    await page.getByRole('tab', { name: 'Brand' }).click();
    await page.getByLabel('Workspace name').fill('Northern Lights Productions');
    await page.getByRole('link', { name: 'Events' }).click();
    await expect(page.getByRole('heading', { name: 'Northern Lights Productions' })).toBeVisible();
  });

  test('a workspace exports to JSON', async ({ page }) => {
    await openStudio(page);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export setup' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toContain('.json');
  });
});
