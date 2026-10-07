'use client'

import { useMemo, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react'
import type { Exercise } from '@/lib/types'
import type { RoutinePayload } from '@/lib/routines'
import { targetLabel } from '@/lib/training'

type Item = RoutinePayload['days'][number]['exercises'][number]

export interface EditorProps {
  initial: RoutinePayload
  library: Exercise[]
  /** El monitor ve todo; el socio, una versión simplificada. */
  mode: 'trainer' | 'member'
  onSave: (payload: RoutinePayload, opts: { newVersion: boolean }) => Promise<{ ok: boolean; error?: string }>
  canVersion?: boolean
}

const uid = () => crypto.randomUUID()
const numOrNull = (v: string) => (v === '' ? null : Number(v))

export function RoutineEditor({ initial, library, mode, onSave, canVersion }: EditorProps) {
  const t = useTranslations('editor')
  const locale = useLocale()
  const [data, setData] = useState<RoutinePayload>(initial)
  const [dayIdx, setDayIdx] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('')
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const byId = useMemo(() => new Map(library.map((e) => [e.id, e])), [library])
  const nameOf = (e: Exercise) => (locale === 'es' ? e.name_es : e.name_ca)
  const muscles = useMemo(() => [...new Set(library.map((e) => e.primary_muscle))].sort(), [library])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return library
      .filter((e) => (!muscle || e.primary_muscle === muscle) && (!q || nameOf(e).toLowerCase().includes(q) || e.equipment.toLowerCase().includes(q)))
      .slice(0, 60)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library, query, muscle, locale])

  const day = data.days[dayIdx]
  const patch = (fn: (d: RoutinePayload) => void) => setData((p) => { const n = structuredClone(p); fn(n); return n })
  const patchItem = (id: string, p: Partial<Item>) => patch((d) => { const it = d.days[dayIdx].exercises.find((x) => x.id === id); if (it) Object.assign(it, p) })

  function addExercise(e: Exercise) {
    const timed = e.is_timed
    const item: Item = {
      id: uid(), exercise_id: e.id, sets: timed ? 2 : 3,
      reps_min: timed ? null : 8, reps_max: timed ? null : 12, duration_sec: timed ? 30 : null,
      target_weight: null, rest_sec: 60, rpe: null, set_type: 'normal', superset_group: null, notes: null,
    }
    patch((d) => d.days[dayIdx].exercises.push(item))
    setOpen(item.id)
  }

  function onDragEnd(ev: DragEndEvent) {
    const { active, over } = ev
    if (!over || active.id === over.id) return
    patch((d) => {
      const list = d.days[dayIdx].exercises
      d.days[dayIdx].exercises = arrayMove(list, list.findIndex((x) => x.id === active.id), list.findIndex((x) => x.id === over.id))
    })
  }
  const move = (i: number, dir: -1 | 1) => patch((d) => { d.days[dayIdx].exercises = arrayMove(d.days[dayIdx].exercises, i, i + dir) })

  function addDay() {
    const letter = String.fromCharCode(65 + data.days.length)
    patch((d) => d.days.push({ id: uid(), name: `${t('day')} ${letter}`, exercises: [] }))
    setDayIdx(data.days.length)
  }
  function removeDay() {
    if (data.days.length < 2) return
    patch((d) => d.days.splice(dayIdx, 1))
    setDayIdx(Math.max(0, dayIdx - 1))
  }
  function duplicateDay() {
    if (data.days.length >= 7) return
    patch((d) => {
      const src = d.days[dayIdx]
      d.days.splice(dayIdx + 1, 0, { id: uid(), name: `${src.name} (2)`, exercises: src.exercises.map((e) => ({ ...e, id: uid() })) })
    })
    setDayIdx(dayIdx + 1)
  }

  function save(newVersion: boolean) {
    setMsg(null)
    start(async () => {
      const res = await onSave(data, { newVersion })
      setMsg({ ok: res.ok, text: res.ok ? t('saved') : (res.error ?? t('saveError')) })
    })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <section className="card grid gap-3 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="r-name" className="label">{t('name')}</label>
            <input id="r-name" className="input !text-lg !font-semibold" value={data.name} onChange={(e) => patch((d) => { d.name = e.target.value })} />
          </div>
          {mode === 'trainer' && (
            <>
              <div>
                <label htmlFor="r-goal" className="label">{t('goal')}</label>
                <input id="r-goal" className="input" value={data.goal ?? ''} onChange={(e) => patch((d) => { d.goal = e.target.value || null })} />
              </div>
              <div>
                <label htmlFor="r-weeks" className="label">{t('weeks')}</label>
                <input id="r-weeks" type="number" min={1} max={52} className="input" value={data.duration_weeks ?? ''} onChange={(e) => patch((d) => { d.duration_weeks = numOrNull(e.target.value) })} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="r-desc" className="label">{t('description')}</label>
                <textarea id="r-desc" rows={2} className="input" value={data.description ?? ''} onChange={(e) => patch((d) => { d.description = e.target.value || null })} />
              </div>
            </>
          )}
        </section>

        <section>
          <div role="tablist" aria-label={t('days')} className="flex flex-wrap items-center gap-2">
            {data.days.map((d, i) => (
              <button key={d.id} role="tab" aria-selected={i === dayIdx} onClick={() => setDayIdx(i)}
                className={`btn !min-h-11 ${i === dayIdx ? 'btn-primary' : 'btn-ghost'}`}>
                {d.name} <span className="chip !bg-white/20 !text-inherit">{d.exercises.length}</span>
              </button>
            ))}
            {data.days.length < 7 && <button className="btn btn-ghost !min-h-11" onClick={addDay}><Plus size={16} aria-hidden /> {t('addDay')}</button>}
          </div>

          <div className="card mt-3 p-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-40 flex-1">
                <label htmlFor="d-name" className="label">{t('dayName')}</label>
                <input id="d-name" className="input" value={day.name} onChange={(e) => patch((d) => { d.days[dayIdx].name = e.target.value })} />
              </div>
              <button className="btn btn-ghost" onClick={duplicateDay} disabled={data.days.length >= 7}>{t('duplicateDay')}</button>
              <button className="btn btn-danger" onClick={removeDay} disabled={data.days.length < 2}><Trash2 size={16} aria-hidden /> {t('removeDay')}</button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={day.exercises.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                <ul className="mt-4 space-y-2" aria-label={t('exercises')}>
                  {day.exercises.map((it, i) => (
                    <SortableRow
                      key={it.id} item={it} ex={byId.get(it.exercise_id)} name={byId.get(it.exercise_id) ? nameOf(byId.get(it.exercise_id)!) : '—'}
                      open={open === it.id} onToggle={() => setOpen(open === it.id ? null : it.id)}
                      onChange={(p) => patchItem(it.id, p)} mode={mode}
                      onUp={i > 0 ? () => move(i, -1) : undefined} onDown={i < day.exercises.length - 1 ? () => move(i, 1) : undefined}
                      onRemove={() => patch((d) => { d.days[dayIdx].exercises = d.days[dayIdx].exercises.filter((x) => x.id !== it.id) })}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            {day.exercises.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">{t('emptyDay')}</p>}
          </div>
        </section>

        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface/95 p-3 shadow-card backdrop-blur">
          <button className="btn btn-primary" onClick={() => save(false)} disabled={pending || !data.name.trim()}>
            {pending ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <Save size={18} aria-hidden />} {t('save')}
          </button>
          {canVersion && mode === 'trainer' && (
            <button className="btn btn-ghost" onClick={() => save(true)} disabled={pending}>{t('saveVersion')}</button>
          )}
          {msg && <p role="status" className={`text-sm font-semibold ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}
        </div>
      </div>

      <aside className="card h-fit p-4 lg:sticky lg:top-4" aria-label={t('library')}>
        <h2 className="font-display text-2xl font-bold">{t('library')}</h2>
        <div className="relative mt-2">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input className="input !pl-9" placeholder={t('searchExercise')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('searchExercise')} />
        </div>
        <select className="input mt-2" value={muscle} onChange={(e) => setMuscle(e.target.value)} aria-label={t('muscle')}>
          <option value="">{t('allMuscles')}</option>
          {muscles.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <ul className="mt-3 max-h-[28rem] space-y-1 overflow-y-auto pr-1">
          {filtered.map((e) => (
            <li key={e.id}>
              <button className="group flex min-h-12 w-full items-center gap-2 rounded-xl px-2 text-left hover:bg-surface-2" onClick={() => addExercise(e)} aria-label={`${t('add')} ${nameOf(e)}`}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text group-hover:bg-primary group-hover:text-primary-fg"><Plus size={16} aria-hidden /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{nameOf(e)}</span><span className="block truncate text-xs text-muted">{e.primary_muscle} · {e.equipment}</span></span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="p-4 text-center text-sm text-muted">{t('noResults')}</li>}
        </ul>
      </aside>
    </div>
  )
}

function SortableRow({
  item, ex, name, open, onToggle, onChange, onRemove, onUp, onDown, mode,
}: {
  item: Item; ex?: Exercise; name: string; open: boolean; onToggle: () => void; onChange: (p: Partial<Item>) => void
  onRemove: () => void; onUp?: () => void; onDown?: () => void; mode: 'trainer' | 'member'
}) {
  const t = useTranslations('editor')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const timed = item.duration_sec !== null
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`rounded-2xl border bg-surface ${isDragging ? 'z-10 border-primary shadow-card' : 'border-border'}`}>
      <div className="flex items-center gap-1 p-2">
        <button className="grid h-11 w-9 cursor-grab touch-none place-items-center text-muted active:cursor-grabbing" aria-label={t('drag')} {...attributes} {...listeners}><GripVertical size={18} aria-hidden /></button>
        <button className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left" onClick={onToggle} aria-expanded={open}>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{name}</span>
            <span className="flex flex-wrap gap-1 pt-0.5">
              <span className="chip">{item.sets} × {targetLabel(item)}</span>
              {item.target_weight ? <span className="chip">{item.target_weight} kg</span> : null}
              <span className="chip">{item.rest_sec}s</span>
              {item.set_type !== 'normal' && <span className="chip chip-primary">{t(`type.${item.set_type}`)}</span>}
            </span>
          </span>
          <ChevronDown size={18} className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        <div className="flex flex-col">
          <button className="grid h-6 w-8 place-items-center text-muted disabled:opacity-30" onClick={onUp} disabled={!onUp} aria-label={t('moveUp')}><ArrowUp size={14} aria-hidden /></button>
          <button className="grid h-6 w-8 place-items-center text-muted disabled:opacity-30" onClick={onDown} disabled={!onDown} aria-label={t('moveDown')}><ArrowDown size={14} aria-hidden /></button>
        </div>
      </div>
      {open && (
        <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-3">
          <Field label={t('sets')}><input type="number" min={1} max={20} className="input" value={item.sets} onChange={(e) => onChange({ sets: Math.max(1, Number(e.target.value) || 1) })} /></Field>
          <Field label={t('mode')}>
            <select className="input" value={timed ? 'time' : 'reps'} onChange={(e) => e.target.value === 'time' ? onChange({ duration_sec: 30, reps_min: null, reps_max: null }) : onChange({ duration_sec: null, reps_min: 8, reps_max: 12 })}>
              <option value="reps">{t('byReps')}</option>
              <option value="time">{t('byTime')}</option>
            </select>
          </Field>
          {timed ? (
            <Field label={t('durationSec')}><input type="number" min={5} className="input" value={item.duration_sec ?? ''} onChange={(e) => onChange({ duration_sec: numOrNull(e.target.value) })} /></Field>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Field label={t('repsMin')}><input type="number" min={1} className="input" value={item.reps_min ?? ''} onChange={(e) => onChange({ reps_min: numOrNull(e.target.value) })} /></Field>
              <Field label={t('repsMax')}><input type="number" min={1} className="input" value={item.reps_max ?? ''} onChange={(e) => onChange({ reps_max: numOrNull(e.target.value) })} /></Field>
            </div>
          )}
          <Field label={t('targetWeight')}><input type="number" min={0} step={0.5} className="input" value={item.target_weight ?? ''} onChange={(e) => onChange({ target_weight: numOrNull(e.target.value) })} placeholder="—" /></Field>
          <Field label={t('rest')}><input type="number" min={0} step={5} className="input" value={item.rest_sec} onChange={(e) => onChange({ rest_sec: Math.max(0, Number(e.target.value) || 0) })} /></Field>
          {mode === 'trainer' && (
            <>
              <Field label="RPE">
                <select className="input" value={item.rpe ?? ''} onChange={(e) => onChange({ rpe: numOrNull(e.target.value) })}>
                  <option value="">—</option>
                  {[6, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label={t('setType')}>
                <select className="input" value={item.set_type} onChange={(e) => onChange({ set_type: e.target.value as Item['set_type'], superset_group: e.target.value === 'superset' ? (item.superset_group ?? 1) : null })}>
                  {(['normal', 'warmup', 'dropset', 'superset'] as const).map((k) => <option key={k} value={k}>{t(`type.${k}`)}</option>)}
                </select>
              </Field>
              {item.set_type === 'superset' && (
                <Field label={t('supersetGroup')}><input type="number" min={1} max={20} className="input" value={item.superset_group ?? 1} onChange={(e) => onChange({ superset_group: Number(e.target.value) || 1 })} /></Field>
              )}
            </>
          )}
          <div className="sm:col-span-3">
            <Field label={t('notes')}><input className="input" value={item.notes ?? ''} onChange={(e) => onChange({ notes: e.target.value || null })} placeholder={ex?.tips_ca ?? ''} /></Field>
          </div>
          <div className="sm:col-span-3">
            <button className="btn btn-danger !min-h-11 text-sm" onClick={onRemove}><Trash2 size={16} aria-hidden /> {t('removeExercise')}</button>
          </div>
        </div>
      )}
    </li>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  )
}
