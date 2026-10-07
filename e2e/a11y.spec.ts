import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { login } from './helpers'

// Comprueba WCAG 2.x A/AA (contraste, nombres accesibles, etiquetas…) en las pantallas clave, en claro y oscuro.
async function audit(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.map((v) => `${name}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`), name).toEqual([])
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`Accesibilitat · ${scheme}`, () => {
    test.use({ colorScheme: scheme, reducedMotion: 'reduce' }) // sin animaciones: se audita el estado final

    test('login i alta', async ({ page }) => {
      await page.goto('/login')
      await audit(page, `login ${scheme}`)
      await page.goto('/register')
      await audit(page, `register ${scheme}`)
    })

    test('app del soci', async ({ page }) => {
      await login(page, 'soci11@cpsfit.demo', /\/app$/)
      for (const path of ['/app', '/app/rutina', '/app/progres', '/app/club', '/app/perfil']) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        await audit(page, `${path} ${scheme}`)
      }
    })

    test('panell del monitor', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await login(page, 'monitor1@cpsfit.demo', /\/admin$/)
      for (const path of ['/admin', '/admin/socis', '/admin/rutines', '/admin/exercicis', '/admin/avisos']) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        await audit(page, `${path} ${scheme}`)
      }
    })
  })
}
