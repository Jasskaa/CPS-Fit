import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, type Locale } from '@/lib/config'

export default getRequestConfig(async () => {
  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value as Locale | undefined
  const locale: Locale = value && LOCALES.includes(value) ? value : DEFAULT_LOCALE
  return { locale, messages: (await import(`../messages/${locale}.json`)).default }
})
