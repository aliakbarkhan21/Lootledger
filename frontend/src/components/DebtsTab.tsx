import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Currency, LedgerRow } from '../api/types'
import { useDeleteRow, useLedger, usePeople, useSettleDebt, useUpdateRow } from '../api/hooks'
import { formatDisplayDate, formatMoney } from '../lib/money'
import { useUi } from '../state/ui'

type Table = 'lent' | 'borrowed'

// What the debts table calls each stored kind (app.py's DEBT_KIND_LABELS).
const KIND_LABELS: Record<Table, Record<string, string>> = {
  lent: { cash: 'Cash', covered: 'Covered', owed: 'Owed' },
  borrowed: { cash: 'Cash', covered: 'Covered' },
}

const HOW_HELP =
  'Cash: money changed hands when this started. Covered: it did not, because someone paid for ' +
  'something on the other’s behalf. Owed: nothing was handed over at all — money earned and ' +
  'not yet paid. Only Cash moves cash on hand before settlement.'

function daysSince(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return 0
  const then = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((today.getTime() - then.getTime()) / 86_400_000)
}

function nameOf(row: LedgerRow, table: Table): string {
  return String((table === 'lent' ? row.person : row.lender) ?? '')
}

function RemoveConfirm({
  table, row, currency, onDone,
}: { table: Table; row: LedgerRow; currency: Currency; onDone: () => void }) {
  const deleteRow = useDeleteRow()
  // Removing a debt silently moves the headline figure, so the cash
  // consequence is quoted before the button — computed server-side by the
  // same function the model uses.
  const { data } = useQuery({
    queryKey: ['remove-effect', table, row.id, row.kind, row.paid_back, row.amount],
    queryFn: () => api.get<{ effect: number }>(`/debts/${table}/${row.id}/remove-effect`),
  })
  const effect = data?.effect ?? 0
  const wording = !data
    ? 'Working out what this does to your cash on hand…'
    : Math.abs(effect) < 0.005
      ? 'Your cash on hand will not change.'
      : `This will ${effect > 0 ? 'add' : 'subtract'} ${formatMoney(Math.abs(effect), currency)} ${effect > 0 ? 'to' : 'from'} your cash on hand.`

  return (
    <div className="confirm-row">
      <span>Delete the entry for {nameOf(row, table)}? {wording} This cannot be undone.</span>
      <div className="btns">
        <button
          className="danger"
          disabled={deleteRow.isPending}
          onClick={() => deleteRow.mutate({ ledger: table, id: row.id }, { onSuccess: onDone })}
        >
          Delete permanently
        </button>
        <button onClick={onDone}>Keep</button>
      </div>
    </div>
  )
}

