import { useMemo, useState } from 'react'
import type { BoardRow, Currency } from '../api/types'
import { formatDisplayDate, formatMoney } from '../lib/money'
import { useRemoveBoardRow } from '../api/hooks'
import { platformColor } from '../lib/platforms'

// A repayment row is not a record of its own — it is the settled half of an
// existing debt — so "removing" it un-settles the debt instead of deleting it.
const UNSETTLE_KINDS = new Set(['lent_returned', 'borrowed_repaid'])

type Row = BoardRow & { direction: 'credit' | 'debit' }

export default function LedgerTable({
  arrivals, departures, currency, search, periodLabel,
}: {
  arrivals: BoardRow[]
  departures: BoardRow[]
  currency: Currency
  search: string
  periodLabel: string
}) {
  const [pending, setPending] = useState<Row | null>(null)
  const remove = useRemoveBoardRow()
  const query = search.trim()

  const rows = useMemo(() => {
    const merged: Row[] = [
      ...arrivals.map((r) => ({ ...r, direction: 'credit' as const })),
      ...departures.map((r) => ({ ...r, direction: 'debit' as const })),
    ]
    merged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    const q = query.toLowerCase()
    if (!q) return merged
    return merged.filter((r) => r.label.toLowerCase().includes(q) || r.platform.toLowerCase().includes(q))
  }, [arrivals, departures, query])

  const debitTotal = rows.filter((r) => r.direction === 'debit').reduce((s, r) => s + r.amount, 0)
  const creditTotal = rows.filter((r) => r.direction === 'credit').reduce((s, r) => s + r.amount, 0)
  const undo = pending ? UNSETTLE_KINDS.has(pending.kind) : false

  function confirmRemove() {
    if (!pending) return
    remove.mutate({ kind: pending.kind, id: pending.id }, { onSuccess: () => setPending(null) })
  }

  function select(r: Row) {
    setPending(pending && pending.id === r.id && pending.kind === r.kind ? null : r)
  }

  return (
    <>
      {query && (
        <p className="search-note">
          {rows.length
            ? <>{rows.length} {rows.length === 1 ? 'entry' : 'entries'} matching “{query}” — {formatMoney(debitTotal + creditTotal, currency, 0)} in total. Clear the box to see the whole month.</>
            : <>Nothing in {periodLabel} matches “{query}”. The month is not empty — the search is.</>}
        </p>
      )}
      {pending && (
        <div className="confirm-row" role="alertdialog" aria-label={undo ? 'Un-settle repayment' : 'Remove entry'}>
          <span>
            <strong>{undo ? 'Mark this repayment as not settled?' : 'Remove this entry for good?'}</strong>{' '}
            {pending.label} — {formatMoney(pending.amount, currency)} on {formatDisplayDate(pending.date)}
            {undo ? '. The debt itself is kept; only the repayment is undone.' : '. This cannot be undone.'}
          </span>
          <div className="btns">
            <button className="danger" onClick={confirmRemove} disabled={remove.isPending}>
              {undo ? 'Un-settle' : 'Remove'}
            </button>
            <button onClick={() => setPending(null)}>Cancel</button>
          </div>
        </div>
      )}
      <div className="table-wrap">
      <table className="ledger">
        <thead>
          <tr>
            <th>Date</th>
            <th>Particulars</th>
            <th>Platform</th>
            <th className="num">Debit</th>
            <th className="num">Credit</th>
            <th className="num amt-one">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={`${r.kind}-${r.id}`}
              className={pending?.id === r.id && pending.kind === r.kind ? 'removing' : ''}
              onClick={() => select(r)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(r) } }}
              tabIndex={0}
              title={UNSETTLE_KINDS.has(r.kind) ? 'Click to un-settle this repayment' : 'Click to remove this entry'}
            >
              <td className="date">{formatDisplayDate(r.date)}</td>
              <td className="desc">{r.label}</td>
              <td className="cat"><i className="swatch" style={{ background: platformColor(r.platform) }} />{r.platform}</td>
              <td className="amt debit">{r.direction === 'debit' ? formatMoney(r.amount, currency) : ''}</td>
              <td className="amt credit">{r.direction === 'credit' ? formatMoney(r.amount, currency) : ''}</td>
              <td className={`amt amt-one ${r.direction}`}>{r.direction === 'debit' ? '−' : '+'}{formatMoney(r.amount, currency)}</td>
            </tr>
          ))}
          {rows.length === 0 && !query && (
            <tr className="empty">
              <td colSpan={6}>
                <div className="ledger-empty">
                  <strong>Nothing arrived or departed yet.</strong>
                  <span>Record a movement above, or tell the bot what happened in plain words.</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={2}>{query ? 'Matching total' : 'Totals'}</td>
              <td className="cat" />
              <td className="amt debit">{formatMoney(debitTotal, currency)}</td>
              <td className="amt credit">{formatMoney(creditTotal, currency)}</td>
              <td className="amt amt-one">{formatMoney(creditTotal - debitTotal, currency)} net</td>
            </tr>
          </tfoot>
        )}
      </table>
      </div>
    </>
  )
}
