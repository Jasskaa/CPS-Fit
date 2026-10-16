// Extrae las claves i18n usadas en src/ y comprueba que existan en ca.json y es.json.
// Uso: node scripts/i18n-keys.mjs [--list]
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const files = []
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(tsx?|ts)$/.test(f) && !/\.test\./.test(f) && files.push(p) })
walk('src')

const used = new Map() // key -> file
const dynamic = []
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const vars = new Map()
  for (const m of src.matchAll(/const (\w+) = (?:await )?(?:useTranslations|getTranslations)\(\s*(?:'([^']*)')?\s*\)/g)) vars.set(m[1], m[2] ?? '')
  for (const [v, ns] of vars) {
    const re = new RegExp('(?<![\\w.])' + v + '\\(\\s*([\'"`])([^\'"`]+)\\1', 'g')
    for (const m of src.matchAll(re)) {
      const key = m[2]
      if (m[1] === '`' && key.includes('${')) { dynamic.push(`${file}: ${ns ? ns + '.' : ''}${key}`); continue }
      used.set(ns ? `${ns}.${key}` : key, file)
    }
  }
}
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]))
const has = (o, key) => key.split('.').reduce((a, k) => (a && typeof a === 'object' ? a[k] : undefined), o) !== undefined
const deep = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === 'object' && typeof a[k] === 'object' ? deep(a[k], v) : v; return o }
let bad = 0
for (const loc of ['ca', 'es']) {
  const read = (f) => JSON.parse(readFileSync(f, 'utf8'))
  const json = deep(read(`src/messages/${loc}.json`), read(`src/messages/club.${loc}.json`))
  for (const [k, f] of used) if (!has(json, k)) { console.log(`[${loc}] falta: ${k}  (${f})`); bad++ }
}
const both = (l) => deep(JSON.parse(readFileSync(`src/messages/${l}.json`, 'utf8')), JSON.parse(readFileSync(`src/messages/club.${l}.json`, 'utf8')))
const ca = flat(both('ca'))
const es = flat(both('es'))
ca.filter((k) => !es.includes(k)).forEach((k) => { console.log(`[es] sin traducir: ${k}`); bad++ })
es.filter((k) => !ca.includes(k)).forEach((k) => { console.log(`[ca] sin traducir: ${k}`); bad++ })
if (process.argv.includes('--list')) { console.log([...used.keys()].sort().join('\n')); console.log('\nDINÁMICAS:\n' + dynamic.join('\n')) }
console.log(bad ? `\n${bad} problemas` : `\nOK: ${used.size} claves (+${dynamic.length} dinámicas)`)
process.exit(bad ? 1 : 0)
