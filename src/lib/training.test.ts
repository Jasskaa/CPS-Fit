import { describe, expect, it } from 'vitest'
import {
  adherence, bestSet, detectPRs, estimate1RM, formatDuration, fromDisplayWeight,
  nextDayIndex, targetLabel, toDisplayWeight, volume, weeklyStreak,
} from './training'

describe('1RM y volumen', () => {
  it('estima el 1RM con Epley', () => {
    expect(estimate1RM(100, 5)).toBe(116.7)
    expect(estimate1RM(80, 1)).toBe(80)
    expect(estimate1RM(0, 5)).toBe(0)
  })
  it('suma volumen ignorando series no completadas', () => {
    expect(volume([{ weight: 50, reps: 10 }, { weight: 60, reps: 8, completed: false }, { weight: null, reps: 12 }])).toBe(500)
  })
  it('elige la mejor serie por 1RM estimado', () => {
    expect(bestSet([{ weight: 100, reps: 3 }, { weight: 80, reps: 12 }])).toMatchObject({ weight: 80, reps: 12 })
    expect(bestSet([{ weight: null, reps: 10 }])).toBeNull()
  })
})

describe('récords personales', () => {
  it('marca PR si supera los máximos previos', () => {
    expect(detectPRs([{ weight: 82.5, reps: 8 }], { maxWeight: 80, maxE1rm: 100 })).toEqual(['weight', 'e1rm'])
    expect(detectPRs([{ weight: 70, reps: 8 }], { maxWeight: 80, maxE1rm: 100 })).toEqual([])
  })
  it('la primera vez que se hace un ejercicio cuenta como récord', () => {
    expect(detectPRs([{ weight: 20, reps: 10 }], null)).toEqual(['weight', 'e1rm'])
  })
})

describe('unidades y formato', () => {
  it('convierte kg ↔ lb', () => {
    expect(toDisplayWeight(100, 'lb')).toBe(220.5)
    expect(fromDisplayWeight(220.5, 'lb')).toBeCloseTo(100.02, 1)
    expect(toDisplayWeight(42.5, 'kg')).toBe(42.5)
  })
  it('formatea duraciones', () => {
    expect(formatDuration(75)).toBe('1:15')
    expect(formatDuration(3725)).toBe('1:02:05')
  })
  it('describe el objetivo de una serie', () => {
    expect(targetLabel({ reps_min: 8, reps_max: 12, duration_sec: null })).toBe('8–12 reps')
    expect(targetLabel({ reps_min: 10, reps_max: 10, duration_sec: null })).toBe('10 reps')
    expect(targetLabel({ reps_min: null, reps_max: null, duration_sec: 45 })).toBe('45 s')
    expect(targetLabel({ reps_min: null, reps_max: null, duration_sec: 600 })).toBe('10 min')
  })
})

describe('constancia', () => {
  const now = new Date('2026-10-07T10:00:00') // miércoles
  it('cuenta semanas consecutivas', () => {
    const dates = ['2026-10-05T09:00:00', '2026-09-29T09:00:00', '2026-09-22T09:00:00']
    expect(weeklyStreak(dates, now)).toBe(3)
  })
  it('no rompe la racha si la semana en curso aún no tiene entreno', () => {
    expect(weeklyStreak(['2026-09-29T09:00:00', '2026-09-22T09:00:00'], now)).toBe(2)
  })
  it('se rompe con una semana en blanco', () => {
    expect(weeklyStreak(['2026-10-05T09:00:00', '2026-09-15T09:00:00'], now)).toBe(1)
    expect(weeklyStreak([], now)).toBe(0)
  })
  it('rota los días de la rutina', () => {
    expect(nextDayIndex(['a', 'b', 'c'], null)).toBe(0)
    expect(nextDayIndex(['a', 'b', 'c'], 'b')).toBe(2)
    expect(nextDayIndex(['a', 'b', 'c'], 'c')).toBe(0)
  })
  it('calcula la adherencia', () => {
    expect(adherence(4, 3, new Date('2026-09-23T00:00:00'), now)).toBe(67)
    expect(adherence(20, 3, new Date('2026-09-23T00:00:00'), now)).toBe(100)
  })
})
