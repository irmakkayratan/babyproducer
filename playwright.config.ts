import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the built app served statically — the same artifact that
 * GitHub Pages will serve, so base-path and SPA-fallback bugs surface here
 * rather than in production.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // This environment ships a pinned Chromium; point at it rather than
        // downloading a second copy per Playwright release.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    // Bind the preview server explicitly to IPv4. Vite's default host is
    // `localhost`, which on a dual-stack CI runner resolves to ::1 first — so
    // the server listens on IPv6 loopback while Playwright polls 127.0.0.1 and
    // waits out its whole timeout against a port nothing is on.
    command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Let the server say where it is listening: without this, a start-up
    // failure reads as nothing but a timeout three minutes later.
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
