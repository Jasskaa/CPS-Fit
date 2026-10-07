import { defineConfig, devices } from '@playwright/test'

// Los tests E2E se ejecutan contra la build de producción (el service worker solo se registra en producción).
//   npm run build && npx playwright test
// Por defecto usa Microsoft Edge/Chrome ya instalados (E2E_CHANNEL=msedge|chrome); con E2E_CHANNEL=chromium usa el de Playwright.
const channel = process.env.E2E_CHANNEL ?? 'msedge'
const port = Number(process.env.E2E_PORT ?? 3011)

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: `npm run start -- --port=${port}`,
    url: `http://localhost:${port}/login`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: 'mobil', use: { ...devices['Pixel 7'], channel: channel === 'chromium' ? undefined : channel } },
  ],
})
