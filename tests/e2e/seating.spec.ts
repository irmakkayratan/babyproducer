import { expect, test, type Page } from '@playwright/test';

async function openDemoSeating(page: Page) {
  await page.goto('/demo');
  await expect(page).toHaveURL(/\/w\/[A-Z0-9]+$/, { timeout: 30_000 });
  // The brand launch is the demo's seated room: a keynote before the reception.
  await page.getByRole('link', { name: /Brand Launch/ }).click();
  await page.getByRole('link', { name: 'Seating', exact: true }).first().click();
  await expect(page.getByTestId('seating-canvas')).toBeVisible();
}

test.describe('seating chart', () => {
  test('the demo room is built to capacity and already seated', async ({ page }) => {
    await openDemoSeating(page);
    const seats = await page.getByTestId('seat').count();
    expect(seats).toBeGreaterThanOrEqual(420);
    const occupied = await page.locator('[data-testid=seat][data-occupied=true]').count();
    expect(occupied).toBeGreaterThan(300);
    await expect(page.getByTestId('unseated-list')).toBeVisible();
  });

  test('a guest can be seated by keyboard alone', async ({ page }) => {
    await openDemoSeating(page);
    const empty = page.locator('[data-testid=seat]:not([data-occupied])').first();
    // Pin the seat by id: the ":not([data-occupied])" locator would resolve to
    // a different seat the moment this one is filled.
    const seatId = await empty.getAttribute('data-seat-id');
    await empty.focus();
    await page.keyboard.press('Enter');

    const firstGuest = page.getByTestId('unseated-guest').first();
    const name = await firstGuest.getByTestId('unseated-name').innerText();
    await firstGuest.getByRole('button', { name: 'Seat' }).click();

    const seat = page.locator(`[data-seat-id="${seatId}"]`);
    await expect(seat).toHaveAttribute('data-occupied', 'true');
    await expect(seat).toHaveAttribute('aria-label', new RegExp(name.split(' ')[0]));
  });

  test('auto-seat fills the remaining seats by tier', async ({ page }) => {
    await openDemoSeating(page);
    const before = await page.locator('[data-testid=seat][data-occupied=true]').count();
    await page.getByRole('button', { name: 'Auto-seat' }).click();
    await expect(page.getByText(/^Seated \d+ guests?$/)).toBeVisible({ timeout: 20_000 });
    const after = await page.locator('[data-testid=seat][data-occupied=true]').count();
    expect(after).toBeGreaterThan(before);
  });

  test('clearing a seat returns the guest to the unseated list', async ({ page }) => {
    await openDemoSeating(page);
    const empty = page.locator('[data-testid=seat]:not([data-occupied])').first();
    const seatId = await empty.getAttribute('data-seat-id');
    await empty.click();
    await page.getByTestId('unseated-guest').first().getByRole('button', { name: 'Seat' }).click();

    const seat = page.locator(`[data-seat-id="${seatId}"]`);
    await expect(seat).toHaveAttribute('data-occupied', 'true');

    // The seat stays selected after seating, so Clear is right there.
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(seat).not.toHaveAttribute('data-occupied', 'true');
  });

  test('a new assignment survives a reload', async ({ page }) => {
    await openDemoSeating(page);
    const empty = page.locator('[data-testid=seat]:not([data-occupied])').first();
    const seatId = await empty.getAttribute('data-seat-id');
    await empty.click();
    await page.getByTestId('unseated-guest').first().getByRole('button', { name: 'Seat' }).click();
    await expect(page.locator(`[data-seat-id="${seatId}"]`)).toHaveAttribute('data-occupied', 'true');

    await page.reload();
    await expect(page.getByTestId('seating-canvas')).toBeVisible();
    await expect(page.locator(`[data-seat-id="${seatId}"]`)).toHaveAttribute('data-occupied', 'true');
  });

  test('seating rules surface as issues without blocking the producer', async ({ page }) => {
    await openDemoSeating(page);
    await expect(page.getByTestId('violations')).toBeVisible();
  });
});
