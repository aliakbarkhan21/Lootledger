import { useEffect, useMemo, useRef, useState } from 'react'
import type { Currency, PeriodOption } from '../api/types'
import { useCategories } from '../api/hooks'
import { formatMoneyCompact } from '../lib/money'
import { useUi } from '../state/ui'

interface Item {
  section: string
  label: string
  hint: string
  here?: boolean
  run: () => void
}

/** Ctrl/Cmd+K. Every month (not just the recent ones the picker leads
 * with), a platform filter that drives the toolbar's own search box rather
 * than a second filter with its own rules, and the three chrome actions. */
export default function CommandPalette({
  months, currency, periodLabel,
}: { months: PeriodOption[]; currency: Currency; periodLabel: string }) {
  const {
    paletteOpen, setPaletteOpen, period, setPeriod, setSearch, setSettingsOpen,
    botOpen, setBotOpen, theme, toggleTheme,
  } = useUi()
  const { data: categories } = useCategories()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo<Item[]>(() => {
    const filterSection = `Filter ${periodLabel}`
    return [
      ...[...months].sort((a, b) => (a.key < b.key ? 1 : -1)).map((m) => ({
        section: 'Months', label: m.label, hint: `${currency.symbol} ${formatMoneyCompact(m.outflow, currency)}`,
        here: m.key === period, run: () => setPeriod(m.key),
      })),
      { section: 'Months', label: 'All Time', hint: 'every month', here: period === 'all', run: () => setPeriod('all') },
      ...(categories || []).map((c) => ({
        section: filterSection, label: c, hint: 'filter the board', run: () => setSearch(c),
      })),
      { section: filterSection, label: 'Clear the filter', hint: 'show the whole month', run: () => setSearch('') },
      { section: 'Actions', label: 'Settings', hint: 'budgets, currency, backup', run: () => setSettingsOpen(true) },
      {
        section: 'Actions', label: botOpen ? 'Close the Finance Bot' : 'Open the Finance Bot',
        hint: 'ask, or log by sentence', run: () => setBotOpen(!botOpen),
      },
      {
        section: 'Actions', label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
        hint: '', run: toggleTheme,
      },
    ]
  }, [months, currency, period, categories, periodLabel, botOpen, theme, setPeriod, setSearch, setSettingsOpen, setBotOpen, toggleTheme])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => `${i.label} ${i.section} ${i.hint}`.toLowerCase().includes(q))
  }, [items, query])

  useEffect(() => {
    if (paletteOpen) {
      setQuery('')
      setActive(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [paletteOpen])

  useEffect(() => { setActive(0) }, [query])

  useEffect(() => {
    listRef.current?.querySelector('.pal-item.active')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!paletteOpen) return null

  function choose(item: Item | undefined) {
    if (!item) return
    setPaletteOpen(false)
    item.run()
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); setPaletteOpen(false) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(shown.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(shown[active]) }
  }

  let lastSection = ''
  return (
    <div className="modal-scrim palette-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) setPaletteOpen(false) }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={onKey}>
        <input
          ref={inputRef}
          className="pal-input"
          placeholder="Jump to a month, filter, or run an action…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          role="combobox"
          aria-expanded="true"
          aria-controls="pal-list"
          aria-activedescendant={shown[active] ? `pal-${active}` : undefined}
        />
        <div className="pal-list" id="pal-list" role="listbox" ref={listRef}>
          {shown.length === 0 && <div className="pal-empty">Nothing matches “{query}”.</div>}
          {shown.map((item, i) => {
            const heading = item.section !== lastSection ? item.section : null
            lastSection = item.section
            return (
              <div key={`${item.section}-${item.label}`}>
                {heading && <div className="pal-section">{heading}</div>}
                <div
                  id={`pal-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={`pal-item ${i === active ? 'active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => { e.preventDefault(); choose(item) }}
                >
                  <span className="pal-label">{item.label}{item.here && <span className="pal-here">here</span>}</span>
                  <span className="pal-hint">{item.hint}</span>
                </div>
              </div>
            )
          })}
        </div>
        <div className="pal-foot">↑↓ to move · Enter to choose · Esc to close</div>
      </div>
    </div>
  )
}
