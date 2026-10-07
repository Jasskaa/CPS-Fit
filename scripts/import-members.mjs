// Importación de socios desde CSV (preparada para la migración a la base real del club).
//
//   node --env-file=.env.local scripts/import-members.mjs socios.csv            (simulación: no escribe nada)
//   node --env-file=.env.local scripts/import-members.mjs socios.csv --apply    (crea e invita)
//
// Cabecera esperada: full_name,email,goal,level,days_per_week,trainer_email
//   level: beginner | intermediate | advanced   ·   trainer_email: correo de un monitor ya existente (opcional)
// Requiere SUPABASE_SERVICE_ROLE_KEY. Cada socio recibe un correo de invitación y debe aceptar la
// política de privacidad al entrar. NO importes datos reales hasta tener la aprobación del club.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const [file, flag] = process.argv.slice(2)
if (!file) { console.error('Uso: import-members.mjs <fichero.csv> [--apply]'); process.exit(1) }
const apply = flag === '--apply'

const parse = (line) => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).slice(0, -1).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim())
const [head, ...rows] = readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(parse)
const records = rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (apply && (!url || !key)) { console.error('Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const admin = apply ? createClient(url, key, { auth: { persistSession: false } }) : null

const LEVELS = ['beginner', 'intermediate', 'advanced']
let ok = 0, bad = 0
for (const r of records) {
  const errors = []
  if (!r.full_name) errors.push('falta full_name')
  if (!/^\S+@\S+\.\S+$/.test(r.email)) errors.push('email no válido')
  if (r.level && !LEVELS.includes(r.level)) errors.push('level no válido')
  if (errors.length) { console.log(`✗ ${r.email || '(sin email)'}: ${errors.join(', ')}`); bad++; continue }
  if (!apply) { console.log(`· ${r.full_name} <${r.email}> (simulación)`); ok++; continue }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(r.email, { data: { full_name: r.full_name, locale: 'ca', consent: 'false' } })
  if (error) { console.log(`✗ ${r.email}: ${error.message}`); bad++; continue }
  const id = data.user.id
  await admin.from('profiles').update({ status: 'active' }).eq('id', id)
  await admin.from('member_details').update({ goal: r.goal || null, level: r.level || 'beginner', days_per_week: Number(r.days_per_week) || null }).eq('member_id', id)
  if (r.trainer_email) {
    const { data: t } = await admin.from('profiles').select('id').eq('email', r.trainer_email).eq('role', 'trainer').maybeSingle()
    if (t) await admin.from('trainer_members').insert({ trainer_id: t.id, member_id: id })
    else console.log(`  ! monitor ${r.trainer_email} no encontrado: el socio queda sin monitor`)
  }
  console.log(`✓ ${r.full_name} <${r.email}>`)
  ok++
}
console.log(`\n${ok} correctos, ${bad} con errores${apply ? '' : ' (simulación: usa --apply para escribir)'}`)