function DebtTable({ table, currency }: { table: Table; currency: Currency }) {
  const { data: rows } = useLedger(table)
  const settle = useSettleDebt()
  const updateRow = useUpdateRow()
  const { setBotOpen, setBotDraft } = useUi()
  const [confirmId, setConfirmId] = useState<number | null>(null)

  const list = rows || []
  if (list.length === 0) return <p className="panel-empty">Nothing on the books.</p>

  const overdue = list
    .filter((r) => !r.paid_back && daysSince(r.date) > 30)
    .sort((a, b) => daysSince(b.date) - daysSince(a.date))
  const pending = list.find((r) => r.id === confirmId)

  function draftReminder(r: LedgerRow) {
    const verb = table === 'lent' ? 'owes you' : 'you owe them'
    setBotDraft(
      `Draft a short, polite reminder message to ${nameOf(r, table)} about the ` +
        `${formatMoney(r.amount, currency, 0)} that ${verb}, outstanding for ${daysSince(r.date)} days.`,
    )
    setBotOpen(true)
  }

  return (
    <>
      {overdue.length > 0 && (
        <div className="aging">
          <div className="aging-head">{overdue.length} unsettled over 30 days</div>
          {overdue.map((r) => (
            <div className="aging-row" key={r.id}>
              <span className="who">{nameOf(r, table)}</span>
              <span className="amt">{formatMoney(r.amount, currency, 0)}</span>
              <span className="days">{daysSince(r.date)}d</span>
              <button className="btn-link" onClick={() => draftReminder(r)}>Draft reminder</button>
            </div>
          ))}
        </div>
      )}
      {pending && (
        <RemoveConfirm table={table} row={pending} currency={currency} onDone={() => setConfirmId(null)} />
      )}
      <div className="grid-scroll">
        <table className="ledger grid">
          <thead>
            <tr>
              <th>Since</th>
              <th>Name</th>
              <th className="num">Amount</th>
              <th title={HOW_HELP}>How</th>
              <th className="num" title="Days since this debt was recorded">Days</th>
              <th>Settled</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={row.id} className={confirmId === row.id ? 'removing' : row.paid_back ? 'settled' : ''}>
                <td className="date">{formatDisplayDate(row.date)}</td>
                <td className="desc">{nameOf(row, table)}</td>
                <td className="amt">{formatMoney(row.amount, currency)}</td>
                <td>
                  <select
                    aria-label={`How the debt with ${nameOf(row, table)} started`}
                    value={KIND_LABELS[table][row.kind || 'cash'] ? row.kind || 'cash' : 'cash'}
                    onChange={(e) => updateRow.mutate({ ledger: table, id: row.id, fields: { kind: e.target.value } })}
                  >
                    {Object.entries(KIND_LABELS[table]).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </td>
                <td className="num-cell">{daysSince(row.date)}</td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Settled: ${nameOf(row, table)}`}
                    checked={!!row.paid_back}
                    onChange={(e) => settle.mutate({ table, id: row.id, settled: e.target.checked })}
                  />
                </td>
                <td className="row-actions">
                  <button className="btn-link" onClick={() => setConfirmId(row.id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function DebtsTab({ currency }: { currency: Currency }) {
  const { data: people } = usePeople()

  return (
    <div>
      {(people || []).length > 0 && (
        <>
          <div className="tab-subhead"><strong>By person</strong></div>
          <div className="people-grid">
            {(people || []).map((p) => {
              const square = Math.abs(p.net) < 0.005
              const tone = square ? 'square' : p.net > 0 ? 'in' : 'out'
              const verdict = square
                ? 'square'
                : p.net > 0
                  ? `owes you ${formatMoney(p.net, currency, 0)}`
                  : `you owe ${formatMoney(-p.net, currency, 0)}`
              const detail = [
                p.owed_to_you ? `out ${formatMoney(p.owed_to_you, currency, 0)}` : null,
                p.you_owe ? `in ${formatMoney(p.you_owe, currency, 0)}` : null,
                `${p.rows} open`,
                `oldest ${p.oldest_days}d`,
              ].filter(Boolean)
              return (
                <div className={`person-card ${tone}`} key={p.name}>
                  <div className="person-name">
                    {p.name}
                    {p.both_ways && <span className="person-both">both ways</span>}
                  </div>
                  <div className="person-net">{verdict}</div>
                  <div className="person-sub">{detail.join(' · ')}</div>
                </div>
              )
            })}
          </div>
          <p className="tab-caption">
            Open debts only — a settled one is a closed conversation, and counting it would make
            someone who always pays you back look like someone who never has.
          </p>
        </>
      )}

      <p className="tab-caption">
        Ticking Settled records the repayment as today's cash movement, so it lands in this month's
        figures. <strong>How</strong> says whether cash moved when the debt started — change it here if
        one was recorded the wrong way round.
      </p>

      <div className="tab-subhead"><strong>Owed to you</strong></div>
      <DebtTable table="lent" currency={currency} />

      <div className="tab-subhead" style={{ marginTop: 28 }}><strong>You owe</strong></div>
      <DebtTable table="borrowed" currency={currency} />
    </div>
  )
}
