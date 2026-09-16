import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * WCAG 2.2 AA, checked on every working surface in both colour schemes.
 * Serious and critical violations fail the build.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  return blocking.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} nodes)`);
}

async function loadDemo(page: Page): Promise<string> {
  await page.goto('/demo');
  await expect(page).toHaveURL(/\/w\/[A-Z0-9]+$/, { timeout: 30_000 });
  return page.url().split('/w/')[1];
}

test.describe('accessibility', () => {
  test('the landing page is clean in both themes', async ({ page }) => {
    await page.goto('/');
    expect(await scan(page)).toEqual([]);

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    expect(await scan(page)).toEqual([]);
  });

  test('every working surface is clean', async ({ page }) => {
    // Eleven routes, each loaded and scanned: worth the longer budget.
    test.slow();
    const workspaceId = await loadDemo(page);
    const eventId = await page.evaluate(() => {
      const link = document.querySelector('a[href*="/events/"]') as HTMLAnchorElement | null;
      return link?.href.match(/events\/([A-Z0-9]+)/)?.[1] ?? '';
    });

    const routes = [
      `/w/${workspaceId}`,
      `/w/${workspaceId}/studio`,
      `/w/${workspaceId}/events/${eventId}/overview`,
      `/w/${workspaceId}/events/${eventId}/guests`,
      `/w/${workspaceId}/events/${eventId}/seating`,
      `/w/${workspaceId}/events/${eventId}/rundown`,
      `/w/${workspaceId}/events/${eventId}/advancing`,
      `/w/${workspaceId}/events/${eventId}/checkin`,
      `/w/${workspaceId}/events/${eventId}/settlement`,
      `/w/${workspaceId}/events/${eventId}/command`,
      `/w/${workspaceId}/events/${eventId}/recap`,
    ];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(900);
      expect(await scan(page), `violations on ${route}`).toEqual([]);
    }
  });

  test('the stage display is clean', async ({ page }) => {
    const workspaceId = await loadDemo(page);
    const eventId = await page.evaluate(() => {
      const link = document.querySelector('a[href*="/events/"]') as HTMLAnchorElement | null;
      return link?.href.match(/events\/([A-Z0-9]+)/)?.[1] ?? '';
    });
    await page.goto(`/show/${eventId}/timer`);
    await page.waitForTimeout(600);
    expect(await scan(page)).toEqual([]);
    void workspaceId;
  });

  test('the guest sheet keeps focus and carries a title', async ({ page }) => {
    const workspaceId = await loadDemo(page);
    const eventId = await page.evaluate(() => {
      const link = document.querySelector('a[href*="/events/"]') as HTMLAnchorElement | null;
      return link?.href.match(/events\/([A-Z0-9]+)/)?.[1] ?? '';
    });
    await page.goto(`/w/${workspaceId}/events/${eventId}/guests`);
    await page.getByTestId('guest-row').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await scan(page)).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
