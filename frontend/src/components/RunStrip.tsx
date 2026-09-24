import type { Currency, RunStripMonth } from '../api/types'
import { formatMoneyCompact } from '../lib/money'

export default function RunStrip({ months, currency }: { months: RunStripMonth[]; currency: Currency }) {
  const peak = Math.max(...months.map((m) => m.outflow), 0.0001)
  return (
    <div className="panel">
      <div className="panel-head"><h3>Last 12 Months</h3></div>
      <div className="run-strip">
        {months.map((m) => (
          <div className={`run-col ${m.is_current ? 'current' : ''}`} key={m.key}>
            <div className="run-bar-track">
              <div className="run-bar" style={{ height: `${Math.max(4, (m.outflow / peak) * 100)}%` }} />
            </div>
            <div className="run-short">{m.short}</div>
            <div className="run-closing">{formatMoneyCompact(m.closing, currency)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
