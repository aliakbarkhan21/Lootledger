import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'
export type LdiTab = 'ledgers' | 'edit' | 'debts' | 'import'

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
  /** Whether the Ledgers, debts and import section is expanded. */
  ledgersOpen: boolean
  setLedgersOpen: (v: boolean) => void
  /** Which sheet of that section is showing — held here so the book's
   * Obligations tab can open the section straight onto Debts. */
  ldiTab: LdiTab
  setLdiTab: (v: LdiTab) => void
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

function initialLedgersOpen(): boolean {
  // Folded by default, the way the section always opened: it is reached for,
  // not read on every visit, and open it pushes the month down the page.
  try {
    return window.localStorage.getItem('ll-ledgers-open') === '1'
  } catch {
    return false
  }
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
  const [ledgersOpen, setLedgersOpen] = useState(initialLedgersOpen)
  const [ldiTab, setLdiTab] = useState<LdiTab>('ledgers')

  useEffect(() => {
    try {
      window.localStorage.setItem('ll-ledgers-open', ledgersOpen ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [ledgersOpen])

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
      botDraft, setBotDraft, ledgersOpen, setLedgersOpen, ldiTab, setLdiTab,
    }),
    [period, theme, toggleTheme, botOpen, settingsOpen, paletteOpen, search, botDraft, ledgersOpen, ldiTab],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useUi() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useUi must be used within UiProvider')
  return ctx
}
