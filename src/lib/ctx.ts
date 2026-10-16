import 'server-only'
import { getLocale, getTranslations } from 'next-intl/server'
import { requireRole } from '@/lib/auth'
import { can, canWrite, STAFF_ROLES, type Module } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/** Contexto común de las páginas del panel: exige permiso de lectura en el módulo. */
export async function pageCtx(module: Module) {
  const session = await requireRole(STAFF_ROLES)
  if (!can(session.profile.role, module)) redirect('/admin')
  const [t, locale, supabase] = await Promise.all([getTranslations(), getLocale(), createClient()])
  return { ...session, t, locale, supabase, writable: canWrite(session.profile.role, module) }
}

/** Para server actions: exige permiso de escritura. */
export async function actionCtx(module: Module) {
  const session = await requireRole(STAFF_ROLES)
  if (!canWrite(session.profile.role, module)) throw new Error('forbidden')
  return { ...session, supabase: await createClient() }
}

export function pick(r: object, base: string, locale: string): string {
  const row = r as Record<string, unknown>
  return String(row[`${base}_${locale}`] ?? row[`${base}_ca`] ?? "")
}

export const num = (v: string | string[] | undefined, d = 1) => Math.max(1, Number(Array.isArray(v) ? v[0] : v) || d)
export const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
export const ilikeSafe = (s: string) => s.replace(/[%,()*\\]/g, ' ').trim()
