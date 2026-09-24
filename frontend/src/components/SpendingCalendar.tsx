import { useMemo, useState } from 'react'
import type { CalendarData, Currency } from '../api/types'
import { formatMoney } from '../lib/money'

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function SpendingCalendar({
  calendar, periodKey, currency,
}: {
  calendar: CalendarData
  periodKey: string
  currency: Currency
}) {
  const [flipped, setFlipped] = useState<number | null>(null)
  const [year, month] = periodKey.split('-').map(Number)

  const peak = Math.max(...calendar.daily_outflow, 0.0001)
  const activeDays = calendar.today_day ?? calendar.days_in_month

  const weeks = useMemo(() => {
    const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7 // Monday = 0
    const cells: (number | null)[] = Array(firstDow).fill(null)
    for (let d = 1; d <= calendar.days_in_month; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    const rows: (number | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    return rows
  }, [year, month, calendar.days_in_month])

  const quietDays = calendar.daily_outflow.slice(0, activeDays).filter((v) => v === 0).length
  const heaviestIdx = calendar.daily_outflow.indexOf(Math.max(...calendar.daily_outflow))

  return (
    <div className="panel">
      <div className="panel-head"><h3>Spending Rhythm</h3></div>
      <div className="cal-dow">
        {DOW.map((d, i) => <span key={i}>{d}</span>)}
        <span className="cal-week-label" />
      </div>
      {weeks.map((week, wi) => {
        const weekTotal = week.reduce<number>((sum, d) => sum + (d ? calendar.daily_outflow[d - 1] || 0 : 0), 0)
        return (
          <div className="cal-week" key={wi}>
            {week.map((d, di) => {
              if (d === null) return <div className="cal-cell empty" key={di} />
              const value = calendar.daily_outflow[d - 1] || 0
              const intensity = value > 0 ? Math.min(0.45, Math.sqrt(value / peak) * 0.45) : 0
              const isFuture = calendar.today_day !== null && d > calendar.today_day
              const isFlipped = flipped === d
              const breakdown = calendar.category_by_day[String(d)] || []
              return (
                <div
                  className={`cal-cell ${isFuture ? 'future' : ''} ${isFlipped ? 'flipped' : ''}`}
                  key={di}
                  style={{ background: isFuture ? undefined : `color-mix(in srgb, var(--gold) ${(intensity * 100).toFixed(0)}%, var(--paper))` }}
                  onClick={() => !isFuture && value > 0 && setFlipped(isFlipped ? null : d)}
                >
                  {!isFlipped && <span className="cal-day-num">{d}</span>}
                  {isFlipped && (
                    <div className="cal-flip-back">
                      {breakdown.slice(0, 3).map(([cat, amt]) => (
                        <div key={cat}>{cat} {formatMoney(amt, currency, 0)}</div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            <div className="cal-week-total">{weekTotal > 0 ? formatMoney(weekTotal, currency, 0) : ''}</div>
          </div>
        )
      })}
      <p className="panel-note">
        {quietDays} quiet {quietDays === 1 ? 'day' : 'days'}
        {heaviestIdx >= 0 && calendar.daily_outflow[heaviestIdx] > 0 && ` · heaviest on the ${heaviestIdx + 1}${ordinal(heaviestIdx + 1)}`}
      </p>
    </div>
  )
}

function ordinal(n: number): string {
  if (n % 10 === 1 && n !== 11) return 'st'
  if (n % 10 === 2 && n !== 12) return 'nd'
  if (n % 10 === 3 && n !== 13) return 'rd'
  return 'th'
}
