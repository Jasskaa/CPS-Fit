import { expect, test, type Page } from '@playwright/test'
import { login } from './helpers'

test.use({ viewport: { width: 1280, height: 800 } })

/** Recoge errores de consola y de página para que cualquier fallo de hidratación o de render rompa el test. */
function watch(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()) })
  return errors
}

const ADMIN_PAGES: [string, RegExp][] = [
  ['/admin', /Tauler/],
  ['/admin/persones', /Persones/],
  ['/admin/acces', /Accessos/],
  ['/admin/acces?tab=reception', /Accessos/],
  ['/admin/acces?tab=log', /Accessos/],
  ['/admin/acces?tab=rules', /Accessos/],
  ['/admin/reserves', /Reserves/],
  ['/admin/reserves?tab=list', /Reserves/],
  ['/admin/reserves?tab=tariffs', /Reserves/],
  ['/admin/facturacio', /Facturació/],
  ['/admin/facturacio?tab=fees', /Facturació/],
  ['/admin/facturacio?tab=sepa', /Facturació/],
  ['/admin/facturacio?tab=tpv', /Facturació/],
  ['/admin/facturacio?tab=cash', /Facturació/],
  ['/admin/seccions', /Seccions i equips/],
  ['/admin/seccions?tab=events', /Seccions i equips/],
  ['/admin/seccions?tab=calendar', /Seccions i equips/],
  ['/admin/comunicacio', /Comunicació/],
  ['/admin/comunicacio?tab=announcements', /Comunicació/],
  ['/admin/comunicacio?tab=messages', /Comunicació/],
  ['/admin/comunicacio?tab=polls', /Comunicació/],
  ['/admin/comunicacio?tab=incidents', /Comunicació/],
  ['/admin/comunicacio?tab=content', /Comunicació/],
  ['/admin/informes', /Informes/],
  ['/admin/auditoria', /Auditoria/],
  ['/admin/configuracio', /Configuració/],
]

