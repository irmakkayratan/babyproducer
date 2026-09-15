import { expect, test, type Page } from '@playwright/test';

async function openDemoRundown(page: Page) {
  await page.goto('/demo');
  await expect(page).toHaveURL(/\/w\/[A-Z0-9]+$/, { timeout: 30_000 });
  await page.getByRole('link', { name: /AURELIA/ }).click();
  await page.getByRole('link', { name: 'Run of Show', exact: true }).first().click();
  await expect(page.getByTestId('rundown-scroll')).toBeVisible();
}

test.describe('run of show', () => {
  test('the demo event has a real cue stack with derived start times', async ({ page }) => {
    await openDemoRundown(page);
    const rows = page.getByTestId('cue-row');
    expect(await rows.count()).toBeGreaterThan(10);
    await expect(page.getByText(/^\d+ cues$/)).toBeVisible();
    // Start times are derived, so the second cue starts after the first.
    const firstStart = await rows.nth(0).locator('.font-mono').first().innerText();
    const secondStart = await rows.nth(1).locator('.font-mono').first().innerText();
    expect(firstStart).not.toEqual(secondStart);
  });

  test('changing one duration re-times every cue below it', async ({ page }) => {
    await openDemoRundown(page);
    const rows = page.getByTestId('cue-row');
    const before = await rows.nth(3).locator('.font-mono').first().innerText();

    const duration = rows.nth(1).getByLabel(/^Duration for/);
    await duration.fill('45:00');
    await duration.press('Enter');

    await expect(rows.nth(3).locator('.font-mono').first()).not.toHaveText(before);
  });

  test('an unparseable duration is rejected instead of zeroing the cue', async ({ page }) => {
    await openDemoRundown(page);
    const duration = page.getByTestId('cue-row').nth(1).getByLabel(/^Duration for/);
    const original = await duration.inputValue();
    await duration.fill('not a time');
    await duration.press('Enter');
    await expect(duration).toHaveValue(original);
  });

  test('the caller advances with the space bar and the stage timer follows', async ({ context, page }) => {
    await openDemoRundown(page);
    await page.getByRole('button', { name: 'Show caller' }).click();
    await expect(page.getByTestId('caller-mode')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Standing by');

    const firstCue = await page.getByRole('heading', { level: 1 }).innerText();

    const eventId = page.url().match(/events\/([A-Z0-9]+)/)![1];
    const stage = await context.newPage();
    await stage.goto(`/show/${eventId}/timer`);
    await expect(stage.getByTestId('stage-timer')).toBeVisible();
    await expect(stage.getByText(firstCue, { exact: false })).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press(' ');
    const secondCue = await page.getByRole('heading', { level: 1 }).innerText();
    expect(secondCue).not.toEqual(firstCue);

    // The stage screen follows the producer without a reload.
    await expect(stage.getByText(secondCue, { exact: false })).toBeVisible({ timeout: 5_000 });
    await stage.close();
  });

  test('a producer message reaches the stage display', async ({ context, page }) => {
    await openDemoRundown(page);
    await page.getByRole('button', { name: 'Show caller' }).click();
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Standing by');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('caller-bar')).toBeVisible();

    const eventId = page.url().match(/events\/([A-Z0-9]+)/)![1];
    const stage = await context.newPage();
    await stage.goto(`/show/${eventId}/timer`);
    await expect(stage.getByTestId('stage-timer')).toBeVisible();

    await page.getByLabel('Message to stage').fill('Wrap in 2 minutes');
    await page.getByLabel('Message to stage').press('Enter');

    await expect(stage.getByTestId('stage-message')).toHaveText('Wrap in 2 minutes', { timeout: 5_000 });
    await stage.close();
  });

  test('cue edits survive a reload', async ({ page }) => {
    await openDemoRundown(page);
    const label = page.getByTestId('cue-row').first().getByLabel(/^Label for cue/);
    await label.fill('Doors — revised');
    await label.press('Enter');
    await page.waitForTimeout(600);

    await page.reload();
    await expect(page.getByTestId('cue-row').first().getByLabel(/^Label for cue/)).toHaveValue('Doors — revised');
  });
});
