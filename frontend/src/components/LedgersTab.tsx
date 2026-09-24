import type { BoardRow, Currency } from '../api/types'
import { downloadText, toCsv } from '../lib/csv'
import { formatDisplayDate, formatMoney, toDisplay } from '../lib/money'

/** The period's departures and arrivals as two plain lists, each with a CSV
 * export. The amount column names its currency: a file that just says
 * "Amount" is ambiguous the moment the board is read in anything but rupees. */
function Side({
  title, rows, currency, periodKey, slug,
}: { title: string; rows: BoardRow[]; currency: Currency; periodKey: string; slug: string }) {
  function exportCsv() {
    const csv = toCsv(
      ['Date', 'Detail', 'Platform', `Amount (${currency.code})`],
      rows.map((r) => [formatDisplayDate(r.date), r.label, r.platform, toDisplay(r.amount, currency).toFixed(2)]),
    )
    downloadText(`loot_ledger_${slug}_${periodKey}.csv`, csv)
  }

  return (
    <div>
      <div className="tab-subhead">
        <strong>{title}</strong>
        {rows.length > 0 && <button className="btn-link" onClick={exportCsv}>Export {slug}</button>}
      </div>
      {rows.length === 0 ? (
        <p className="panel-empty">Nothing recorded for this period.</p>
      ) : (
        <div className="grid-scroll">
        <table className="ledger grid">
          <thead>
            <tr><th>Date</th><th>Detail</th><th>Platform</th><th className="num">Amount</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.kind}-${r.id}`}>
                <td className="date">{formatDisplayDate(r.date)}</td>
                <td className="desc">{r.label}</td>
                <td className="cat">{r.platform}</td>
                <td className="amt">{formatMoney(r.amount, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  )
}

export default function LedgersTab({
  arrivals, departures, currency, periodKey,
}: { arrivals: BoardRow[]; departures: BoardRow[]; currency: Currency; periodKey: string }) {
  return (
    <div className="ledgers-grid">
      <Side title="Departures" rows={departures} currency={currency} periodKey={periodKey} slug="departures" />
      <Side title="Arrivals" rows={arrivals} currency={currency} periodKey={periodKey} slug="arrivals" />
    </div>
  )
}
