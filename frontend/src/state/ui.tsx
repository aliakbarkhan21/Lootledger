import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface UiState {
  period: string
  setPeriod: (p: string) => void
  theme: Theme
  toggleTheme: () => void
  botOpen: boolean
  setBotOpen: (v: boolean) => void
  settingsOpen: boolean
  setSettingsOpen: (v: boolean) => void
  paletteOpen: boolean
  setPaletteOpen: (v: boolean) => void
  search: string
  setSearch: (v: string) => void
  /** Text handed to the Finance Bot composer by another panel (e.g. "Draft
   * reminder" on a debt card); the drawer consumes and clears it. */
  botDraft: string | null
  setBotDraft: (v: string | null) => void
}

const Ctx = createContext<UiState | null>(null)

function initialTheme(): Theme {
  const url = new URL(window.location.href)
  const fromQuery = url.searchParams.get('theme')
  if (fromQuery === 'light' || fromQuery === 'dark') return fromQuery
  try {
    const stored = window.localStorage.getItem('ll-theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* private mode etc. */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function initialPeriod(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState(initialPeriod)
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [botOpen, setBotOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [botDraft, setBotDraft] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      window.localStorage.setItem('ll-theme', theme)
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href)
    url.searchParams.set('theme', theme)
    window.history.replaceState({}, '', url)
  }, [theme])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), [])

  const value = useMemo<UiState>(
    () => ({
      period, setPeriod, theme, toggleTheme, botOpen, setBotOpen,
      settingsOpen, setSettingsOpen, paletteOpen, setPaletteOpen, search, setSearch,
      botDraft, setBotDraft,
    }),
    [period, theme, toggleTheme, botOpen, settingsOpen, paletteOpen, search, botDraft],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useUi() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useUi must be used within UiProvider')
  return ctx
}
