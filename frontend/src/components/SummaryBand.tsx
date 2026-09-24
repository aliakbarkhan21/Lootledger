import type { Currency, Figures } from '../api/types'
import { formatMoney } from '../lib/money'

const STATUS_LABEL: Record<Figures['status'], string> = {
  'on-time': 'On track',
  delayed: 'Running warm',
  cancelled: 'Over budget',
  quiet: 'No service',
}

export default function SummaryBand({ figures, currency }: { figures: Figures; currency: Currency }) {
  const deltaNote =
    figures.outflow_delta_pct === null
      ? null
      : `${figures.outflow_delta_pct >= 0 ? '▲' : '▼'} ${Math.abs(figures.outflow_delta_pct).toFixed(1)}% vs last month`

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
        <span className={`status-lamp ${figures.status}`}>{STATUS_LABEL[figures.status]}</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
          Savings rate {figures.savings_rate.toFixed(1)}% · {figures.burn_pct.toFixed(0)}% of available used
        </span>
      </div>
      <div className="summary">
        <div>
          <div className="k">Brought Forward</div>
          <div className="v">{formatMoney(figures.opening, currency)}</div>
        </div>
        <div>
          <div className="k">Arrivals</div>
          <div className="v credit">{formatMoney(figures.inflow, currency)}</div>
        </div>
        <div>
          <div className="k">Departures</div>
          <div className="v debit">{formatMoney(figures.outflow, currency)}</div>
          {deltaNote && <div className="note">{deltaNote}</div>}
        </div>
        <div>
          <div className="k">Carried Forward</div>
          <div className="v">{formatMoney(figures.on_hand, currency)}</div>
          <div className="note">Net worth {formatMoney(figures.net_worth, currency)}</div>
        </div>
      </div>
    </>
  )
}
