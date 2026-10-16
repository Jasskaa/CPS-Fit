import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Banknote, CalendarDays, CreditCard, DoorOpen, FileText, History, IdCard, Pencil, ShieldCheck, Ticket, Users } from 'lucide-react'
import { pageCtx, pick } from '@/lib/ctx'
import { ageOn, eur, fmtDate, fmtDateTime } from '@/lib/format'
import { Avatar, DataTable, Field, KV, Section, StatusChip, td, trow } from '@/components/club-ui'
import { ActionButton, ActionForm, Modal } from '@/components/club-client'
import { decideZone, loadAccessConfig, loadSubject } from '@/modules/access/server'
import { addAccessOverride, changeMembership, removeAccessOverride, saveBankAccount, setPersonStatus, updatePerson } from '../actions'

export const metadata = { title: 'Fitxa de persona' }

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { t, locale, supabase, writable, profile } = await pageCtx('people')
  const { data: p } = await supabase.from('people').select('*, households(id, name, address, municipality, empadronament_ok)').eq('id', id).maybeSingle()
  if (!p) notFound()
  const name = `${p.first_name} ${p.last_name}`
  const canBank = profile.role === 'admin'
  const canAccess = profile.role === 'admin' || profile.role === 'reception'

  const [family, mems, types, bookings, invoices, payments, logs, passes, bank, teams, regs, access] = await Promise.all([
    p.household_id ? supabase.from('people').select('id, first_name, last_name, birth_date, household_role, status').eq('household_id', p.household_id).order('birth_date') : Promise.resolve({ data: [] }),
    supabase.from('memberships').select('id, status, started_on, ended_on, seniority_since, billable, membership_types(code, name_ca, name_es, annual_fee_cents)').eq('person_id', id).order('started_on', { ascending: false }),
    supabase.from('membership_types').select('code, name_ca, name_es').eq('active', true).order('sort'),
    supabase.from('bookings').select('id, starts_at, ends_at, status, kind, price_cents, resources(name)').eq('person_id', id).order('starts_at', { ascending: false }).limit(12),
    supabase.from('invoices').select('id, number, issued_on, status, kind, total_cents').eq('person_id', id).order('issued_on', { ascending: false }).limit(12),
    supabase.from('payments').select('id, method, amount_cents, status, paid_at, invoice_id').eq('person_id', id).order('paid_at', { ascending: false }).limit(10),
    supabase.from('access_logs').select('id, at, allowed, reason, direction, zones(name_ca, name_es)').eq('person_id', id).order('at', { ascending: false }).limit(10),
    supabase.from('passes').select('id, uses_left, uses_total, valid_until, status, nominal, products(name_ca, name_es)').eq('person_id', id).order('created_at', { ascending: false }).limit(8),
    canBank || profile.role === 'board' ? supabase.from('bank_accounts').select('iban, holder_name, mandate_id, mandate_signed_on').eq('person_id', id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('team_members').select('role, shirt_number, teams(name, sections(name_ca, name_es))').eq('person_id', id),
    supabase.from('event_registrations').select('id, status, bib, club_events(title_ca, title_es, starts_on)').eq('person_id', id).limit(8),
    loadAccessConfig(supabase),
  ])

  const { subject, allOverrides } = await loadSubject(supabase, id, access.cfg)
  const now = new Date()
  const activeOv = allOverrides.filter((o) => !o.until || o.until >= now.toISOString().slice(0, 10))
  const matrix = access.zones.map((z) => ({ z, d: decideZone(access.rules, z, subject, activeOv, now) }))

  const activeMem = (mems.data ?? []).find((m) => m.status === 'active') as unknown as { id: string; status: string; started_on: string; seniority_since: string | null; billable: boolean; membership_types: { code: string; name_ca: string; name_es: string; annual_fee_cents: number } } | undefined
  const hh = p.households as { id: string; name: string; address: string | null; municipality: string | null; empadronament_ok: boolean } | null
  const overdue = (invoices.data ?? []).filter((i) => i.status === 'overdue')
  const total = <T,>(a: T[] | null | undefined) => a?.length ?? 0

  const timeline = [
    ...(bookings.data ?? []).map((b) => ({ at: b.starts_at, kind: 'booking', text: `${(b.resources as unknown as { name: string } | null)?.name ?? ''} · ${eur(b.price_cents, locale)}`, status: b.status })),
    ...(invoices.data ?? []).map((i) => ({ at: i.issued_on, kind: 'invoice', text: `${i.number ?? ''} · ${eur(i.total_cents, locale)}`, status: i.status })),
    ...(payments.data ?? []).filter((x) => x.paid_at).map((x) => ({ at: x.paid_at as string, kind: 'payment', text: `${x.method} · ${eur(x.amount_cents, locale)}`, status: x.status })),
    ...(logs.data ?? []).map((l) => ({ at: l.at, kind: 'access', text: pick(l.zones as unknown as Record<string, unknown>, 'name', locale), status: l.allowed ? 'ok' : 'denied' })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 14)

  return (
    <div className="space-y-5">
      <Link href="/admin/persones" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-muted hover:text-text"><ArrowLeft size={16} aria-hidden /> {t('club.people.title')}</Link>

      <header className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <Avatar name={name} size={64} />
          <div>
            <h1 className="font-display text-4xl font-extrabold uppercase leading-none">{name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="tnum">{t('club.people.profile.ageNow', { n: ageOn(p.birth_date) })}</span>
              {activeMem && <span className="chip chip-primary">{pick(activeMem.membership_types, 'name', locale)}</span>}
              <StatusChip value={p.status} label={t(`club.people.status.${p.status}`)} />
              {overdue.length > 0 && <span className="chip chip-danger">{t('club.people.profile.hasDebt')}</span>}
              <span>{t('club.people.profile.joined', { d: fmtDate(p.created_at, locale) })}</span>
            </p>
          </div>
        </div>
        {writable && (
          <div className="flex flex-wrap items-center gap-2">
            <Modal label={<><Pencil size={15} aria-hidden /> {t('club.people.profile.edit')}</>} title={t('club.people.profile.data')} className="btn btn-ghost">
              <ActionForm action={updatePerson.bind(null, id)} submit={t('club.common.save')} className="grid gap-3 sm:grid-cols-2">
                  <Field label={t('club.people.first')}><input name="first_name" defaultValue={p.first_name} required className="input" /></Field>
                  <Field label={t('club.people.last')}><input name="last_name" defaultValue={p.last_name} required className="input" /></Field>
                  <Field label={t('club.people.birth')}><input name="birth_date" type="date" defaultValue={p.birth_date} required className="input" /></Field>
                  <Field label={t('club.people.nationalId')}><input name="national_id" defaultValue={p.national_id ?? ''} className="input" /></Field>
                  <Field label={t('club.people.email')}><input name="email" type="email" defaultValue={p.email ?? ''} className="input" /></Field>
                  <Field label={t('club.people.phone')}><input name="phone" defaultValue={p.phone ?? ''} className="input" /></Field>
                  <Field label={t('club.people.address')}><input name="address" defaultValue={p.address ?? ''} className="input" /></Field>
                  <Field label={t('club.people.postal')}><input name="postal_code" defaultValue={p.postal_code ?? ''} className="input" /></Field>
                  <div className="sm:col-span-2"><Field label={t('club.people.profile.notes')}><textarea name="notes" defaultValue={p.notes ?? ''} rows={3} className="input" /></Field></div>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="marketing_ok" defaultChecked={p.marketing_ok} /> {t('club.people.profile.consentMarketing')}</label>
                </ActionForm>
            </Modal>
            {p.status !== 'active' && <ActionButton action={setPersonStatus} args={[id, 'active']} label={t('club.people.status.active')} className="btn btn-primary !min-h-11 text-sm" />}
            {p.status === 'active' && <ActionButton action={setPersonStatus} args={[id, 'paused']} label={t('club.people.status.paused')} className="btn btn-ghost !min-h-11 text-sm" />}
            {p.status !== 'left' && <ActionButton action={setPersonStatus} args={[id, 'left']} label={t('club.people.status.left')} className="btn btn-danger !min-h-11 text-sm" confirm={t('club.common.confirm') + '?'} />}
          </div>
        )}
      </header>

      <div className="grid gap-5 xl:grid-cols-[22rem_1fr]">
        <div className="space-y-5">
          <Section title={t('club.people.profile.data')} icon={<IdCard size={20} className="text-primary-text" aria-hidden />}>
            <dl>
              <KV k={t('club.people.email')} v={p.email ?? '—'} />
              <KV k={t('club.people.phone')} v={p.phone ?? '—'} />
              <KV k={t('club.people.nationalId')} v={p.national_id ?? '—'} />
              <KV k={t('club.people.birth')} v={fmtDate(p.birth_date, locale)} />
              <KV k={t('club.people.address')} v={[p.address, p.postal_code].filter(Boolean).join(', ') || '—'} />
            </dl>
            {p.notes && <p className="mt-3 rounded-lg bg-surface-2 p-3 text-sm"><span className="block text-xs font-semibold uppercase text-muted">{t('club.people.profile.notes')}</span>{p.notes}</p>}
          </Section>

          <Section title={t('club.people.profile.membership')} icon={<ShieldCheck size={20} className="text-primary-text" aria-hidden />}>
            {activeMem ? (
              <dl>
                <KV k={t('club.people.cols.type')} v={pick(activeMem.membership_types, 'name', locale)} />
                <KV k={t('club.people.profile.feeYear')} v={eur(activeMem.membership_types.annual_fee_cents, locale)} />
                <KV k={t('club.people.profile.since', { d: fmtDate(activeMem.seniority_since ?? activeMem.started_on, locale) })} v="" />
                <KV k="" v={<span className="text-xs text-muted">{activeMem.billable ? t('club.people.profile.billable') : t('club.people.profile.notBillable')}</span>} />
              </dl>
            ) : <p className="text-sm text-muted">{t('club.people.noType')}</p>}
            {writable && (
              <ActionForm action={changeMembership.bind(null, id)} submit={t('club.people.profile.changeType')} className="mt-3 flex flex-wrap items-end gap-2" variant="btn-ghost">
                <select name="type" className="input !w-auto flex-1" defaultValue={activeMem?.membership_types.code} aria-label={t('club.people.cols.type')}>
                  {types.data?.map((ty) => <option key={ty.code} value={ty.code}>{pick(ty, 'name', locale)}</option>)}
                </select>
              </ActionForm>
            )}
          </Section>

          <Section title={t('club.people.profile.family')} icon={<Users size={20} className="text-primary-text" aria-hidden />}>
            {hh ? (
              <>
                <p className="mb-2 text-sm text-muted">{hh.name}{hh.municipality ? ` · ${hh.municipality}` : ''}</p>
                <ul className="divide-y divide-border">
                  {(family.data ?? []).map((f) => (
                    <li key={f.id}><Link href={`/admin/persones/${f.id}`} className={`flex min-h-11 items-center justify-between gap-2 text-sm hover:text-primary-text ${f.id === id ? 'font-bold' : ''}`}>
                      <span>{f.first_name} {f.last_name}</span><span className="text-xs text-muted tnum">{ageOn(f.birth_date)} · {f.household_role}</span>
                    </Link></li>
                  ))}
                </ul>
              </>
            ) : <p className="text-sm text-muted">{t('club.people.noHousehold')}</p>}
          </Section>

          <Section title={t('club.people.profile.consents')} icon={<FileText size={20} className="text-primary-text" aria-hidden />}>
            <dl>
              <KV k={t('club.people.profile.consentData')} v={p.consent_at ? t('club.people.profile.consentAt', { d: fmtDate(p.consent_at, locale) }) : t('club.people.profile.noConsent')} />
              <KV k={t('club.people.profile.consentMarketing')} v={p.marketing_ok ? t('club.common.yes') : t('club.common.no')} />
            </dl>
          </Section>

          {(canBank || profile.role === 'board') && (
            <Section title={t('club.people.profile.bank')} icon={<Banknote size={20} className="text-primary-text" aria-hidden />}>
              {bank.data ? (
                <dl>
                  <KV k={t('club.people.profile.iban')} v={<span className="tnum">{'•••• ' + bank.data.iban.slice(-4)}</span>} />
                  <KV k={t('club.people.profile.holder')} v={bank.data.holder_name ?? '—'} />
                  <KV k={t('club.people.profile.mandate')} v={<span className="tnum text-xs">{bank.data.mandate_id}</span>} />
                </dl>
              ) : <p className="text-sm text-muted">{t('club.people.profile.noBank')}</p>}
              {canBank && (
                <div className="mt-3">
                  <Modal label={t('club.people.profile.saveBank')} title={t('club.people.profile.bank')} className="btn btn-ghost !min-h-10 text-sm">
                    <ActionForm action={saveBankAccount.bind(null, id)} submit={t('club.common.save')}>
                        <Field label={t('club.people.profile.iban')}><input name="iban" required className="input tnum" placeholder="ES00 0000 0000 0000 0000 0000" /></Field>
                        <Field label={t('club.people.profile.holder')}><input name="holder_name" defaultValue={name} className="input" /></Field>
                      </ActionForm>
                  </Modal>
                </div>
              )}
            </Section>
          )}
        </div>

        <div className="space-y-5">
          <Section
            title={t('club.people.profile.access')}
            icon={<DoorOpen size={20} className="text-primary-text" aria-hidden />}
            action={canAccess && (
              <Modal label={t('club.people.profile.addOverride')} title={t('club.people.profile.overrides')} className="btn btn-ghost !min-h-9 text-sm">
                <ActionForm action={addAccessOverride.bind(null, id)} submit={t('club.common.save')}>
                    <Field label={t('club.people.profile.zone')}>
                      <select name="zone_id" className="input">{access.zones.map((z) => <option key={z.id} value={z.id}>{pick(z, 'name', locale)}</option>)}</select>
                    </Field>
                    <Field label={t('club.common.actions')}>
                      <select name="allow" className="input"><option value="true">{t('club.people.profile.allow')}</option><option value="false">{t('club.people.profile.deny')}</option></select>
                    </Field>
                    <Field label={t('club.people.profile.reason')}><input name="reason" required minLength={2} className="input" /></Field>
                    <Field label={t('club.people.profile.until')}><input name="until" type="date" className="input" /></Field>
                  </ActionForm>
              </Modal>
            )}
          >
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {matrix.map(({ z, d }) => (
                <li key={z.id} className={`rounded-xl border p-3 text-sm ${d.allowed ? 'border-success/40 bg-success-soft' : 'border-border bg-surface-2'}`}>
                  <p className="flex items-center justify-between gap-2 font-semibold"><span>{pick(z, 'name', locale)}</span><span aria-hidden>{d.allowed ? '✓' : '✕'}</span></p>
                  <p className="text-xs text-muted">{t(`club.people.reason.${d.reason}`)}{d.override ? ` · ${d.override.reason}` : ''}</p>
                </li>
              ))}
            </ul>
            {allOverrides.length > 0 && (
              <ul className="mt-3 divide-y divide-border text-sm">
                {allOverrides.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                    <span>{pick(access.zones.find((z) => z.id === o.zone_id) ?? { name_ca: '' }, 'name', locale)} · <b>{o.allow ? t('club.people.profile.allow') : t('club.people.profile.deny')}</b> · {o.reason}{o.until ? ` · ${fmtDate(o.until, locale)}` : ''}</span>
                    {canAccess && <ActionButton action={removeAccessOverride} args={[id, o.id]} label="✕" className="btn btn-ghost !min-h-8 !px-2 text-xs" />}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={t('club.people.profile.invoices')} icon={<FileText size={20} className="text-primary-text" aria-hidden />} action={<Link className="btn btn-ghost !min-h-9 text-sm" href={`/admin/facturacio?q=${encodeURIComponent(p.last_name)}`}>{t('club.nav.billing')}</Link>}>
            {total(invoices.data) === 0 ? <p className="text-sm text-muted">{t('club.people.profile.noData')}</p> : (
              <DataTable label={t('club.people.profile.invoices')}>
                <tbody>{invoices.data!.map((i) => (
                  <tr key={i.id} className={trow}><td className={td}><Link className="font-semibold hover:text-primary-text" href={`/admin/facturacio/${i.id}`}>{i.number}</Link></td><td className={`${td} text-muted`}>{fmtDate(i.issued_on, locale)}</td><td className={td}>{i.kind}</td><td className={`${td} tnum`}>{eur(i.total_cents, locale)}</td><td className={td}><StatusChip value={i.status} /></td></tr>
                ))}</tbody>
              </DataTable>
            )}
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title={t('club.people.profile.bookings')} icon={<CalendarDays size={20} className="text-primary-text" aria-hidden />}>
              {total(bookings.data) === 0 ? <p className="text-sm text-muted">{t('club.people.profile.noData')}</p> : (
                <ul className="divide-y divide-border text-sm">{bookings.data!.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 py-2"><span><span className="block font-semibold">{(b.resources as unknown as { name: string } | null)?.name}</span><span className="text-xs text-muted">{fmtDateTime(b.starts_at, locale)}</span></span><span className="flex items-center gap-2"><span className="tnum">{eur(b.price_cents, locale)}</span><StatusChip value={b.status} /></span></li>
                ))}</ul>
              )}
            </Section>
            <Section title={t('club.people.profile.payments')} icon={<CreditCard size={20} className="text-primary-text" aria-hidden />}>
              {total(payments.data) === 0 ? <p className="text-sm text-muted">{t('club.people.profile.noData')}</p> : (
                <ul className="divide-y divide-border text-sm">{payments.data!.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-2 py-2"><span><span className="block font-semibold capitalize">{x.method}</span><span className="text-xs text-muted">{x.paid_at ? fmtDateTime(x.paid_at, locale) : '—'}</span></span><span className="flex items-center gap-2"><span className="tnum">{eur(x.amount_cents, locale)}</span><StatusChip value={x.status} /></span></li>
                ))}</ul>
              )}
            </Section>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title={t('club.people.profile.passes')} icon={<Ticket size={20} className="text-primary-text" aria-hidden />}>
              {total(passes.data) === 0 ? <p className="text-sm text-muted">{t('club.people.profile.noData')}</p> : (
                <ul className="divide-y divide-border text-sm">{passes.data!.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-2 py-2"><span className="font-semibold">{pick(x.products as unknown as Record<string, unknown>, 'name', locale)}</span><span className="text-xs text-muted">{x.uses_left != null ? t('club.people.profile.usesLeft', { n: x.uses_left }) : ''}{x.valid_until ? ` · ${t('club.people.profile.validUntil', { d: fmtDate(x.valid_until, locale) })}` : ''}</span></li>
                ))}</ul>
              )}
              {(teams.data?.length ?? 0) > 0 && <p className="mt-3 text-xs font-semibold uppercase text-muted">{t('club.people.profile.teams')}</p>}
              <ul className="text-sm">{(teams.data ?? []).map((tm, i) => { const x = tm as unknown as { role: string; teams: { name: string } }; return <li key={i} className="py-1">{x.teams.name} · <span className="text-muted">{x.role}</span></li> })}</ul>
              {(regs.data?.length ?? 0) > 0 && <p className="mt-3 text-xs font-semibold uppercase text-muted">{t('club.people.profile.events')}</p>}
              <ul className="text-sm">{(regs.data ?? []).map((r) => { const e = r.club_events as unknown as Record<string, unknown>; return <li key={r.id} className="py-1">{pick(e, 'title', locale)} <span className="text-muted">· {r.status}</span></li> })}</ul>
            </Section>
            <Section title={t('club.people.profile.timeline')} icon={<History size={20} className="text-primary-text" aria-hidden />}>
              <ol className="space-y-2 border-l-2 border-border pl-4 text-sm">
                {timeline.map((e, i) => (
                  <li key={i} className="relative"><span aria-hidden className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                    <span className="block font-semibold">{t(`club.people.profile.tl.${e.kind}`)} <StatusChip value={e.status} /></span>
                    <span className="text-xs text-muted">{e.kind === 'invoice' ? fmtDate(e.at, locale) : fmtDateTime(e.at, locale)} · {e.text}</span>
                  </li>
                ))}
              </ol>
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}
