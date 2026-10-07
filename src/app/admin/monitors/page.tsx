import { getTranslations } from 'next-intl/server'
import { UserCheck } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { hasServiceRole } from '@/lib/supabase/admin'
import { assignTrainer, validateMember } from './actions'

export const metadata = { title: 'Monitors' }

export default async function TrainersPage() {
  await requireRole(['admin'])
  const t = await getTranslations()
  const supabase = await createClient()
  const [{ data: trainers }, { data: members }, { data: links }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').eq('role', 'trainer').order('full_name'),
    supabase.from('profiles').select('id, full_name, email, status').eq('role', 'member').order('full_name'),
    supabase.from('trainer_members').select('trainer_id, member_id'),
  ])
  const trainerOf = new Map((links ?? []).map((l) => [l.member_id, l.trainer_id]))
  const count = new Map<string, number>()
  links?.forEach((l) => count.set(l.trainer_id, (count.get(l.trainer_id) ?? 0) + 1))
  const pending = (members ?? []).filter((m) => m.status === 'pending')

  return (
    <div className="space-y-6">
      <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{t('admin.nav.trainers')}</h1>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label={t('admin.nav.trainers')}>
        {(trainers ?? []).map((tr) => (
          <div key={tr.id} className="card flex items-center gap-3 p-4">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary-text"><UserCheck aria-hidden /></span>
            <div className="min-w-0"><p className="truncate font-semibold">{tr.full_name}</p><p className="truncate text-xs text-muted">{tr.email}</p><p className="text-xs font-semibold">{t('admin.trainers.memberCount', { n: count.get(tr.id) ?? 0 })}</p></div>
          </div>
        ))}
      </section>
      {!hasServiceRole() && <p className="rounded-xl bg-warn-soft p-3 text-sm">{t('admin.trainers.noKey')}</p>}

      <section className="card p-4" aria-labelledby="pending">
        <h2 id="pending" className="font-display text-2xl font-bold">{t('admin.trainers.pending')} <span className="chip chip-warn">{pending.length}</span></h2>
        {pending.length === 0 ? <p className="py-4 text-sm text-muted">{t('admin.trainers.noPending')}</p> : (
          <ul className="mt-2 divide-y divide-border">
            {pending.map((m) => (
              <li key={m.id} className="py-3">
                <form action={validateMember.bind(null, m.id)} className="flex flex-wrap items-end gap-3">
                  <div className="min-w-48 flex-1"><p className="font-semibold">{m.full_name}</p><p className="text-xs text-muted">{m.email}</p></div>
                  <label className="block"><span className="label">{t('admin.trainers.assignTo')}</span>
                    <select name="trainer" className="input" required defaultValue={trainerOf.get(m.id) ?? ''}>
                      <option value="" disabled>—</option>
                      {(trainers ?? []).map((tr) => <option key={tr.id} value={tr.id}>{tr.full_name}</option>)}
                    </select>
                  </label>
                  <button className="btn btn-primary">{t('admin.trainers.validate')}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card overflow-x-auto" aria-labelledby="reassign">
        <h2 id="reassign" className="px-4 pt-4 font-display text-2xl font-bold">{t('admin.trainers.reassign')}</h2>
        <table className="mt-2 w-full min-w-[30rem] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted"><tr><th scope="col" className="px-4 py-2">{t('admin.members.name')}</th><th scope="col" className="px-4 py-2">{t('admin.trainers.trainer')}</th></tr></thead>
          <tbody className="divide-y divide-border">
            {(members ?? []).filter((m) => m.status !== 'pending').map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2 font-semibold">{m.full_name}</td>
                <td className="px-4 py-2">
                  <form action={assignTrainer.bind(null, m.id)} className="flex gap-2">
                    <select name="trainer" defaultValue={trainerOf.get(m.id) ?? ''} className="input !min-h-11" aria-label={`${t('admin.trainers.trainer')} ${m.full_name}`}>
                      <option value="" disabled>—</option>
                      {(trainers ?? []).map((tr) => <option key={tr.id} value={tr.id}>{tr.full_name}</option>)}
                    </select>
                    <button className="btn btn-ghost !min-h-11 text-sm">{t('common.save')}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
