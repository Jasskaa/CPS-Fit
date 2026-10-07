import { expect, test } from '@playwright/test'
import { login } from './helpers'

test.describe('Panell del monitor', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('el monitor només veu els seus socis i el tauler', async ({ page }) => {
    await login(page, 'monitor1@cpsfit.demo', /\/admin$/)
    await expect(page.getByRole('heading', { name: 'Tauler' })).toBeVisible()
    await page.goto('/admin/socis')
    await expect(page.getByText('6 socis')).toBeVisible()
    await expect(page.getByText('Berta Pons')).toHaveCount(0) // és del monitor 2
  })

  test('crea una plantilla, afegeix un exercici i la desa', async ({ page }) => {
    await login(page, 'monitor1@cpsfit.demo', /\/admin$/)
    await page.goto('/admin/rutines')
    await page.getByLabel('Nom de la rutina').fill('Prova E2E')
    await page.getByRole('button', { name: 'Nova plantilla' }).click()
    await expect(page).toHaveURL(/\/admin\/rutines\/[0-9a-f-]{36}/)
    await page.getByRole('button', { name: /^Afegir Abdominal crunch/ }).click()
    await page.getByRole('button', { name: 'Desar rutina' }).click()
    await expect(page.getByText('Rutina desada ✓')).toBeVisible()
    await page.reload()
    await expect(page.getByText('Abdominal crunch').first()).toBeVisible()
  })

  test('un monitor no pot accedir a la gestió de monitors (només admin)', async ({ page }) => {
    await login(page, 'monitor1@cpsfit.demo', /\/admin$/)
    await page.goto('/admin/monitors')
    await expect(page).toHaveURL(/\/admin$/)
  })
})
