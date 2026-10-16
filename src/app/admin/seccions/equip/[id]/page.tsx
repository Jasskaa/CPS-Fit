import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays, ClipboardList, Plus, Users } from 'lucide-react'
import { pageCtx, pick } from '@/lib/ctx'
import { ageOn, fmtDateTime } from '@/lib/format'
import { Field, Section, StatusChip, DataTable, td, th, trow } from '@/components/club-ui'
import { ActionButton, ActionForm, Modal, PersonPicker } from '@/components/club-client'
import { addTeamMember, createTeamEvent, removeTeamMember, saveScore, searchForTeam, setAttendance, toggleTeamFlag } from '../../actions'

const ATT = ['present', 'absent', 'yes', 'no', 'maybe', 'unknown'] as const

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { t, locale, supabase, writable } = await pageCtx('sections')
  const { data: team } = await supabase.from('teams').select('id, name, category, gender, league, training_notes, sections(id, name_ca, name_es, color), seasons(name)').eq('id', id).maybeSingle()
  if (!team) notFound()
  const sec = team.sections as unknown as { id: string; name_ca: string; name_es: string; color: string | null }
  const [{ data: roster }, { data: events }] = await Promise.all([
    supabase.from('team_members').select('person_id, role, shirt_number, medical_ok, photo_auth, people(first_name, last_name, birth_date)').eq('team_id', id).order('role').order('shirt_number'),
    supabase.from('team_events').select('id, kind, title, starts_at, location, opponent, is_home, score_for, score_against, team_attendance(person_id, status)').eq('team_id', id).order('starts_at', { ascending: false }).limit(12),
  ])
  const nameOf = new Map((roster ?? []).map((r) => { const p = r.people as unknown as { first_name: string; last_name: string }; return [r.person_id, `${p.first_name} ${p.last_name}`] }))

  return (
    <div className="space-y-5">
      <Link href={`/admin/seccions/${sec.id}`} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-muted hover:text-text"><ArrowLeft size={16} aria-hidden /> {pick(sec, 'name', locale)}</Link>
      <header className="card overflow-hidden"><div className="h-2" style={{ background: sec.color ?? 'var(--primary)' }} />
        <div className="p-5"><h1 className="font-display text-4xl font-extrabold uppercase leading-none">{team.name}</h1>
          <p className="mt-2 flex flex-wrap gap-2 text-xs"><span className="chip chip-primary">{(team.seasons as unknown as { name: string })?.name}</span>{team.category && <span className="chip">{team.category}</span>}{team.league && <span className="chip">{team.league}</span>}<span className="chip"><Users size={12} aria-hidden /> {roster?.length ?? 0}</span></p></div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Section title={t('club.sections.roster')} icon={<Users size={20} className="text-primary-text" aria-hidden />} action={writable && (
          <Modal label={<><Plus size={15} aria-hidden /> {t('club.sections.addMember')}</>} title={t('club.sections.addMember')} className="btn btn-primary !min-h-9 text-sm">
            <ActionForm action={addTeamMember.bind(null, id)} submit={t('club.common.save')}>
              <PersonPicker search={searchForTeam} placeholder={t('club.bookings.searchPerson')} />
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('club.sections.role')}><select name="role" className="input">{['player', 'coach', 'coordinator', 'staff'].map((r) => <option key={r} value={r}>{t(`club.sections.roles.${r}`)}</option>)}</select></Field>
                <Field label={t('club.sections.shirt')}><input name="shirt_number" type="number" min={1} max={99} className="input" /></Field>
              </div>
            </ActionForm>
          </Modal>
        )}>
          {(roster?.length ?? 0) === 0 ? <p className="py-6 text-center text-sm text-muted">{t('club.sections.emptyRoster')}</p> : (
            <DataTable label={t('club.sections.roster')}>
              <thead><tr><th className={th}>#</th><th className={th}>{t('club.common.name')}</th><th className={th}>{t('club.people.cols.age')}</th><th className={th}>{t('club.sections.role')}</th><th className={th}>{t('club.sections.medical')}</th><th className={th}>{t('club.sections.photo')}</th><th /></tr></thead>
              <tbody>{roster!.map((r) => { const p = r.people as unknown as { first_name: string; last_name: string; birth_date: string }; return (
                <tr key={r.person_id} className={trow}>
                  <td className={`${td} tnum text-muted`}>{r.shirt_number ?? ''}</td>
                  <td className={td}><Link className="font-semibold hover:text-primary-text" href={`/admin/persones/${r.person_id}`}>{p.first_name} {p.last_name}</Link></td>
                  <td className={`${td} tnum`}>{ageOn(p.birth_date)}</td><td className={td}>{t(`club.sections.roles.${r.role}`)}</td>
                  <td className={td}>{writable ? <ActionButton action={toggleTeamFlag} args={[id, r.person_id, 'medical_ok', !r.medical_ok]} label={r.medical_ok ? '✓' : '✕'} className={`btn !min-h-8 !px-3 ${r.medical_ok ? 'btn-ghost text-success' : 'btn-danger'}`} /> : r.medical_ok ? '✓' : '✕'}</td>
                  <td className={td}>{writable ? <ActionButton action={toggleTeamFlag} args={[id, r.person_id, 'photo_auth', !r.photo_auth]} label={r.photo_auth ? '✓' : '✕'} className={`btn !min-h-8 !px-3 ${r.photo_auth ? 'btn-ghost text-success' : 'btn-ghost text-muted'}`} /> : r.photo_auth ? '✓' : '✕'}</td>
                  <td className={`${td} text-right`}>{writable && <ActionButton action={removeTeamMember} args={[id, r.person_id]} label="✕" className="btn btn-ghost !min-h-8 !px-2 text-xs" confirm={t('club.common.confirm') + '?'} />}</td>
                </tr>) })}</tbody>
            </DataTable>
          )}
        </Section>

        <Section title={t('club.sections.schedule')} icon={<CalendarDays size={20} className="text-primary-text" aria-hidden />} action={writable && (
          <Modal label={<><Plus size={15} aria-hidden /> {t('club.sections.newSession')}</>} title={t('club.sections.newSession')} className="btn btn-primary !min-h-9 text-sm">
            <ActionForm action={createTeamEvent.bind(null, id)} submit={t('club.common.save')} className="grid gap-3 sm:grid-cols-2">
              <Field label={t('club.bookings.type')}><select name="kind" className="input">{['training', 'match', 'trip', 'other'].map((k) => <option key={k} value={k}>{t(`club.sections.teamKinds.${k}`)}</option>)}</select></Field>
              <Field label={t('club.common.date')}><input name="date" type="date" required className="input" /></Field>
              <Field label={t('club.bookings.start')}><input name="start" type="time" required defaultValue="18:00" className="input" /></Field>
              <Field label={t('club.sections.end')}><input name="end" type="time" className="input" /></Field>
              <Field label={t('club.sections.location')}><input name="location" className="input" /></Field>
              <Field label={t('club.sections.opponent')}><input name="opponent" className="input" /></Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="is_home" /> {t('club.sections.home')}</label>
            </ActionForm>
          </Modal>
        )}>
          {(events?.length ?? 0) === 0 ? <p className="py-6 text-center text-sm text-muted">{t('club.sections.noSessions')}</p> : (
            <ul className="divide-y divide-border text-sm">{events!.map((e) => {
              const att = e.team_attendance as { person_id: string; status: string }[]
              const present = att.filter((a) => a.status === 'present' || a.status === 'yes').length
              return (
                <li key={e.id} className="space-y-2 py-3">
                  <p className="flex items-center justify-between gap-2"><span className="font-semibold">{t(`club.sections.teamKinds.${e.kind}`)}{e.opponent ? ` vs ${e.opponent}` : ''}</span>{e.score_for != null && <span className="chip chip-primary tnum">{e.score_for}–{e.score_against}</span>}</p>
                  <p className="text-xs text-muted tnum">{fmtDateTime(e.starts_at, locale)}{e.location ? ` · ${e.location}` : ''}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Modal label={<><ClipboardList size={14} aria-hidden /> {t('club.sections.attendance')} {present}/{att.length}</>} title={t('club.sections.attendance')} className="btn btn-ghost !min-h-9 text-xs">
                      <ul className="divide-y divide-border text-sm">{att.map((a) => (
                        <li key={a.person_id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="font-semibold">{nameOf.get(a.person_id)}</span>
                          <span className="flex flex-wrap gap-1">{ATT.map((s) => writable ? <ActionButton key={s} action={setAttendance} args={[id, e.id, a.person_id, s]} label={t(`club.sections.att.${s}`)} className={`btn !min-h-8 !px-2.5 text-xs ${a.status === s ? 'btn-primary' : 'btn-ghost'}`} /> : (a.status === s ? <StatusChip key={s} value={s === 'present' ? 'ok' : 'pending'} label={t(`club.sections.att.${s}`)} /> : null))}</span></li>))}</ul>
                    </Modal>
                    {writable && e.kind === 'match' && (
                      <Modal label={t('club.sections.result')} title={t('club.sections.result')} className="btn btn-ghost !min-h-9 text-xs">
                        <ActionForm action={saveScore.bind(null, id, e.id)} submit={t('club.common.save')} className="grid grid-cols-2 gap-3">
                          <Field label={t('club.sections.scoreFor')}><input name="score_for" type="number" min={0} defaultValue={e.score_for ?? ''} className="input" /></Field>
                          <Field label={t('club.sections.scoreAgainst')}><input name="score_against" type="number" min={0} defaultValue={e.score_against ?? ''} className="input" /></Field>
                        </ActionForm>
                      </Modal>
                    )}
                  </div>
                </li>
              )
            })}</ul>
          )}
        </Section>
      </div>
    </div>
  )
}
