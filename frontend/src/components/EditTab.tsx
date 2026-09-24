import { useState } from 'react'
import type { Currency, LedgerRow } from '../api/types'
import { useCategories, useDeleteRow, useLedger, useUpdateRow } from '../api/hooks'
import { formatDisplayDate, formatMoney, toDisplay } from '../lib/money'

const LEDGER_LABELS = {
  expenses: 'Expenses',
  transport: 'Transport',
  income: 'Income',
  lent: 'Lent out',
  borrowed: 'Borrowed',
} as const
type Ledger = keyof typeof LEDGER_LABELS

// Mirrors db.EDITABLE — the server refuses anything else anyway.
const EDITABLE: Record<Ledger, string[]> = {
  expenses: ['date', 'description', 'category', 'amount'],
  transport: ['date', 'amount'],
  income: ['date', 'source', 'amount'],
  lent: ['date', 'person', 'amount', 'kind', 'paid_back', 'settled_date'],
  borrowed: ['date', 'lender', 'amount', 'kind', 'paid_back', 'settled_date'],
}

const KIND_OPTIONS: Record<'lent' | 'borrowed', string[]> = {
  lent: ['cash', 'covered', 'owed'],
  borrowed: ['cash', 'covered'],
}

function heading(field: string, currency: Currency): string {
  if (field === 'amount') return `Amount (${currency.code})`
  if (field === 'paid_back') return 'Settled'
  if (field === 'settled_date') return 'Settled on'
  if (field === 'kind') return 'How'
  return field[0].toUpperCase() + field.slice(1)
}

function raw(row: LedgerRow, field: string): unknown {
  return (row as unknown as Record<string, unknown>)[field]
}

