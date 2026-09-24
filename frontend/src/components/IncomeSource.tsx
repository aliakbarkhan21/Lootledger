import type { IncomeTrend, SourceTotal, Currency } from '../api/types'
import { formatMoney } from '../lib/money'
import Donut from './Donut'
import Sparkline from './Sparkline'

export default function IncomeSource({
  bySource, trend, currency,
}: {
  bySource: SourceTotal[]
  trend: IncomeTrend
  currency: Currency
}) {
  const total = bySource.reduce((a, r) => a + r.amount, 0)
  if (bySource.length === 0) {
    return (
      <div className="panel">
        <div className="panel-head"><h3>Where It Came From</h3></div>
        <p className="panel-empty">No income logged for this period yet.</p>
      </div>
    )
  }
  return (
    <div className="panel">
      <div className="panel-head"><h3>Where It Came From</h3></div>
      <div className="platform-share">
        <Donut values={bySource.map((r) => r.amount)} tinted />
        <ul className="platform-list">
          {bySource.map((r) => {
            const share = total > 0 ? (r.amount / total) * 100 : 0
            const values = trend.series[r.source] || []
            const pct = trend.vs_avg[r.source]
            return (
              <li key={r.source}>
                <div className="platform-row">
                  <span>{r.source}</span>
                  <Sparkline values={values} color="var(--gold)" />
                  <span>{share.toFixed(0)}% · {formatMoney(r.amount, currency)}</span>
                </div>
                <div className="platform-row-note">
                  {pct === null || pct === undefined ? 'not enough history yet' : `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}% vs usual`}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