test.describe('Panell d’administració', () => {
  test('l’admin recorre tots els mòduls sense errors', async ({ page }) => {
    const errors = watch(page)
    await login(page, 'admin@cpsfit.demo', /\/admin$/)
    for (const [url, heading] of ADMIN_PAGES) {
      await page.goto(url)
      await expect(page.getByRole('heading', { level: 1 })).toContainText(heading)
    }
    expect(errors).toEqual([])
  })

  test('fitxa 360º d’una persona amb accessos, factures i família', async ({ page }) => {
    await login(page, 'admin@cpsfit.demo', /\/admin$/)
    await page.goto('/admin/persones?q=Aymerich')
    await page.getByRole('link', { name: /Aymerich Ribas, Marina/ }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Marina Aymerich Ribas')
    await expect(page.getByText('Accessos per zona')).toBeVisible()
    await expect(page.getByText('Factures', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Família')).toBeVisible()
  })

  test('reserva de pàdel a preu de no soci, cobrada en efectiu, i cancel·lació', async ({ page }) => {
    await login(page, 'admin@cpsfit.demo', /\/admin$/)
    const d = new Date(Date.now() + (60 + Math.floor(Math.random() * 300)) * 86400000)
    while (d.getDay() === 0) d.setDate(d.getDate() + 1)
    const date = d.toISOString().slice(0, 10)
    await page.goto(`/admin/reserves?date=${date}`)
    await page.getByRole('button', { name: 'Pista pàdel 1 10:00' }).click()
    await page.getByPlaceholder('Cerca un soci o client…').fill('Sandra Aymerich')
    await page.getByRole('button', { name: /Sandra Aymerich Serra/ }).click()
    await expect(page.getByText('No soci').first()).toBeVisible()
    await page.getByLabel('Cobrament').selectOption('cash')
    await page.getByRole('button', { name: 'Crea la reserva' }).click()
    const block = page.getByRole('button', { name: /Sandra Aymerich Serra/ })
    await expect(block).toBeVisible()
    await expect(block).toContainText('Pagada')
    await block.click()
    page.once('dialog', (dlg) => dlg.accept())
    await page.getByRole('button', { name: 'Cancel·la la reserva' }).click()
    await expect(page.getByRole('button', { name: /Sandra Aymerich Serra/ })).toHaveCount(0)
  })

  test('el calendari impedeix la doble reserva', async ({ page }) => {
    await login(page, 'admin@cpsfit.demo', /\/admin$/)
    const d = new Date(Date.now() + (60 + Math.floor(Math.random() * 300)) * 86400000)
    while (d.getDay() === 0) d.setDate(d.getDate() + 1)
    const date = d.toISOString().slice(0, 10)
    await page.goto(`/admin/reserves?date=${date}`)
    await page.getByRole('button', { name: 'Pista pàdel 2 12:00' }).click()
    await page.getByPlaceholder('Cerca un soci o client…').fill('Marina Aymerich')
    await page.getByRole('button', { name: /Marina Aymerich Ribas/ }).click()
    await page.getByRole('button', { name: 'Crea la reserva' }).click()
    await expect(page.getByRole('button', { name: /Marina Aymerich Ribas/ })).toBeVisible()
    await page.getByRole('button', { name: 'Pista pàdel 2 14:00' }).click()
    await page.getByPlaceholder('Cerca un soci o client…').fill('Marina Aymerich')
    await page.locator('dialog[open]').getByRole('button', { name: /Marina Aymerich Ribas/ }).click()
    await page.locator('dialog[open] select[name=start]').selectOption('12:30')
    await page.getByRole('button', { name: 'Crea la reserva' }).click()
    await expect(page.locator('dialog[open] [role=alert]')).toContainText('ocupat')
    await page.locator('dialog[open]').getByRole('button', { name: 'Tanca' }).click()
    await page.getByRole('button', { name: /Marina Aymerich Ribas/ }).click()
    page.once('dialog', (dlg) => dlg.accept())
    await page.getByRole('button', { name: 'Cancel·la la reserva' }).click()
  })

  test('factura en PDF, XML SEPA i CSV es descarreguen', async ({ page }) => {
    await login(page, 'admin@cpsfit.demo', /\/admin$/)
    await page.goto('/admin/facturacio')
    const href = await page.getByRole('link', { name: /^F-2026-/ }).first().getAttribute('href')
    const id = href!.split('/').pop()
    const pdf = await page.request.get(`/api/invoices/${id}/pdf`)
    expect(pdf.status()).toBe(200)
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-')
    const csv = await page.request.get('/admin/facturacio/export')
    expect(await csv.text()).toContain('numero;data')
    await page.goto('/admin/facturacio?tab=sepa')
    const xml = await page.request.get((await page.getByRole('link', { name: 'XML' }).first().getAttribute('href'))!)
    expect(xml.status()).toBe(200)
    expect(await xml.text()).toContain('pain.008.001.02')
  })

  test('terminal de recepció: un carnet QR vàlid es comprova i un de manipulat es rebutja', async ({ page }) => {
    await login(page, 'recepcio@cpsfit.demo', /\/admin$/)
    await page.goto('/admin/persones?q=Aymerich')
    const href = await page.getByRole('link', { name: /Aymerich Ribas, Marina/ }).getAttribute('href')
    const id = href!.split('/').pop()
    const { token } = await (await page.request.get(`/api/card?person=${id}`)).json()
    await page.goto('/admin/acces?tab=reception')
    const input = page.getByPlaceholder(/Escaneja el QR/)
    await input.fill(token)
    await input.press('Enter')
    await expect(page.getByText(/ACCÉS (PERMÈS|DENEGAT)/)).toBeVisible()
    await expect(page.getByText('Marina Aymerich Ribas')).toBeVisible()
    await input.fill(`${token}x`)
    await input.press('Enter')
    await expect(page.getByText('QR caducat o no vàlid')).toBeVisible()
  })

  test('paleta ⌘K: navega i cerca persones', async ({ page }) => {
    await login(page, 'admin@cpsfit.demo', /\/admin$/)
    await page.keyboard.press('Control+k')
    await page.getByPlaceholder(/Cerca persones/).fill('Marina Aymerich')
    await page.getByRole('option', { name: /Marina Aymerich Ribas/ }).click()
    await expect(page).toHaveURL(/\/admin\/persones\/[0-9a-f-]{36}/)
  })
})

test.describe('Rols', () => {
  test('recepció veu accessos i facturació però no informes ni configuració', async ({ page }) => {
    await login(page, 'recepcio@cpsfit.demo', /\/admin$/)
    await expect(page.getByRole('link', { name: 'Accessos' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Informes' })).toHaveCount(0)
    await page.goto('/admin/informes')
    await expect(page).toHaveURL(/\/admin$/)
    await page.goto('/admin/configuracio')
    await expect(page).toHaveURL(/\/admin$/)
  })

  test('la junta consulta però no pot crear persones ni reserves', async ({ page }) => {
    await login(page, 'junta@cpsfit.demo', /\/admin$/)
    await page.goto('/admin/persones')
    await expect(page.getByRole('button', { name: 'Nova persona' })).toHaveCount(0)
    await page.goto('/admin/informes')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Informes')
  })

  test('el monitor no veu persones, facturació ni informes', async ({ page }) => {
    await login(page, 'monitor1@cpsfit.demo', /\/admin$/)
    for (const u of ['/admin/persones', '/admin/facturacio', '/admin/informes', '/admin/acces']) {
      await page.goto(u)
      await expect(page).toHaveURL(/\/admin$/)
    }
  })

  test('l’entrenador aterra a Seccions i només veu el seu àmbit', async ({ page }) => {
    await login(page, 'entrenador@cpsfit.demo', /\/admin\/seccions$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Seccions i equips')
    await page.goto('/admin/facturacio')
    await expect(page).toHaveURL(/\/admin(\/seccions)?$/)
  })

  test('un soci no pot entrar al panell', async ({ page }) => {
    await login(page, 'soci11@cpsfit.demo', /\/app$/)
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/app$/)
  })
})
