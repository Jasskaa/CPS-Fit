'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { LOCALES, LOCALE_COOKIE, type Locale } from '@/lib/config'
import { createClient } from '@/lib/supabase/server'

export async function setLocale(locale: Locale) {
  if (!LOCALES.includes(locale)) return
  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (data?.claims?.sub) await supabase.from('profiles').update({ locale }).eq('id', data.claims.sub)
  revalidatePath('/', 'layout')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
