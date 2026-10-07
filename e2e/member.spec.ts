import { expect, test } from '@playwright/test'
import { login } from './helpers'

test.describe('App del socio', () => {
  test('un socio sense sessió és redirigit al login', async ({ page }) => {
    await page.goto('/app')
    await expect(page).toHaveURL(/\/login/)
  })

  test('un socio no pot entrar al panell /admin', async ({ page }) => {
    await login(page, 'soci10@cpsfit.demo', /\/app$/)
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/app$/)
  })

  test('veu la sessió d\'avui i entrena amb temporitzador de descans', async ({ page }) => {
    await login(page, 'soci10@cpsfit.demo', /\/app$/)
    await expect(page.getByRole('heading', { name: /Biel/i })).toBeVisible()
    await page.getByRole('link', { name: 'Començar entrenament' }).click()
    await expect(page).toHaveURL(/\/app\/entreno#/)
    await page.getByRole('button', { name: 'Marcar sèrie com a feta' }).first().click()
    await expect(page.getByRole('timer')).toBeVisible() // descans automàtic
    await page.getByRole('button', { name: 'Acabar' }).first().click()
    await page.getByRole('button', { name: 'Acabar igualment' }).click()
    await expect(page.getByRole('heading', { name: 'Entrenament completat!' })).toBeVisible()
    await expect(page.getByText('Entrenament desat correctament.')).toBeVisible()
  })

  test('registra un entrenament sense connexió i el sincronitza en recuperar-la', async ({ page, context }) => {
    await login(page, 'soci9@cpsfit.demo', /\/app$/)
    await page.getByRole('link', { name: 'Començar entrenament' }).click() // carrega i desa rutina + pàgina
    await expect(page.getByRole('button', { name: 'Marcar sèrie com a feta' }).first()).toBeVisible()
    await page.goto('/app')
    // espera que el service worker controli la pàgina
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 15_000 })
    const href = await page.getByRole('link', { name: 'Començar entrenament' }).getAttribute('href')

    await context.setOffline(true)
    await page.goto(href!)
    await expect(page.getByRole('button', { name: 'Marcar sèrie com a feta' }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Marcar sèrie com a feta' }).first().click()
    await page.getByRole('button', { name: 'Acabar' }).first().click()
    await page.getByRole('button', { name: 'Acabar igualment' }).click()
    await expect(page.getByText(/Sense connexió: l'entrenament s'ha guardat al mòbil/)).toBeVisible()

    await context.setOffline(false)
    await page.goto('/app')
    await expect.poll(async () => page.evaluate(() => new Promise<number>((res) => {
      const open = indexedDB.open('cpsfit')
      open.onsuccess = () => {
        const db = open.result
        const count = db.transaction('outbox').objectStore('outbox').count()
        count.onsuccess = () => res(count.result)
      }
    })), { timeout: 20_000 }).toBe(0)
  })
})
