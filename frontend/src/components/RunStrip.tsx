import type { Currency, RunStripMonth } from '../api/types'
import { formatMoney, formatMoneyCompact } from '../lib/money'

export default function RunStrip({ months, currency }: { months: RunStripMonth[]; currency: Currency }) {
  const peak = Math.max(...months.map((m) => m.outflow), 0.0001)
  return (
    <div className="panel">
      <p className="panel-note run-legend">Bar height is each month's spending; the figure under it is what the month closed at.</p>
      <div className="run-strip">
        {months.map((m) => (
          <div
            className={`run-col ${m.is_current ? 'current' : ''}`}
            key={m.key}
            title={`${m.short}: ${formatMoney(m.outflow, currency, 0)} out, closed at ${formatMoney(m.closing, currency, 0)}`}
          >
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
