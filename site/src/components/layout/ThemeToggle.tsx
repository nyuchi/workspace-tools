/**
 * ThemeToggle — the site's one React island, as on apps/nyuchi.
 * Tools-site theme convention (unchanged from the live site so existing
 * localStorage survives): key `nyuchi-theme`, attribute `data-theme`,
 * default dark.
 */
import { useCallback, useEffect, useState } from 'react'

const KEY = 'nyuchi-theme'

function currentTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    setTheme(currentTheme())
  }, [])

  const toggle = useCallback(() => {
    const next = currentTheme() === 'light' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* storage unavailable — the attribute still applies for this page */
    }
    setTheme(next)
  }, [])

  return (
    <button
      type="button"
      onClick={toggle}
      class="inline-flex items-center justify-center w-10 h-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
    >
      {theme === 'light' ? (
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"></path>
        </svg>
      ) : (
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"></path>
        </svg>
      )}
    </button>
  )
}
