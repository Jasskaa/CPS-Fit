// Captura pantallas de la app desplegada para la presentación. Uso: node docs/presentacio/capturas.mjs
import { chromium, devices } from '@playwright/test'
const BASE = process.env.BASE ?? 'https://cps-fit.vercel.app'
const OUT = 'docs/presentacio/img'
const b = await chromium.launch({ channel: 'msedge' })

async function login(page, email, re) {
  await page.goto(BASE + '/login')
  await page.getByLabel('Correu electrònic').fill(email)
  await page.getByLabel('Contrasenya').fill('Demo1234!')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(re, { timeout: 30000 })
  await page.waitForLoadState('networkidle')
}
const shot = async (page, name, opts = {}) => { await page.waitForTimeout(1200); await page.screenshot({ path: `${OUT}/${name}.png`, ...opts }); console.log('✓', name) }

// ── Móvil (socio), oscuro
const m = await b.newContext({ ...devices['Pixel 7'], colorScheme: 'dark', deviceScaleFactor: 2, viewport: { width: 390, height: 800 }, reducedMotion: 'reduce' })
const p = await m.newPage()
await p.goto(BASE + '/login'); await shot(p, 'm-login')
await login(p, 'soci1@cpsfit.demo', /\/app$/)
await shot(p, 'm-inici')
await p.goto(BASE + '/app/rutina'); await p.waitForLoadState('networkidle'); await shot(p, 'm-rutina')
await p.goto(BASE + '/app/progres'); await p.waitForLoadState('networkidle')
await p.getByRole('tab', { name: 'Exercicis' }).click(); await shot(p, 'm-progres')
await p.goto(BASE + '/app/club'); await p.waitForLoadState('networkidle'); await shot(p, 'm-club')
await p.goto(BASE + '/app'); await p.getByRole('link', { name: 'Començar entrenament' }).click()
await p.waitForURL(/entreno/); await p.getByRole('button', { name: 'Marcar sèrie com a feta' }).first().click()
await shot(p, 'm-entreno')
// no guardamos el entreno: se descarta el borrador local
await m.close()

// ── Escritorio (monitor), claro
const d = await b.newContext({ viewport: { width: 1360, height: 820 }, colorScheme: 'light', deviceScaleFactor: 1.5, reducedMotion: 'reduce' })
const q = await d.newPage()
await login(q, 'monitor1@cpsfit.demo', /\/admin$/)
await shot(q, 'd-tauler')
await q.goto(BASE + '/admin/socis'); await q.waitForLoadState('networkidle'); await shot(q, 'd-socis')
await q.goto(BASE + '/admin/rutines/000000b0-0000-4000-8000-000000000002'); await q.waitForLoadState('networkidle')
await q.getByRole('button', { name: /Press banca amb barra/ }).first().click().catch(() => {}); await shot(q, 'd-constructor')
await q.goto(BASE + '/admin/socis/000000a0-0000-4000-8000-00000000000a'); await q.waitForLoadState('networkidle'); await shot(q, 'd-fitxa')
await q.goto(BASE + '/admin/exercicis'); await q.waitForLoadState('networkidle'); await shot(q, 'd-exercicis')
await b.close()