export default function EditTab({ currency }: { currency: Currency }) {
  const [ledger, setLedger] = useState<Ledger>('expenses')
  const { data: rows, isLoading } = useLedger(ledger)
  const { data: categories } = useCategories()
  const updateRow = useUpdateRow()
  const deleteRow = useDeleteRow()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Record<string, string | boolean>>({})
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const fields = EDITABLE[ledger]

  function startEdit(row: LedgerRow) {
    setConfirmDeleteId(null)
    setNote(null)
    setEditingId(row.id)
    const d: Record<string, string | boolean> = {}
    for (const f of fields) {
      const v = raw(row, f)
      if (f === 'amount') d[f] = toDisplay(row.amount, currency).toFixed(2)
      else if (f === 'paid_back') d[f] = !!v
      else d[f] = v === null || v === undefined ? '' : String(v)
    }
    setDraft(d)
  }

  // Only what actually changed is sent. The amount is typed in the board's
  // display currency and the server converts it back to rupees, so an edit
  // made under a USD board is not banked as rupees.
  function saveEdit(row: LedgerRow) {
    const patch: Record<string, unknown> = {}
    for (const f of fields) {
      const next = draft[f]
      if (f === 'amount') {
        const n = parseFloat(String(next))
        if (!Number.isFinite(n) || n < 0) {
          setNote('Amount must be a number, zero or more.')
          return
        }
        if (Math.abs(n - toDisplay(row.amount, currency)) > 0.005) patch[f] = n
      } else if (f === 'paid_back') {
        if (!!next !== !!raw(row, f)) patch[f] = !!next
      } else {
        const before = raw(row, f)
        if (String(next) !== (before === null || before === undefined ? '' : String(before))) patch[f] = next
      }
    }
    if (Object.keys(patch).length === 0) {
      setEditingId(null)
      setNote('Nothing changed.')
      return
    }
    updateRow.mutate(
      { ledger, id: row.id, fields: patch },
      {
        onSuccess: () => { setEditingId(null); setNote('Row updated.') },
        onError: (e) => setNote(e instanceof Error ? e.message : 'Could not save.'),
      },
    )
  }

  function display(row: LedgerRow, f: string) {
    const v = raw(row, f)
    if (f === 'date' || f === 'settled_date') return v ? formatDisplayDate(String(v)) : ''
    if (f === 'amount') return formatMoney(row.amount, currency)
    if (f === 'paid_back') return v ? 'Yes' : 'No'
    return v === null || v === undefined ? '' : String(v)
  }

  function editor(f: string) {
    const value = draft[f]
    const set = (v: string | boolean) => setDraft({ ...draft, [f]: v })
    if (f === 'category') {
      const opts = categories || []
      return (
        <select value={String(value)} onChange={(e) => set(e.target.value)}>
          {!opts.includes(String(value)) && <option value={String(value)}>{String(value)}</option>}
          {opts.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )
    }
    if (f === 'kind') {
      return (
        <select value={String(value)} onChange={(e) => set(e.target.value)}>
          {KIND_OPTIONS[ledger as 'lent' | 'borrowed'].map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      )
    }
    if (f === 'paid_back') {
      return <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} />
    }
    return (
      <input
        type={f === 'date' || f === 'settled_date' ? 'date' : f === 'amount' ? 'number' : 'text'}
        step={f === 'amount' ? '0.01' : undefined}
        min={f === 'amount' ? 0 : undefined}
        value={String(value)}
        onChange={(e) => set(e.target.value)}
      />
    )
  }

  return (
    <div>
      <p className="tab-caption">
        Fix a typo, correct an amount, or drop a row entirely. Edits are written when you press Save.
      </p>
      <div className="tab-controls">
        <label>
          Ledger{' '}
          <select
            value={ledger}
            onChange={(e) => { setLedger(e.target.value as Ledger); setEditingId(null); setConfirmDeleteId(null); setNote(null) }}
          >
            {(Object.keys(LEDGER_LABELS) as Ledger[]).map((l) => <option key={l} value={l}>{LEDGER_LABELS[l]}</option>)}
          </select>
        </label>
        {note && <span className="tab-note">{note}</span>}
      </div>
      {isLoading && <p className="panel-empty">Loading…</p>}
      {!isLoading && (rows || []).length === 0 && (
        <p className="panel-empty">Nothing in {LEDGER_LABELS[ledger].toLowerCase()} yet.</p>
      )}
      {!isLoading && (rows || []).length > 0 && (
        <div className="grid-scroll">
          <table className="ledger grid">
            <thead>
              <tr>
                {fields.map((f) => <th key={f} className={f === 'amount' ? 'num' : ''}>{heading(f, currency)}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((row) => (
                <tr key={row.id} className={editingId === row.id ? 'editing' : confirmDeleteId === row.id ? 'removing' : ''}>
                  {fields.map((f) => (
                    <td key={f} className={f === 'amount' ? 'amt' : f === 'date' || f === 'settled_date' ? 'date' : ''}>
                      {editingId === row.id ? editor(f) : display(row, f)}
                    </td>
                  ))}
                  <td className="row-actions">
                    {editingId === row.id ? (
                      <>
                        <button className="btn-link" onClick={() => saveEdit(row)} disabled={updateRow.isPending}>Save</button>
                        <button className="btn-link" onClick={() => setEditingId(null)}>Cancel</button>
                      </>
                    ) : confirmDeleteId === row.id ? (
                      <>
                        <button
                          className="btn-link danger"
                          onClick={() => deleteRow.mutate(
                            { ledger, id: row.id },
                            { onSuccess: () => { setConfirmDeleteId(null); setNote('Row deleted.') } },
                          )}
                        >
                          Delete permanently
                        </button>
                        <button className="btn-link" onClick={() => setConfirmDeleteId(null)}>Keep</button>
                      </>
                    ) : (
                      <>
                        <button className="btn-link" onClick={() => startEdit(row)}>Edit</button>
                        <button className="btn-link" onClick={() => { setEditingId(null); setConfirmDeleteId(row.id) }}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
