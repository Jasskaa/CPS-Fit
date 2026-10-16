import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, type Locale } from '@/lib/config'

type Dict = Record<string, unknown>
const merge = (a: Dict, b: Dict): Dict => {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof a[k] === 'object' ? merge(a[k] as Dict, v as Dict) : v
  return out
}

export default getRequestConfig(async () => {
  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value as Locale | undefined
  const locale: Locale = value && LOCALES.includes(value) ? value : DEFAULT_LOCALE
  const base = (await import(`../messages/${locale}.json`)).default as Dict
  const club = (await import(`../messages/club.${locale}.json`)).default as Dict
  return { locale, messages: merge(base, club) }
})
