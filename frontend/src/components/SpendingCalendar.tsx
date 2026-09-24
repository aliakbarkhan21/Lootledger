import { useEffect, useMemo, useRef, useState } from 'react'
import type { CalendarData, Currency } from '../api/types'
import { formatMoney } from '../lib/money'
import { platformColor } from '../lib/platforms'

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DOW_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December']
// Matches the two animation stages in board.css (card travels, then turns).
const CLOSE_MS = 560

type Phase = 'open' | 'closing'

/** The month as a grid of days, each tinted by what left that day.
 *
 * Clicking a day lifts that one square off the grid: it grows to cover the
 * weeks and turns over onto the day's breakdown. The card is absolutely
 * positioned inside its own square cell and sized in day-units, so it never
 * takes part in layout — the grid, the panel and the page stay exactly where
 * they were, and "Back to the month" runs the same motion in reverse. */
export default function SpendingCalendar({
  calendar, periodKey, currency,
}: {
  calendar: CalendarData
  periodKey: string
  currency: Currency
}) {
  const [active, setActive] = useState<{ day: number; phase: Phase } | null>(null)
  const closeTimer = useRef<number | null>(null)
  const dayButtons = useRef<Record<number, HTMLButtonElement | null>>({})
  const backButton = useRef<HTMLButtonElement | null>(null)
  const [year, month] = periodKey.split('-').map(Number)

  const peak = Math.max(...calendar.daily_outflow, 0.0001)
  const elapsed = calendar.today_day ?? calendar.days_in_month
  const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7 // Monday = 0

  const weeks = useMemo(() => {
    const cells: (number | null)[] = Array(lead).fill(null)
    for (let d = 1; d <= calendar.days_in_month; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    const rows: (number | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    return rows
  }, [lead, calendar.days_in_month])

  // A different month on screen closes whatever day was out.
  useEffect(() => { setActive(null) }, [periodKey])
  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current) }, [])

  useEffect(() => {
    if (active?.phase !== 'open') return
    backButton.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // close is stable enough for this: it only reads refs and the setter.
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  function open(day: number) {
    if (active) return
    setActive({ day, phase: 'open' })
  }

  function close() {
    if (!active || active.phase === 'closing') return
    const day = active.day
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setActive({ day, phase: 'closing' })
    closeTimer.current = window.setTimeout(() => {
      setActive(null)
      dayButtons.current[day]?.focus({ preventScroll: true })
    }, reduced ? 0 : CLOSE_MS)
  }

  const quietDays = calendar.daily_outflow.slice(0, elapsed).filter((v) => v === 0).length
  const heaviestIdx = calendar.daily_outflow.indexOf(Math.max(...calendar.daily_outflow))

  function tint(value: number): string | undefined {
    if (value <= 0) return undefined
    // sqrt, not linear, so a month with one big day still shows its small ones.
    const pct = Math.min(45, Math.sqrt(value / peak) * 45)
    return `color-mix(in srgb, var(--gold) ${pct.toFixed(0)}%, var(--paper))`
  }

  function back(day: number) {
    const rows = calendar.category_by_day[String(day)] || []
    const spent = rows.reduce((s, [, a]) => s + a, 0)
    const weekday = DOW_FULL[(lead + day - 1) % 7]
    return (
      <div className="day-face day-back" role="dialog" aria-label={`${weekday} ${day} ${MONTHS[month - 1]}`}>
        <div className="day-head">
          <div className="day-when">
            <b>{weekday} {day} {MONTHS[month - 1]}</b>
            <span>{rows.length ? `${rows.length} platform${rows.length === 1 ? '' : 's'}` : 'a quiet day'}</span>
          </div>
          <div className={`day-total ${rows.length ? '' : 'none'}`}>{rows.length ? formatMoney(spent, currency, 0) : '—'}</div>
        </div>
        {rows.length ? (
          <div className="day-list">
            {rows.map(([cat, amt]) => {
              const share = spent ? (amt / spent) * 100 : 0
              return (
                <div className="day-row" key={cat}>
                  <span className="swatch-label"><i className="swatch" style={{ background: platformColor(cat) }} />{cat}</span>
                  <span className="day-bar"><i style={{ width: `${share.toFixed(1)}%`, background: platformColor(cat) }} /></span>
                  <span className="day-pct">{share.toFixed(0)}%</span>
                  <span className="day-amt">{formatMoney(amt, currency, 0)}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="day-none">Nothing left the account.</div>
        )}
        <button ref={backButton} className="day-close" onClick={close} tabIndex={active?.phase === 'open' ? 0 : -1}>
          ← Back to the month
        </button>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="panel-head"><h3>Spending Rhythm</h3></div>
      <div
        className={`cal ${active ? 'has-open' : ''}`}
        style={{ '--rows': weeks.length } as React.CSSProperties}
      >
        <div className="cal-dow">
          {DOW.map((d, i) => <span key={i}>{d}</span>)}
          <span className="cal-dow-sum">Week</span>
        </div>
        {weeks.map((week, wi) => {
          const weekTotal = week.reduce<number>((sum, d) => sum + (d ? calendar.daily_outflow[d - 1] || 0 : 0), 0)
          return (
            <div className="cal-week" key={wi}>
              {week.map((d, di) => {
                if (d === null) return <div className="cal-cell empty" key={di} />
                const value = calendar.daily_outflow[d - 1] || 0
                const weekday = DOW_FULL[(lead + d - 1) % 7]
                const isToday = calendar.today_day === d
                if (d > elapsed) {
                  // Nothing to turn over: a day that has not happened has no breakdown.
                  return (
                    <div className="cal-cell" key={di}>
                      <div className="cal-day future" title={`${weekday} ${d} — not yet`}>{d}</div>
                    </div>
                  )
                }
                const isActive = active?.day === d
                const bg = tint(value)
                return (
                  <div
                    className={`cal-cell live ${isActive ? `is-${active!.phase}` : ''}`}
                    key={di}
                    style={{ '--col': di, '--row': wi } as React.CSSProperties}
                  >
                    <button
                      ref={(el) => { dayButtons.current[d] = el }}
                      className={`cal-day live ${value > 0 ? '' : 'quiet'} ${isToday ? 'today' : ''}`}
                      style={{ background: bg }}
                      onClick={() => open(d)}
                      disabled={!!active && !isActive}
                      aria-expanded={isActive}
                      title={value > 0
                        ? `${weekday} ${d} — ${formatMoney(value, currency, 0)} · click for the breakdown`
                        : `${weekday} ${d} — nothing spent`}
                    >
                      {d}
                    </button>
                    {isActive && (
                      <div className="day-card">
                        <div className="day-flip">
                          <div className="day-face day-tile" style={{ background: bg }}>{d}</div>
                          {back(d)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              <div className="cal-week-total">{weekTotal > 0 ? formatMoney(weekTotal, currency, 0) : '—'}</div>
            </div>
          )
        })}
      </div>
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
