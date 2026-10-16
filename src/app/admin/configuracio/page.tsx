import { pageCtx, pick } from '@/lib/ctx'
import { eur } from '@/lib/format'
import { DataTable, Field, PageHeader, Section, td, th, trow } from '@/components/club-ui'
import { ActionForm, Modal } from '@/components/club-client'
import { saveAccess, saveBilling, saveBookingsCfg, saveClub, saveMembershipType, saveZone, setUserRole } from './actions'

export const metadata = { title: 'Configuració' }
const ROLES = ['admin', 'board', 'reception', 'trainer', 'coordinator', 'coach']

export default async function SettingsPage() {
  const { t, locale, supabase, userId } = await pageCtx('settings')
  const [{ data: rows }, { data: types }, { data: zones }, { data: staff }] = await Promise.all([
    supabase.from('settings').select('key, value'),
    supabase.from('membership_types').select('id, code, name_ca, name_es, annual_fee_cents, min_age, max_age, active').order('sort'),
    supabase.from('zones').select('id, name_ca, name_es, capacity').order('sort'),
    supabase.from('profiles').select('id, full_name, email, role').neq('role', 'member').order('role').order('full_name'),
  ])
  const cfg = (k: string) => (rows?.find((r) => r.key === k)?.value ?? {}) as Record<string, string | number | boolean>

  const club = cfg('club'), billing = cfg('billing'), access = cfg('access'), bk = cfg('bookings')
  return (
    <div className="space-y-6">
      <PageHeader title={t('club.settings.title')} subtitle={t('club.settings.subtitle')} />
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title={t('club.settings.club')}>
          <ActionForm action={saveClub} submit={t('club.common.save')} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label={t('club.common.name')}><input name="name" defaultValue={String(club.name ?? '')} className="input" /></Field></div>
            <Field label={t('club.people.email')}><input name="email" defaultValue={String(club.email ?? '')} className="input" /></Field>
            <Field label={t('club.people.phone')}><input name="phone" defaultValue={String(club.phone ?? '')} className="input" /></Field>
            <div className="sm:col-span-2"><Field label={t('club.people.address')}><input name="address" defaultValue={String(club.address ?? '')} className="input" /></Field></div>
            <Field label="WhatsApp"><input name="whatsapp" defaultValue={String(club.whatsapp ?? '')} className="input" /></Field>
            <Field label={t('club.settings.reception')}><input name="reception" defaultValue={String(club.reception ?? '')} className="input" /></Field>
            <div className="sm:col-span-2"><Field label={t('club.settings.bookingUrl')}><input name="booking_url" defaultValue={String(club.booking_url ?? '')} className="input" /></Field></div>
          </ActionForm>
        </Section>
        <Section title={t('club.settings.billing')}>
          <ActionForm action={saveBilling} submit={t('club.common.save')} className="grid gap-3 sm:grid-cols-2">
            {Boolean(billing.example) && <p className="rounded-lg bg-warn-soft p-2.5 text-xs sm:col-span-2">{t('club.settings.ibanExample')}</p>}
            <div className="sm:col-span-2"><Field label={t('club.settings.creditorName')}><input name="creditor_name" defaultValue={String(billing.creditor_name ?? '')} className="input" /></Field></div>
            <Field label={t('club.people.profile.iban')}><input name="iban" defaultValue={String(billing.iban ?? '')} className="input tnum" /></Field>
            <Field label={t('club.settings.creditorId')}><input name="creditor_id" defaultValue={String(billing.creditor_id ?? '')} className="input tnum" /></Field>
            <Field label={t('club.settings.entryFee')}><input name="entry_fee" inputMode="decimal" defaultValue={((Number(billing.entry_fee_cents) || 0) / 100).toFixed(2)} className="input tnum" /></Field>
            <Field label={t('club.settings.dueDays')}><input name="due_days" type="number" min={0} defaultValue={Number(billing.due_days ?? 15)} className="input" /></Field>
          </ActionForm>
        </Section>
        <Section title={t('club.settings.accessTitle')}>
          <ActionForm action={saveAccess} submit={t('club.common.save')} className="grid gap-3 sm:grid-cols-2">
            <Field label={t('club.settings.debtDays')}><input name="debt_days" type="number" min={0} defaultValue={Number(access.debt_days ?? 30)} className="input" /></Field>
            <label className="flex min-h-11 items-center gap-2 self-end text-sm"><input type="checkbox" name="block_on_debt" defaultChecked={Boolean(access.block_on_debt)} /> {t('club.settings.blockDebt')}</label>
          </ActionForm>
        </Section>
        <Section title={t('club.settings.bookingsTitle')}>
          <ActionForm action={saveBookingsCfg} submit={t('club.common.save')} className="grid gap-3 sm:grid-cols-2">
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="waitlist" defaultChecked={Boolean(bk.waitlist)} /> {t('club.settings.waitlist')}</label>
            <Field label={t('club.settings.strikes')}><input name="no_show_strikes" type="number" min={1} defaultValue={Number(bk.no_show_strikes ?? 3)} className="input" /></Field>
          </ActionForm>
        </Section>
      </div>

      <Section title={t('club.settings.types')}>
        <DataTable label={t('club.settings.types')}>
          <thead><tr><th className={th}>{t('club.common.name')}</th><th className={th}>{t('club.settings.ages')}</th><th className={`${th} text-right`}>{t('club.settings.annualFee')}</th><th className={th}>{t('club.common.status')}</th><th /></tr></thead>
          <tbody>{(types ?? []).map((ty) => <tr key={ty.id} className={trow}>
            <td className={`${td} font-semibold`}>{pick(ty, 'name', locale)}</td><td className={`${td} tnum text-muted`}>{ty.min_age ?? '—'} – {ty.max_age ?? '—'}</td><td className={`${td} text-right tnum`}>{eur(ty.annual_fee_cents, locale)}</td>
            <td className={td}><span className={`chip ${ty.active ? 'chip-success' : ''}`}>{ty.active ? t('club.settings.active') : t('club.settings.inactive')}</span></td>
            <td className={`${td} text-right`}><Modal label={t('club.common.edit')} title={pick(ty, 'name', locale)} className="btn btn-ghost !min-h-8 text-xs"><ActionForm action={saveMembershipType.bind(null, ty.id)} submit={t('club.common.save')}><Field label={t('club.settings.annualFee') + ' (€)'}><input name="fee" inputMode="decimal" defaultValue={(ty.annual_fee_cents / 100).toFixed(2)} className="input tnum" /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={ty.active} /> {t('club.settings.active')}</label></ActionForm></Modal></td></tr>)}</tbody>
        </DataTable>
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title={t('club.settings.zones')}>
          <DataTable label={t('club.settings.zones')}><thead><tr><th className={th}>{t('club.people.profile.zone')}</th><th className={`${th} text-right`}>{t('club.settings.capacity')}</th><th /></tr></thead>
            <tbody>{(zones ?? []).map((z) => <tr key={z.id} className={trow}><td className={td}>{pick(z, 'name', locale)}</td><td className={`${td} text-right tnum`}>{z.capacity ?? '∞'}</td>
              <td className={`${td} text-right`}><Modal label={t('club.common.edit')} title={pick(z, 'name', locale)} className="btn btn-ghost !min-h-8 text-xs"><ActionForm action={saveZone.bind(null, z.id)} submit={t('club.common.save')}><Field label={t('club.settings.capacity')}><input name="capacity" type="number" min={0} defaultValue={z.capacity ?? ''} className="input" /></Field></ActionForm></Modal></td></tr>)}</tbody></DataTable>
        </Section>
        <Section title={t('club.settings.staff')}>
          <p className="mb-2 text-xs text-muted">{t('club.settings.staffHint')}</p>
          <ul className="divide-y divide-border text-sm">{(staff ?? []).map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><span><span className="block font-semibold">{s.full_name}</span><span className="text-xs text-muted">{s.email}</span></span>
            <ActionForm action={setUserRole.bind(null, s.id)} submit="OK" className="flex items-center gap-2" variant="btn-ghost"><select name="role" defaultValue={s.role} disabled={s.id === userId} className="input !min-h-9 !w-auto !py-0 text-xs" aria-label={t('club.settings.role')}>{ROLES.map((r) => <option key={r} value={r}>{t(`club.roles.${r}`)}</option>)}</select></ActionForm></li>)}</ul>
        </Section>
      </div>
    </div>
  )
}
