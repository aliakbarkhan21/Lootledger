import { useId, useState } from 'react'
import type { CategoryTotal, CategoryTrend, Currency } from '../api/types'
import { formatMoney } from '../lib/money'
import Donut from './Donut'
import { platformColor } from '../lib/platforms'
import Sparkline from './Sparkline'
import { useUi } from '../state/ui'

type View = 'share' | 'trend'

export default function PlatformLoad({
  byCategory, trend, budgets, currency,
}: {
  byCategory: CategoryTotal[]
  trend: CategoryTrend
  budgets: Record<string, number>
  currency: Currency
}) {
  const { style } = useUi()
  // The Glass style draws this panel as a frosted card with a segmented
  // control, a gapped ring and a share bar under each row. The journal
  // markup below is the same as it has always been.
  const glass = style === 'glass'
  const [view, setView] = useState<View>('share')
  const [hot, setHot] = useState<number | null>(null)
  // The new view eases in only after someone switches: nothing moves on load.
  const [switched, setSwitched] = useState(false)
  const uid = useId()
  const total = byCategory.reduce((a, r) => a + r.amount, 0)
  const totalText = formatMoney(total, currency)
  const enter = glass && switched ? ' g-enter' : ''

  function choose(next: View) {
    setView(next)
    setSwitched(true)
  }

  return (
    <div className={glass ? 'panel g-load lg' : 'panel'}>
      <div className="panel-head">
        <h3>Platform Load</h3>
        {glass ? (
          <div className="g-seg" role="radiogroup" aria-label="Platform load view" data-view={view}>
            <span className="g-seg-thumb" aria-hidden="true" />
            {(['share', 'trend'] as const).map((v) => (
              <span key={v} className="g-seg-opt">
                <input
                  type="radio"
                  className="visually-hidden"
                  id={`${uid}-${v}`}
                  name={`${uid}-view`}
                  value={v}
                  checked={view === v}
                  onChange={() => choose(v)}
                />
                <label htmlFor={`${uid}-${v}`}>{v === 'share' ? 'Share' : 'Trend'}</label>
              </span>
            ))}
          </div>
        ) : (
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={view === 'trend'}
              onChange={(e) => setView(e.target.checked ? 'trend' : 'share')}
            />
            <span className="toggle-track"><span className="toggle-thumb" /></span>
            <span className="toggle-label">{view === 'share' ? 'Share' : 'Trend'}</span>
          </label>
        )}
      </div>

      {byCategory.length === 0 && <p className="panel-empty">Nothing logged for this period yet.</p>}

      {byCategory.length > 0 && view === 'share' && (
        <div key="share" className={`platform-share${enter}`}>
          <div className="platform-donut-col">
            <Donut
              values={byCategory.map((r) => r.amount)}
              colors={byCategory.map((r) => platformColor(r.category))}
              names={byCategory.map((r) => r.category)}
              hot={hot}
              onHot={setHot}
              label="Spending by platform"
              variant={glass ? 'glass' : 'journal'}
              size={glass ? 136 : undefined}
            />
            {/* The figure is sized to its own length so it always fits the donut's width. */}
            <div className="platform-total" style={{ '--chars': totalText.length } as React.CSSProperties}>
              <div className="k">Total spent</div>
              <div className="v">{totalText}</div>
            </div>
          </div>
          <ul className="platform-list">
            {byCategory.map((r, i) => {
              const share = total > 0 ? (r.amount / total) * 100 : 0
              const cap = budgets[r.category]
              const capPct = cap ? Math.min(100, (r.amount / cap) * 100) : null
              return (
                <li
                  key={r.category}
                  className={hot === i ? 'hot' : ''}
                  onMouseEnter={() => setHot(i)}
                  onMouseLeave={() => setHot(null)}
                >
                  <div className="platform-row">
                    <span className="swatch-label"><i className="swatch" style={{ background: platformColor(r.category) }} />{r.category}</span>
                    {glass ? (
                      <span className="g-figs">
                        <span className="g-pct">{share.toFixed(0)}%</span>
                        <span className="g-amt">{formatMoney(r.amount, currency)}</span>
                      </span>
                    ) : (
                      <span>{share.toFixed(0)}% · {formatMoney(r.amount, currency)}</span>
                    )}
                  </div>
                  {/* Its share of the period's spending, at its true length. */}
                  {glass && (
                    <div className="g-bar" aria-hidden="true">
                      <i style={{ width: `${share}%`, background: platformColor(r.category) }} />
                    </div>
                  )}
                  {capPct !== null && (
                    <>
                      <div className="cap-track" title={`Cap ${formatMoney(cap, currency, 0)} a month`}>
                        <div className={`cap-fill ${capPct >= 90 ? 'over' : capPct >= 70 ? 'warm' : ''}`} style={{ width: `${capPct}%` }} />
                      </div>
                      <div className="platform-row-note">
                        {formatMoney(r.amount, currency, 0)} of {formatMoney(cap, currency, 0)} cap
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {byCategory.length > 0 && view === 'trend' && (
        <ul key="trend" className={`platform-list${enter}`}>
          {Object.entries(trend.series).map(([cat, values]) => {
            const pct = trend.vs_avg[cat]
            return (
              <li key={cat}>
                <div className="platform-row trend-row">
                  <span className="swatch-label"><i className="swatch" style={{ background: platformColor(cat) }} />{cat}</span>
                  {glass ? (
                    <Sparkline values={values} color={platformColor(cat)} width={112} height={28} />
                  ) : (
                    <Sparkline values={values} color={platformColor(cat)} />
                  )}
                  <span className={pct !== null && pct !== undefined ? (pct >= 0 ? 'spend-up' : 'spend-down') : ''}>
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
