import type { Currency } from '../api/types'
import { formatMoney } from '../lib/money'

export default function Capacity({
  burnPct, usualDailyOutflow, isAllTime, currency,
}: {
  burnPct: number
  usualDailyOutflow: number | null
  isAllTime: boolean
  currency: Currency
}) {
  const pct = Math.min(100, burnPct)
  return (
    <div className="panel">
      <div className="panel-head"><h3>Capacity</h3></div>
      <div className="capacity-track">
        <div className="capacity-mark" style={{ left: '70%' }} />
        <div className="capacity-mark" style={{ left: '90%' }} />
        <div className={`capacity-fill ${burnPct >= 90 ? 'over' : burnPct >= 70 ? 'warm' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="panel-note">{burnPct.toFixed(0)}% of everything available has gone out this period.</p>
      {!isAllTime && usualDailyOutflow !== null && (
        <p className="panel-note">
          Your usual pace is {formatMoney(usualDailyOutflow, currency)}/day across completed months.
        </p>
      )}
      {!isAllTime && usualDailyOutflow === null && (
        <p className="panel-note">Not enough completed months yet for a baseline.</p>
      )}
    </div>
  )
}
