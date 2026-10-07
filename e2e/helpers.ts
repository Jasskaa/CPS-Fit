import { expect, type Page } from '@playwright/test'

export const DEMO_PASSWORD = 'Demo1234!'

export async function login(page: Page, email: string, expectUrl: RegExp) {
  await page.goto('/login')
  await page.getByLabel('Correu electrònic').fill(email)
  await page.getByLabel('Contrasenya').fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(expectUrl)
}
