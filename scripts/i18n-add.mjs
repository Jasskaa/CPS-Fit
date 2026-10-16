// Fusiona un parche { ca: {...}, es: {...} } (módulo ESM en scripts/i18n/) dentro de src/messages/club.{ca,es}.json.
// Uso: node scripts/i18n-add.mjs scripts/i18n/nav.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const merge = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === 'object' ? merge(a[k] ?? {}, v) : v; return a }
const patch = (await import(pathToFileURL(resolve(process.argv[2])).href)).default
for (const loc of ['ca', 'es']) {
  const f = `src/messages/club.${loc}.json`
  const cur = JSON.parse(readFileSync(f, 'utf8'))
  writeFileSync(f, JSON.stringify(merge(cur, patch[loc]), null, 2) + '\n')
}
console.log('ok', process.argv[2])
