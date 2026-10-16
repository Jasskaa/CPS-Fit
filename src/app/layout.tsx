import type { Metadata, Viewport } from 'next'
import { League_Spartan, Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { APP_NAME, APP_TAGLINE } from '@/lib/config'
import { ThemeScript } from '@/components/theme'
import { RegisterSW } from '@/components/register-sw'
import splash from '@/lib/splash.json'
import './globals.css'

const display = League_Spartan({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-spartan' })
const sans = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_TAGLINE.ca,
  applicationName: APP_NAME,
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'black-translucent', startupImage: splash },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#263cb9' },
    { media: '(prefers-color-scheme: dark)', color: '#06101d' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()
  return (
    <html lang={locale} className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <RegisterSW />
      </body>
    </html>
  )
}
