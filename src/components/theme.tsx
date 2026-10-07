'use client'

import { Moon, Sun, Monitor } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

const KEY = 'cps-theme'
type Theme = 'light' | 'dark' | 'system'

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(KEY, theme)
  } catch {}
}

/** Evita el parpadeo: aplica el tema guardado antes de pintar. */
export function ThemeScript() {
  const code = `try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`
  return <script dangerouslySetInnerHTML={{ __html: code }} />
}

export function ThemeToggle({ onChange }: { onChange?: (t: Theme) => void }) {
  const t = useTranslations('theme')
  const [theme, setTheme] = useState<Theme>('system')
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Theme | null
      if (saved) setTheme(saved)
    } catch {}
  }, [])
  const options: { value: Theme; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: t('light') },
    { value: 'system', icon: Monitor, label: t('system') },
    { value: 'dark', icon: Moon, label: t('dark') },
  ]
  return (
    <div role="radiogroup" aria-label={t('label')} className="inline-flex rounded-xl border border-border bg-surface p-1">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => {
            setTheme(value)
            applyTheme(value)
            onChange?.(value)
          }}
          className={`grid h-10 w-11 place-items-center rounded-lg transition-colors ${
            theme === value ? 'bg-primary text-primary-fg' : 'text-muted hover:bg-surface-2'
          }`}
        >
          <Icon size={18} aria-hidden />
        </button>
      ))}
    </div>
  )
}
