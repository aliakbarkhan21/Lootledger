import { useState } from 'react'
import type { CategoryTotal, CategoryTrend, Currency } from '../api/types'
import { formatMoney } from '../lib/money'
import Donut from './Donut'
import Sparkline from './Sparkline'

export default function PlatformLoad({
  byCategory, trend, budgets, currency,
}: {
  byCategory: CategoryTotal[]
  trend: CategoryTrend
  budgets: Record<string, number>
  currency: Currency
}) {
  const [view, setView] = useState<'share' | 'trend'>('share')
  const total = byCategory.reduce((a, r) => a + r.amount, 0)

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Platform Load</h3>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={view === 'trend'}
            onChange={(e) => setView(e.target.checked ? 'trend' : 'share')}
          />
          <span className="toggle-track"><span className="toggle-thumb" /></span>
          <span className="toggle-label">{view === 'share' ? 'Share' : 'Trend'}</span>
        </label>
      </div>

      {byCategory.length === 0 && <p className="panel-empty">Nothing logged for this period yet.</p>}

      {byCategory.length > 0 && view === 'share' && (
        <div className="platform-share">
          <Donut values={byCategory.map((r) => r.amount)} />
          <ul className="platform-list">
            {byCategory.map((r) => {
              const share = total > 0 ? (r.amount / total) * 100 : 0
              const cap = budgets[r.category]
              const capPct = cap ? Math.min(100, (r.amount / cap) * 100) : null
              return (
                <li key={r.category}>
                  <div className="platform-row">
                    <span>{r.category}</span>
                    <span>{share.toFixed(0)}% · {formatMoney(r.amount, currency)}</span>
                  </div>
                  {capPct !== null && (
                    <div className="cap-track">
                      <div className={`cap-fill ${capPct >= 90 ? 'over' : capPct >= 70 ? 'warm' : ''}`} style={{ width: `${capPct}%` }} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {byCategory.length > 0 && view === 'trend' && (
        <ul className="platform-list">
          {Object.entries(trend.series).map(([cat, values]) => {
            const pct = trend.vs_avg[cat]
            return (
              <li key={cat}>
                <div className="platform-row">
                  <span>{cat}</span>
                  <Sparkline values={values} />
                  <span className={pct !== null && pct !== undefined ? (pct >= 0 ? 'up' : 'down') : ''}>
                    {pct === null || pct === undefined ? '—' : `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}%`}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
