import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Plus } from 'lucide-react'
import { pageCtx, pick } from '@/lib/ctx'
import { eur, fmtDate } from '@/lib/format'
import { DataTable, Field, KV, Section, StatusChip, td, th, trow } from '@/components/club-ui'
import { ActionButton, ActionForm, Modal, PersonPicker } from '@/components/club-client'
import { cancelRegistration, registerPerson, saveResult, searchForTeam, toggleRegistration } from '../../actions'

const fmtTime = (s: number | null) => (s == null ? '' : `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`)

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { t, locale, supabase, writable } = await pageCtx('sections')
  const { data: ev } = await supabase.from('club_events').select('*, sections(name_ca, name_es)').eq('id', id).maybeSingle()
  if (!ev) notFound()
  const { data: regs } = await supabase.from('event_registrations').select('id, status, bib, result_seconds, result_position, people(id, first_name, last_name), event_categories(name), invoices(status)').eq('event_id', id).order('result_position', { nullsFirst: false }).order('created_at')
  const active = (regs ?? []).filter((r) => r.status === 'registered')

  return (
    <div className="space-y-5">
      <Link href="/admin/seccions?tab=events" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-muted hover:text-text"><ArrowLeft size={16} aria-hidden /> {t('club.sections.tabs.events')}</Link>
      <header className="card flex flex-wrap items-start justify-between gap-4 p-5">
        <div><h1 className="font-display text-4xl font-extrabold uppercase leading-none">{pick(ev, 'title', locale)}</h1>
          <p className="mt-2 flex flex-wrap gap-2 text-xs"><span className="chip chip-primary">{t(`club.sections.kinds.${ev.kind}`)}</span><span className="chip">{fmtDate(ev.starts_on, locale)}{ev.ends_on ? ` – ${fmtDate(ev.ends_on, locale)}` : ''}</span>{ev.location && <span className="chip">{ev.location}</span>}<span className={`chip ${ev.registration_open ? 'chip-success' : 'chip-danger'}`}>{ev.registration_open ? t('club.sections.open') : t('club.sections.closed')}</span></p>
          <p className="mt-3 max-w-2xl text-sm text-muted">{pick(ev, 'description', locale)}</p></div>
        {writable && <ActionButton action={toggleRegistration} args={[id, !ev.registration_open]} label={ev.registration_open ? t('club.sections.closeReg') : t('club.sections.openReg')} className="btn btn-ghost" />}
      </header>
      <div className="grid gap-5 xl:grid-cols-[1fr_18rem]">
        <Section title={`${t('club.sections.registrations')} · ${active.length}${ev.capacity ? ` / ${ev.capacity}` : ''}`} action={writable && (
          <Modal label={<><Plus size={15} aria-hidden /> {t('club.sections.register')}</>} title={t('club.sections.register')} className="btn btn-primary !min-h-9 text-sm">
            <ActionForm action={registerPerson.bind(null, id)} submit={t('club.sections.register')}><PersonPicker search={searchForTeam} placeholder={t('club.bookings.searchPerson')} /><p className="text-xs text-muted">{t('club.sections.registerHint')}</p></ActionForm>
          </Modal>
        )}>
          {(regs?.length ?? 0) === 0 ? <p className="py-6 text-center text-sm text-muted">{t('club.sections.noRegs')}</p> : (
            <DataTable label={t('club.sections.registrations')}>
              <thead><tr><th className={th}>{t('club.sections.bib')}</th><th className={th}>{t('club.common.name')}</th><th className={th}>{t('club.common.status')}</th><th className={th}>{t('club.sections.payment')}</th><th className={th}>{t('club.sections.time')}</th><th className={th}>{t('club.sections.position')}</th><th /></tr></thead>
              <tbody>{regs!.map((r) => { const p = r.people as unknown as { id: string; first_name: string; last_name: string }; const inv = r.invoices as unknown as { status: string } | null; return (
                <tr key={r.id} className={`${trow} ${r.status === 'cancelled' ? 'opacity-50' : ''}`}>
                  <td className={`${td} tnum`}>{r.bib ?? ''}</td><td className={td}><Link className="font-semibold hover:text-primary-text" href={`/admin/persones/${p.id}`}>{p.first_name} {p.last_name}</Link></td>
                  <td className={td}><StatusChip value={r.status === 'registered' ? 'ok' : r.status === 'waitlist' ? 'waitlist' : 'cancelled'} label={t(`club.sections.regStatus.${r.status}`)} /></td>
                  <td className={td}>{inv ? <StatusChip value={inv.status} label={t(`club.bookings.inv.${inv.status}`)} /> : '—'}</td>
                  <td className={`${td} tnum`}>{fmtTime(r.result_seconds)}</td><td className={`${td} tnum`}>{r.result_position ?? ''}</td>
                  <td className={`${td} text-right`}>{writable && r.status !== 'cancelled' && (<span className="flex justify-end gap-1">
                    <Modal label={t('club.sections.result')} title={`${p.first_name} ${p.last_name}`} className="btn btn-ghost !min-h-8 text-xs"><ActionForm action={saveResult.bind(null, id, r.id)} submit={t('club.common.save')} className="grid grid-cols-3 gap-3">
                      <Field label={t('club.sections.bib')}><input name="bib" type="number" defaultValue={r.bib ?? ''} className="input" /></Field><Field label={t('club.sections.time')}><input name="time" placeholder="h:mm:ss" defaultValue={fmtTime(r.result_seconds)} className="input tnum" /></Field><Field label={t('club.sections.position')}><input name="position" type="number" defaultValue={r.result_position ?? ''} className="input" /></Field></ActionForm></Modal>
                    <ActionButton action={cancelRegistration} args={[id, r.id]} label="✕" className="btn btn-ghost !min-h-8 !px-2 text-xs" confirm={t('club.common.confirm') + '?'} /></span>)}</td>
                </tr>) })}</tbody>
            </DataTable>
          )}
        </Section>
        <Section title={t('club.sections.info')}><dl>
          <KV k={t('club.sections.priceMember')} v={eur(ev.price_member_cents, locale)} /><KV k={t('club.sections.priceNon')} v={eur(ev.price_non_member_cents, locale)} />
          <KV k={t('club.sections.capacity')} v={ev.capacity ?? '∞'} />{ev.sections && <KV k={t('club.sections.section')} v={pick(ev.sections as unknown as object, 'name', locale)} />}
        </dl></Section>
      </div>
    </div>
  )
}
