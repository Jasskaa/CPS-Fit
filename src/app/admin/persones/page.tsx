import Link from 'next/link'
import { Plus, Search, UserCheck } from 'lucide-react'
import { pageCtx, pick, num, str, ilikeSafe, personSearch } from '@/lib/ctx'
import { ageOn } from '@/lib/format'
import { Avatar, DataTable, PageHeader, Pager, Section, StatusChip, td, th, trow, Field } from '@/components/club-ui'
import { ActionButton, ActionForm, Modal } from '@/components/club-client'
import { EmptyState } from '@/components/ui'
import { applyAutoTypeChanges, createPerson, decideRequest, previewAutoTypeChanges } from './actions'

export const metadata = { title: 'Persones' }
const PAGE = 25

type Row = {
  id: string; first_name: string; last_name: string; birth_date: string; status: string; email: string | null; household_id: string | null
  memberships: { status: string; membership_types: { code: string; name_ca: string; name_es: string } | null }[]
  households: { name: string } | null
}

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const { t, locale, supabase, writable } = await pageCtx('people')
  const q = ilikeSafe(str(sp.q)), status = str(sp.status), type = str(sp.type), debtOnly = str(sp.debt) === '1', page = num(sp.p)

  const { data: types } = await supabase.from('membership_types').select('code, name_ca, name_es').order('sort')

  // Filtro por tipo vigente: primero los ids de persona con esa membresía.
  let typeIds: string[] | null = null
  if (type === 'none') {
    const { data } = await supabase.from('memberships').select('person_id').eq('status', 'active')
    typeIds = (data ?? []).map((r) => r.person_id)
  } else if (type) {
    const { data } = await supabase.from('memberships').select('person_id, membership_types!inner(code)').eq('status', 'active').eq('membership_types.code', type)
    typeIds = (data ?? []).map((r) => r.person_id)
  }
  let debtIds: string[] | null = null
  if (debtOnly) {
    const { data } = await supabase.from('invoices').select('person_id').eq('status', 'overdue')
    debtIds = [...new Set((data ?? []).map((r) => r.person_id))]
  }

  let query = supabase.from('people')
    .select('id, first_name, last_name, birth_date, status, email, household_id, memberships(status, membership_types(code, name_ca, name_es)), households(name)', { count: 'exact' })
    .order('last_name').order('first_name').range((page - 1) * PAGE, page * PAGE - 1)
  if (q) query = personSearch(query, q)
  if (status) query = query.eq('status', status)
  if (type === 'none' && typeIds) query = query.not('id', 'in', `(${typeIds.join(',') || '00000000-0000-0000-0000-000000000000'})`)
  else if (typeIds) query = query.in('id', typeIds.length ? typeIds : ['00000000-0000-0000-0000-000000000000'])
  if (debtIds) query = query.in('id', debtIds.length ? debtIds : ['00000000-0000-0000-0000-000000000000'])
  const { data, count } = await query
  const rows = (data ?? []) as unknown as Row[]

  const ids = rows.map((r) => r.id)
  const { data: debts } = ids.length ? await supabase.from('invoices').select('person_id, total_cents').eq('status', 'overdue').in('person_id', ids) : { data: [] }
  const debtBy = new Map<string, number>()
  debts?.forEach((d) => debtBy.set(d.person_id, (debtBy.get(d.person_id) ?? 0) + d.total_cents))

  const { data: requests } = await supabase.from('membership_requests').select('id, applicant, type_code, created_at').eq('status', 'pending').order('created_at')
  const { data: households } = writable ? await supabase.from('households').select('id, name').order('name').limit(300) : { data: [] }
  const autoN = writable ? await previewAutoTypeChanges() : 0
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE))
  const href = (p: number) => {
    const u = new URLSearchParams()
    if (q) u.set('q', q); if (status) u.set('status', status); if (type) u.set('type', type); if (debtOnly) u.set('debt', '1'); if (p > 1) u.set('p', String(p))
    return `/admin/persones${u.size ? `?${u}` : ''}`
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('club.people.title')}
        subtitle={t('club.people.count', { n: count ?? 0 })}
        actions={writable && (<>
          {autoN > 0 && <ActionButton action={applyAutoTypeChanges} label={t('club.people.autoChanges', { n: autoN })} className="btn btn-ghost" confirm={t('club.people.autoConfirm', { n: autoN })} />}
          <Modal label={<><Plus size={16} aria-hidden /> {t('club.people.newPerson')}</>} title={t('club.people.newPerson')}>
            <ActionForm action={createPerson} submit={t('club.people.create')} className="grid gap-3 sm:grid-cols-2">
                <Field label={t('club.people.first')}><input name="first_name" required className="input" /></Field>
                <Field label={t('club.people.last')}><input name="last_name" required className="input" /></Field>
                <Field label={t('club.people.birth')}><input name="birth_date" type="date" required className="input" /></Field>
                <Field label={t('club.people.nationalId')}><input name="national_id" className="input" /></Field>
                <Field label={t('club.people.email')}><input name="email" type="email" className="input" /></Field>
                <Field label={t('club.people.phone')}><input name="phone" className="input" /></Field>
                <Field label={t('club.people.address')}><input name="address" className="input" /></Field>
                <Field label={t('club.people.postal')}><input name="postal_code" className="input" /></Field>
                <Field label={t('club.people.memberType')}>
                  <select name="type_code" className="input" defaultValue="">
                    <option value="">{t('club.people.nonMember')}</option>
                    {types?.map((ty) => <option key={ty.code} value={ty.code}>{pick(ty, 'name', locale)}</option>)}
                  </select>
                </Field>
                <Field label={t('club.people.household')}>
                  <select name="household_id" className="input" defaultValue="">
                    <option value="">{t('club.people.noHousehold')}</option>
                    {households?.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="consent" /> {t('club.people.consent')}</label>
              </ActionForm>
          </Modal>
        </>)}
      />

      {requests && requests.length > 0 && (
        <Section title={`${t('club.people.requests')} · ${requests.length}`} icon={<UserCheck size={20} className="text-primary-text" aria-hidden />}>
          <ul className="divide-y divide-border">
            {requests.map((r) => {
              const a = r.applicant as { first_name: string; last_name: string; birth_date: string; note?: string }
              const ty = types?.find((x) => x.code === r.type_code)
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span><span className="font-semibold">{a.first_name} {a.last_name}</span> · {t('club.people.years', { n: ageOn(a.birth_date) })} · <span className="chip chip-primary">{ty ? pick(ty, 'name', locale) : r.type_code}</span>{a.note && <span className="block text-muted">{a.note}</span>}</span>
                  {writable && (
                    <span className="flex gap-2">
                      <ActionButton action={decideRequest} args={[r.id, true]} label={t('club.people.approve')} className="btn btn-primary !min-h-9 text-sm" />
                      <ActionButton action={decideRequest} args={[r.id, false]} label={t('club.people.reject')} />
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      <form className="card flex flex-wrap items-end gap-3 p-4" role="search">
        <div className="min-w-56 flex-1">
          <label className="sr-only" htmlFor="q">{t('club.common.search')}</label>
          <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden /><input id="q" name="q" defaultValue={q} placeholder={t('club.people.searchPh')} className="input !pl-9" /></div>
        </div>
        <select name="type" defaultValue={type} className="input !w-auto" aria-label={t('club.people.cols.type')}>
          <option value="">{t('club.people.allTypes')}</option>
          {types?.map((ty) => <option key={ty.code} value={ty.code}>{pick(ty, 'name', locale)}</option>)}
          <option value="none">{t('club.people.nonMember')}</option>
        </select>
        <select name="status" defaultValue={status} className="input !w-auto" aria-label={t('club.people.cols.status')}>
          <option value="">{t('club.people.allStatus')}</option>
          {['active', 'paused', 'left', 'prospect'].map((s) => <option key={s} value={s}>{t(`club.people.status.${s}`)}</option>)}
        </select>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="debt" value="1" defaultChecked={debtOnly} /> {t('club.people.onlyDebt')}</label>
        <button className="btn btn-primary">{t('club.people.filter')}</button>
      </form>

      {rows.length === 0 ? <EmptyState title={t('club.people.empty')} hint={t('club.people.emptyHint')} /> : (
        <DataTable label={t('club.people.title')}>
          <thead><tr><th className={th}>{t('club.people.cols.person')}</th><th className={th}>{t('club.people.cols.age')}</th><th className={th}>{t('club.people.cols.type')}</th><th className={th}>{t('club.people.cols.household')}</th><th className={th}>{t('club.people.cols.status')}</th><th className={`${th} text-right`}>{t('club.people.cols.debt')}</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const m = r.memberships.find((x) => x.status === 'active') ?? r.memberships[0]
              const debt = debtBy.get(r.id)
              return (
                <tr key={r.id} className={trow}>
                  <td className={td}>
                    <Link href={`/admin/persones/${r.id}`} className="flex items-center gap-3 hover:text-primary-text">
                      <Avatar name={`${r.first_name} ${r.last_name}`} size={36} />
                      <span><span className="block font-semibold">{r.last_name}, {r.first_name}</span><span className="block text-xs text-muted">{r.email ?? '—'}</span></span>
                    </Link>
                  </td>
                  <td className={`${td} tnum`}>{ageOn(r.birth_date)}</td>
                  <td className={td}>{m?.membership_types ? <span className="chip chip-primary">{pick(m.membership_types, 'name', locale)}</span> : <span className="text-muted">{t('club.people.noType')}</span>}</td>
                  <td className={`${td} text-muted`}>{r.households?.name ?? '—'}</td>
                  <td className={td}><StatusChip value={r.status} label={t(`club.people.status.${r.status}`)} /></td>
                  <td className={`${td} text-right tnum`}>{debt ? <span className="chip chip-danger">{(debt / 100).toFixed(2)} €</span> : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </DataTable>
      )}
      <Pager page={page} pages={pages} href={href} />
    </div>
  )
}
