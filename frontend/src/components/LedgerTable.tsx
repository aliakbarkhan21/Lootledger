import { useMemo, useState } from 'react'
import type { BoardRow, Currency } from '../api/types'
import { formatDisplayDate, formatMoney } from '../lib/money'
import { useRemoveBoardRow } from '../api/hooks'

const UNSETTLE_KINDS = new Set(['lent_returned', 'borrowed_repaid'])

export default function LedgerTable({
  arrivals, departures, currency, search,
}: {
  arrivals: BoardRow[]
  departures: BoardRow[]
  currency: Currency
  search: string
}) {
  const [pending, setPending] = useState<{ kind: string; id: number; label: string } | null>(null)
  const remove = useRemoveBoardRow()

  const rows = useMemo(() => {
    const merged = [
      ...arrivals.map((r) => ({ ...r, direction: 'credit' as const })),
      ...departures.map((r) => ({ ...r, direction: 'debit' as const })),
    ]
    merged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    const q = search.trim().toLowerCase()
    if (!q) return merged
    return merged.filter(
      (r) => r.label.toLowerCase().includes(q) || r.platform.toLowerCase().includes(q),
    )
  }, [arrivals, departures, search])

  function confirmRemove() {
    if (!pending) return
    remove.mutate({ kind: pending.kind, id: pending.id }, { onSuccess: () => setPending(null) })
  }

  return (
    <>
      {search.trim() && (
        <p style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', marginTop: 4 }}>
          {rows.length} {rows.length === 1 ? 'entry' : 'entries'} matching "{search}"
        </p>
      )}
      {pending && (
        <div className="confirm-row">
          <span>
            {UNSETTLE_KINDS.has(pending.kind) ? 'Un-settle' : 'Remove'} "{pending.label}"?
          </span>
          <div className="btns">
            <button className="danger" onClick={confirmRemove} disabled={remove.isPending}>
              {UNSETTLE_KINDS.has(pending.kind) ? 'Un-settle' : 'Remove'}
            </button>
            <button onClick={() => setPending(null)}>Cancel</button>
          </div>
        </div>
      )}
      <table className="ledger">
        <thead>
          <tr>
            <th>Date</th>
            <th>Particulars</th>
            <th>Platform</th>
            <th className="num">Debit</th>
            <th className="num">Credit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={`${r.kind}-${r.id}`}
              className={pending?.id === r.id && pending.kind === r.kind ? 'removing' : ''}
              onClick={() => setPending({ kind: r.kind, id: r.id, label: r.label })}
            >
              <td className="date">{formatDisplayDate(r.date)}</td>
              <td className="desc">{r.label}</td>
              <td className="cat">{r.platform}</td>
              <td className="amt debit">{r.direction === 'debit' ? formatMoney(r.amount, currency) : ''}</td>
              <td className="amt credit">{r.direction === 'credit' ? formatMoney(r.amount, currency) : ''}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: '20px 0' }}>
                Nothing logged for this period yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  )
}
