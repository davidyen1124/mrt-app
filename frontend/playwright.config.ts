import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8787'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL,
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    // Uses the locally installed Chrome; set PLAYWRIGHT_CHANNEL= to use Playwright's bundled Chromium instead.
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'mobile', use: { ...devices['iPhone 15 Pro'], defaultBrowserType: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } }
  ],
  // The Worker serves the built SPA and the API together; build the frontend first.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm --prefix ../worker run dev -- --port 8787',
        url: 'http://localhost:8787/api/health',
        reuseExistingServer: true,
        timeout: 60_000
      }
})
