import type { Currency, Figures } from '../api/types'
import { formatMoney } from '../lib/money'

const STATUS_LABEL: Record<Figures['status'], string> = {
  'on-time': 'On track',
  delayed: 'Running warm',
  cancelled: 'Over budget',
  quiet: 'No service',
}

/** The four figures are one equation — brought forward + arrivals −
 * departures = carried forward — so arrivals and departures here are every
 * rupee in and out, settlements included, the same rows the table lists. */
export default function SummaryBand({ figures, currency }: { figures: Figures; currency: Currency }) {
  const money0 = (v: number) => formatMoney(v, currency, 0)
  const delta = figures.outflow_delta_pct
  const prev = figures.prev_label

  let outNote: React.ReactNode
  if (!figures.has_activity) outNote = 'nothing recorded yet'
  else if (delta === null) outNote = <><b>{money0(figures.outflow)}</b> of it spending</>
  else if (Math.abs(delta) < 1) outNote = `level with ${prev}`
  else outNote = (
    <>spending <span className={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? '+' : '−'}{Math.abs(delta).toFixed(0)}%</span> vs {prev}</>
  )

  const inNote = figures.settled_in > 0
    ? <><b>{money0(figures.inflow)}</b> earned + {money0(figures.settled_in)} settled</>
    : `${figures.arrivals_count} movement(s) inward`
  const broughtNote = prev ? `closing balance of ${prev}` : 'no earlier month on record'
  const handNote = figures.inflow > 0
    ? <><b>{figures.savings_rate.toFixed(0)}%</b> of income kept</>
    : 'nothing arrived this period'

  return (
    <>
      <div className="service-line">
        <span className={`status-lamp ${figures.status}`}>{STATUS_LABEL[figures.status]}</span>
        <span className="service-meta">
          {figures.arrivals_count} arrivals · {figures.departures_count} departures
          {' · '}{figures.burn_pct.toFixed(0)}% of available used
        </span>
      </div>
      <div className="summary">
        <div>
          <div className="k">Brought Forward</div>
          <div className="v">{formatMoney(figures.opening, currency)}</div>
          <div className="note">{broughtNote}</div>
        </div>
        <div>
          <div className="k">Arrivals</div>
          <div className="v credit">{formatMoney(figures.arrivals_total, currency)}</div>
          <div className="note">{inNote}</div>
        </div>
        <div>
          <div className="k">Departures</div>
          <div className="v debit">{formatMoney(figures.departures_total, currency)}</div>
          <div className="note">{outNote}</div>
        </div>
        <div>
          <div className="k">Carried Forward</div>
          <div className={`v ${figures.on_hand < 0 ? 'debit' : ''}`}>{formatMoney(figures.on_hand, currency)}</div>
          <div className="note">{handNote}</div>
        </div>
      </div>
    </>
  )
}
