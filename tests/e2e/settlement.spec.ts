import { expect, test, type Page } from '@playwright/test';

async function openSettlement(page: Page, eventName = /ATLAS/) {
  await page.goto('/demo');
  await expect(page).toHaveURL(/\/w\/[A-Z0-9]+$/, { timeout: 30_000 });
  await page.getByRole('link', { name: eventName }).click();
  await page.getByRole('link', { name: 'Settlement', exact: true }).first().click();
  await expect(page.getByTestId('settlement-scaling')).toBeVisible();
}

test.describe('settlement', () => {
  test('a settled show arrives with its box office, costs and deal', async ({ page }) => {
    await openSettlement(page);

    expect(await page.getByTestId('settlement-tier').count()).toBeGreaterThan(2);
    expect(await page.getByTestId('settlement-expenses').getByTestId('settlement-line').count()).toBeGreaterThan(3);
    await expect(page.getByTestId('settlement-party').first()).toContainText('versus');
  });

  test('changing what sold moves every figure that depends on it', async ({ page }) => {
    await openSettlement(page);
    const balance = page.getByTestId('settlement-balance').first();
    const before = await balance.innerText();

    const sold = page.getByTestId('settlement-tier').first().getByLabel(/^Sold for/);
    await sold.fill('0');
    await sold.press('Enter');

    await expect(balance).not.toHaveText(before);
  });

  test('the deal decides the fee, and says which side of it won', async ({ page }) => {
    await openSettlement(page);
    const party = page.getByTestId('settlement-party').first();

    // A guarantee big enough to beat the percentage flips the sentence.
    const guarantee = party.getByLabel(/^Guarantee for/);
    await guarantee.fill('900000');
    await guarantee.press('Enter');
    await expect(party).toContainText('The guarantee applies');

    await guarantee.fill('1');
    await guarantee.press('Enter');
    await expect(party).toContainText('The percentage applies');
  });

  test('the statement reads as a document, with the totals in order', async ({ page }) => {
    await openSettlement(page);
    await page.getByRole('tab', { name: 'Statement' }).click();

    const statement = page.getByTestId('settlement-statement');
    await expect(statement).toContainText('Box office');
    await expect(statement).toContainText('Gross receipts');
    await expect(statement).toContainText('Net after costs');
    await expect(statement).toContainText('House result');
    await expect(statement.getByTestId('settlement-gross')).toBeVisible();
  });

  test('finalizing locks the sheet until it is reopened', async ({ page }) => {
    await openSettlement(page);
    await page.getByRole('button', { name: 'Finalize' }).click();
    await expect(page.getByText('This settlement is finalized')).toBeVisible();
    await expect(page.getByTestId('settlement-tier').first().getByLabel(/^Sold for/)).toBeDisabled();

    await page.getByRole('button', { name: 'Reopen' }).click();
    await expect(page.getByTestId('settlement-tier').first().getByLabel(/^Sold for/)).toBeEnabled();
  });

  test('an edit survives a reload: the sheet lives on the device', async ({ page }) => {
    await openSettlement(page);
    const expenses = page.getByTestId('settlement-expenses');
    const total = expenses.locator('[data-numeric]').first();
    const before = await total.innerText();

    const rate = expenses.getByTestId('settlement-line').first().getByLabel(/^Rate for/);
    await rate.fill('12345');
    await rate.press('Enter');

    // The costs total re-renders from the stored sheet, so a changed total is
    // proof the write landed, which an accepted keystroke alone does not give.
    await expect(total).not.toHaveText(before);

    await page.reload();
    await expect(
      page.getByTestId('settlement-expenses').getByTestId('settlement-line').first().getByLabel(/^Rate for/),
    ).toHaveValue('12345');
  });

  test('a project with no box office settles against its fee instead', async ({ page }) => {
    await openSettlement(page, /LUMEN/);
    await expect(page.getByTestId('settlement-scaling')).toContainText('No price bands yet');

    await page.getByRole('tab', { name: 'Statement' }).click();
    await expect(page.getByTestId('settlement-statement')).toContainText('Income');
    await expect(page.getByTestId('settlement-statement')).toContainText('Client production fee');
  });
});
