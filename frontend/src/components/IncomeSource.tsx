import type { IncomeTrend, SourceTotal, Currency } from '../api/types'
import { formatMoney } from '../lib/money'
import Donut, { tint } from './Donut'
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
        <Donut values={bySource.map((r) => r.amount)} tinted label="Income by source" />
        <ul className="platform-list">
          {bySource.map((r, i) => {
            const share = total > 0 ? (r.amount / total) * 100 : 0
            const values = trend.series[r.source] || []
            const pct = trend.vs_avg[r.source]
            const hasHistory = pct !== null && pct !== undefined
            return (
              <li key={r.source}>
                <div className="platform-row">
                  <span className="swatch-label"><i className="swatch" style={{ background: tint(i, bySource.length) }} />{r.source}</span>
                  <span>{share.toFixed(0)}% · {formatMoney(r.amount, currency)}</span>
                </div>
                <div className="platform-row-note trend-note">
                  {hasHistory ? (
                    <>
                      <Sparkline values={values} width={72} height={14} color="var(--gold)" />
                      <span className={pct >= 0 ? 'up' : 'down'}>{pct >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}% vs usual</span>
                    </>
                  ) : 'not enough history yet'}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
