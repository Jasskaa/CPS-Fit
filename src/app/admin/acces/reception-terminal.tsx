'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Camera, CameraOff, ScanLine, Search } from 'lucide-react'
import { checkAccess, findForReception, type AccessResult } from './actions'

interface Zone { id: string; name: string; code: string }

function beep(ok: boolean) {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.frequency.value = ok ? 880 : 220; o.type = ok ? 'sine' : 'square'
    g.gain.setValueAtTime(0.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (ok ? 0.18 : 0.5))
    o.start(); o.stop(ctx.currentTime + (ok ? 0.2 : 0.55))
  } catch { /* audio no disponible */ }
}

export function ReceptionTerminal({ zones, defaultZone }: { zones: Zone[]; defaultZone: string }) {
  const t = useTranslations('club.access')
  const tp = useTranslations('club.people.reason')
  const [zone, setZone] = useState(defaultZone)
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [code, setCode] = useState('')
  const [result, setResult] = useState<AccessResult | null>(null)
  const [pending, start] = useTransition()
  const [cam, setCam] = useState(false)
  const [q, setQ] = useState('')
  const [found, setFound] = useState<{ id: string; name: string; age: number }[]>([])
  const input = useRef<HTMLInputElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const clear = useRef<ReturnType<typeof setTimeout>>(undefined)
  const busy = useRef(false)

  const run = useCallback((value: string) => {
    if (busy.current) return
    busy.current = true
    start(async () => {
      const r = await checkAccess(value, zone, direction)
      setResult(r); setCode('')
      beep(Boolean(r.ok && r.allowed))
      clearTimeout(clear.current)
      clear.current = setTimeout(() => { setResult(null); input.current?.focus() }, 5000)
      busy.current = false
    })
  }, [zone, direction])

  useEffect(() => { input.current?.focus() }, [])
  useEffect(() => {
    if (q.trim().length < 2) { setFound([]); return }
    const h = setTimeout(async () => setFound(await findForReception(q)), 200)
    return () => clearTimeout(h)
  }, [q])

  // Cámara con BarcodeDetector (Chrome/Edge/Android); en el resto queda el lector USB o la búsqueda manual.
  useEffect(() => {
    if (!cam) return
    let stream: MediaStream | undefined, stop = false
    const Detector = (window as unknown as { BarcodeDetector?: new (o: object) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (video.current) { video.current.srcObject = stream; await video.current.play() }
        const det = Detector ? new Detector({ formats: ['qr_code'] }) : null
        while (!stop && det && video.current) {
          const codes = await det.detect(video.current).catch(() => [])
          if (codes[0]?.rawValue) run(codes[0].rawValue)
          await new Promise((r) => setTimeout(r, 600))
        }
      } catch { setCam(false) }
    })()
    return () => { stop = true; stream?.getTracks().forEach((tr) => tr.stop()) }
  }, [cam, run])

  const ok = result?.ok && result.allowed
  const tone = !result ? 'border-border bg-surface' : ok ? 'border-success bg-success-soft' : 'border-danger bg-danger-soft'

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <div className={`card flex min-h-[26rem] flex-col items-center justify-center gap-3 border-2 p-8 text-center transition-colors ${tone}`} aria-live="assertive">
        {!result && <><ScanLine size={64} className="text-muted" aria-hidden /><p className="font-display text-3xl font-bold text-muted">{t('waiting')}</p></>}
        {result && !result.ok && <><p className="font-display text-5xl font-extrabold text-danger">✕</p><p className="font-display text-3xl font-bold">{t(`errors.${result.error ?? 'not_found'}`)}</p></>}
        {result?.ok && (
          <>
            <p className={`font-display text-7xl font-extrabold leading-none ${ok ? 'text-success' : 'text-danger'}`}>{ok ? '✓' : '✕'}</p>
            <p className="font-display text-5xl font-extrabold uppercase leading-none">{result.name}</p>
            <p className={`font-display text-3xl font-bold ${ok ? 'text-success' : 'text-danger'}`}>{ok ? t('allowed') : t('denied')}</p>
            <p className="text-lg">{tp(result.reason ?? 'ok')}</p>
            <p className="text-sm text-muted">{result.zone} · {result.direction === 'in' ? t('in') : t('out')} · {result.age}</p>
          </>
        )}
      </div>

      <div className="space-y-4">
        <div className="card space-y-3 p-4">
          <label className="block space-y-1"><span className="text-xs font-semibold uppercase tracking-wide text-muted">{t('zone')}</span>
            <select className="input" value={zone} onChange={(e) => setZone(e.target.value)}>{zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('direction')}>
            {(['in', 'out'] as const).map((d) => (
              <button key={d} type="button" role="radio" aria-checked={direction === d} onClick={() => setDirection(d)} className={`btn ${direction === d ? 'btn-primary' : 'btn-ghost'}`}>{d === 'in' ? t('in') : t('out')}</button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); run(code) }} className="flex gap-2">
            <input ref={input} value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('scanPh')} aria-label={t('scanPh')} className="input" autoComplete="off" />
            <button className="btn btn-primary" disabled={pending}>{t('check')}</button>
          </form>
          <button type="button" className="btn btn-ghost w-full" onClick={() => setCam((c) => !c)}>{cam ? <><CameraOff size={16} aria-hidden /> {t('stopCamera')}</> : <><Camera size={16} aria-hidden /> {t('camera')}</>}</button>
          {cam && <video ref={video} className="aspect-video w-full rounded-xl bg-black object-cover" muted playsInline />}
        </div>
        <div className="card space-y-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('manual')}</p>
          <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('manualPh')} aria-label={t('manual')} className="input !pl-9" /></div>
          <ul className="divide-y divide-border">
            {found.map((p) => (
              <li key={p.id}><button type="button" className="flex min-h-11 w-full items-center justify-between text-left text-sm hover:text-primary-text" onClick={() => { run(p.id); setQ(''); setFound([]) }}><span className="font-semibold">{p.name}</span><span className="text-muted tnum">{p.age}</span></button></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
