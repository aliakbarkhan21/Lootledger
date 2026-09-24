import type { Currency, PeriodOption } from '../api/types'
import { formatMoneyCompact } from '../lib/money'
import { useSeedDemo } from '../api/hooks'
import { useUi } from '../state/ui'

export default function Toolbar({
  months, current, totalRows, currency,
}: {
  months: PeriodOption[]
  current: string
  totalRows: number
  currency: Currency
}) {
  const { period, setPeriod, theme, toggleTheme, botOpen, setBotOpen, setSettingsOpen, search, setSearch } = useUi()
  const seedDemo = useSeedDemo()

  return (
    <div className="toolbar">
      <div className="period-picker">
        <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">
          {months.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label} — {currency.symbol} {formatMoneyCompact(m.outflow, currency)} out
              {m.key === current ? ' (this month)' : ''}
            </option>
          ))}
          <option value="all">All Time</option>
        </select>
      </div>
      <input
        type="search"
        placeholder="Search entries"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {totalRows === 0 && (
        <button className="btn-link" onClick={() => seedDemo.mutate()} disabled={seedDemo.isPending}>
          {seedDemo.isPending ? 'Loading…' : 'Load sample data'}
        </button>
      )}
      <button className="icon-btn" title="Toggle theme" onClick={toggleTheme}>
        {theme === 'light' ? '☾' : '☀'}
      </button>
      <button
        className={`icon-btn ${botOpen ? 'active' : ''}`}
        title="Finance Bot"
        onClick={() => setBotOpen(!botOpen)}
      >
        ✦
      </button>
      <button className="icon-btn" title="Settings" onClick={() => setSettingsOpen(true)}>
        ⚙
      </button>
    </div>
  )
}
