import type { Currency, PeriodOption } from '../api/types'
import { formatMoney } from '../lib/money'
import { useSeedDemo } from '../api/hooks'
import { useUi } from '../state/ui'
import {
  BookIcon, CalendarIcon, ChevronIcon, MoonIcon, SearchIcon, SlidersIcon, SparkIcon, SunIcon,
} from './GlassIcons'

/** The Glass style's floating top bar: the greeting, the period, search and
 * the four corner controls in one frosted pill that the board scrolls under.
 * It replaces the journal's masthead and toolbar row and drives the same UI
 * state, so a period chosen or a search typed here is the same one the
 * journal would show. Without data yet (first load) it shows the greeting and
 * the controls that need none. */
export default function GlassTopBar({
  months, current, totalRows, currency,
}: {
  months?: PeriodOption[]
  current?: string
  totalRows?: number
  currency?: Currency
}) {
  const {
    period, setPeriod, theme, toggleTheme, toggleStyle, botOpen, setBotOpen,
    setSettingsOpen, setPaletteOpen, search, setSearch,
  } = useUi()
  const seedDemo = useSeedDemo()

  const chosen = months?.find((m) => m.key === period)
  const face = period === 'all' ? 'All Time' : chosen?.label ?? 'Opening the ledger…'
  let sub = ''
  if (currency && period === 'all') sub = 'Every month on record'
  else if (currency && chosen) sub = `${formatMoney(chosen.outflow, currency)} out`
  // Dropped first when the bar is narrow; the outflow is the part that matters.
  const isNow = Boolean(chosen && chosen.key === current)

  return (
    // The wrapper is what sticks: it carries the scroll-edge blur that the
    // board fades into as it passes under the floating bar.
    <div className="g-topbar-wrap">
      <header className="g-topbar lg lg-chrome">
        <div className="g-hello">
          <span className="g-mark g-mark-bar" aria-hidden="true">LL</span>
          <div className="g-hello-text">
            <h1 className="g-greet">Hello, Ali Akbar</h1>
            <p className="g-product">Loot Ledger</p>
          </div>
        </div>

        <div className="g-controls">
          {/* The real control is the native select, laid invisibly over a face
              that can show the month and its outflow on two lines. */}
          <div className="g-period">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              aria-label="Period"
              disabled={!months || !currency}
            >
              {months && currency && months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} — {formatMoney(m.outflow, currency)} out
                  {m.key === current ? ' (this month)' : ''}
                </option>
              ))}
              <option value="all">All Time</option>
            </select>
            <span className="g-period-face" aria-hidden="true">
              <CalendarIcon />
              <span className="g-period-text">
                <b>{face}</b>
                {sub && <small>{sub}{isNow && <span className="g-now"> · this month</span>}</small>}
              </span>
              <ChevronIcon />
            </span>
          </div>

          <div className="g-search">
            <SearchIcon />
            <input
              type="search"
              placeholder="Search entries"
              aria-label="Search entries"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className="g-kbd"
              title="Command palette (Ctrl/Cmd+K)"
              aria-label="Command palette, Ctrl K"
              onClick={() => setPaletteOpen(true)}
            >
              Ctrl K
            </button>
          </div>

          {totalRows === 0 && (
            <button type="button" className="g-pill-btn" onClick={() => seedDemo.mutate()} disabled={seedDemo.isPending}>
              {seedDemo.isPending ? 'Loading…' : 'Load sample data'}
            </button>
          )}

          <div className="g-actions">
            <button
              type="button"
              className="g-icon-btn"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Switch to the dark theme' : 'Switch to the light theme'}
              title={theme === 'light' ? 'Dark theme' : 'Light theme'}
            >
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
            <button
              type="button"
              className="g-icon-btn"
              onClick={toggleStyle}
              aria-label="Switch to the Ledger Journal style"
              title="Ledger Journal style"
            >
              <BookIcon />
            </button>
            <button
              type="button"
              className={`g-icon-btn ${botOpen ? 'is-on' : ''}`}
              aria-pressed={botOpen}
              aria-label="Finance Bot"
              title="Finance Bot"
              onClick={() => setBotOpen(!botOpen)}
            >
              <SparkIcon />
            </button>
            <button
              type="button"
              className="g-icon-btn"
              aria-label="Settings"
              title="Settings"
              onClick={() => setSettingsOpen(true)}
            >
              <SlidersIcon />
            </button>
          </div>
        </div>
      </header>
    </div>
  )
}
