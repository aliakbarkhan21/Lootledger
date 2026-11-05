import type { Currency, Figures } from '../api/types'
import { formatMoney } from '../lib/money'
import { useUi } from '../state/ui'

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
  const delta = figures.outflow_delta_pct
  const prev = figures.prev_label
  // Glass keeps a sum or a month name on one line ("Rs." | "8,000" and
  // "October" | "2026" never split). Only Glass gets the wrapping span: the
  // journal's text nodes stay exactly as they were, since even an unstyled
  // span re-shapes the run around it.
  const glass = useUi().style === 'glass'
  const keep = (s: string | null) => (glass ? <span className="keep">{s}</span> : s)
  // The journal's notes round sums to the rupee; Glass writes every sum in
  // the product's one money format, two decimals included.
  const money0 = (v: number) => formatMoney(v, currency, glass ? 2 : 0)
  // Glass sizes each figure to its own length so a seven-digit sum still
  // fits its pane; the journal's markup is untouched.
  const fit = (text: string) => (glass ? { style: { '--chars': text.length } as React.CSSProperties } : {})
  const opening = formatMoney(figures.opening, currency)
  const arrivals = formatMoney(figures.arrivals_total, currency)
  const departures = formatMoney(figures.departures_total, currency)
  const onHand = formatMoney(figures.on_hand, currency)

  let outNote: React.ReactNode
  if (!figures.has_activity) outNote = 'nothing recorded yet'
  else if (delta === null) outNote = <><b>{money0(figures.outflow)}</b> of it spending</>
  else if (Math.abs(delta) < 1) outNote = glass ? <>level with {keep(prev)}</> : `level with ${prev}`
  else outNote = (
    <>spending <span className={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? '+' : '−'}{Math.abs(delta).toFixed(0)}%</span> vs {keep(prev)}</>
  )

  const inNote = figures.settled_in > 0
    ? <><b>{money0(figures.inflow)}</b> earned + {keep(money0(figures.settled_in))} settled</>
    : `${figures.arrivals_count} movement(s) inward`
  const broughtNote = !prev
    ? 'no earlier month on record'
    : glass ? <>closing balance of {keep(prev)}</> : `closing balance of ${prev}`
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
      {/* The fig-* classes are hooks for the Glass style (the journal styles
          these cells by position and never reads them). */}
      <div className="summary">
        <div className="fig fig-brought lg">
          <div className="k">Brought Forward</div>
          <div className="v" {...fit(opening)}>{opening}</div>
          <div className="note">{broughtNote}</div>
        </div>
        <div className="fig fig-in lg">
          <div className="k">Arrivals</div>
          <div className="v credit" {...fit(arrivals)}>{arrivals}</div>
          <div className="note">{inNote}</div>
        </div>
        <div className="fig fig-out lg">
          <div className="k">Departures</div>
          <div className="v debit" {...fit(departures)}>{departures}</div>
          <div className="note">{outNote}</div>
        </div>
        <div className="fig fig-carried lg lg-hero">
          <div className="k">Carried Forward</div>
          <div className={`v ${figures.on_hand < 0 ? 'debit' : ''}`} {...fit(onHand)}>{onHand}</div>
          <div className="note">{handNote}</div>
        </div>
      </div>
    </>
  )
}
