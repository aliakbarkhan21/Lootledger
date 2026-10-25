import { useState } from 'react'
import type { Currency, RecurringItem, RecurringStatus } from '../api/types'
import { useAddRecurring, useCategories, useDeleteRecurring, useRecurringLog, useSettings, useUpdateRecurring } from '../api/hooks'
import { formatMoney, toDisplay } from '../lib/money'

type Kind = 'expense' | 'income'

const STAMPS: Record<RecurringStatus, { text: string; hint: string }> = {
  logged: { text: 'Logged', hint: 'Logged this month' },
  not_logged: { text: 'Not logged', hint: 'Not logged this month' },
  upcoming: { text: 'Upcoming', hint: 'Upcoming: its day has not arrived this month' },
}

// Rent, subscriptions, salary: the same entry every month. A full-width panel
// under the two share/calendar columns; the book's Recurring tab scrolls here.
// The list sits on the left, the add/edit form on the right.
export default function RecurringPanel({ currency }: { currency: Currency }) {
  const { data: settings } = useSettings()
  const { data: categories } = useCategories()
  const add = useAddRecurring()
  const update = useUpdateRecurring()
  const del = useDeleteRecurring()
  const logNow = useRecurringLog()
  const [editing, setEditing] = useState<number | null>(null)
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<Kind>('expense')
  const [amount, setAmount] = useState('')
  const [day, setDay] = useState('1')
  const [category, setCategory] = useState('')
  const [warn, setWarn] = useState<string | null>(null)

  const cats = categories || []
  const cat = cats.includes(category) ? category : cats[0] ?? 'Other'
  const items = settings?.recurring ?? []
  const busy = add.isPending || update.isPending

  function reset() {
    setEditing(null); setLabel(''); setKind('expense'); setAmount(''); setDay('1'); setCategory(''); setWarn(null)
  }

  function startEdit(r: RecurringItem) {
    setEditing(r.id)
    setLabel(r.label)
    setKind(r.kind)
    setAmount(String(Math.round(toDisplay(r.amount, currency) * 100) / 100))
    setDay(String(r.day_of_month))
    setCategory(r.category ?? '')
    setWarn(null)
  }

  function submit() {
    const n = parseFloat(amount)
    const d = Math.min(28, Math.max(1, parseInt(day, 10) || 1))
    if (!label.trim() || !(n > 0)) { setWarn('Needs a label and an amount above zero.'); return }
    setWarn(null)
    const body = { label: label.trim(), kind, category: kind === 'expense' ? cat : null, amount: n, day_of_month: d }
    if (editing !== null) update.mutate({ id: editing, ...body }, { onSuccess: reset })
    else add.mutate(body, { onSuccess: reset })
  }

  return (
    <div className="panel recurring-panel" id="recurring">
      <div className="panel-head"><h3>Recurring</h3></div>
      <p className="panel-note recurring-note">
        The same entry every month. A due template shows as a banner above the board once its day arrives.
      </p>

      <div className="recurring-body">
        <div className="recurring-entries">
          {!settings ? (
            <p className="panel-empty">Loading…</p>
          ) : items.length === 0 ? (
            <p className="panel-empty">Nothing recurring yet. Add rent, a subscription or a salary.</p>
          ) : (
            <ul className="recurring-list">
              {items.map((r) => (
                <li key={r.id} className={editing === r.id ? 'is-editing' : undefined}>
                  <span className="recurring-when">
                    {r.status && (
                      <span className={`recurring-stamp ${r.status}`} role="img"
                            title={STAMPS[r.status].hint} aria-label={STAMPS[r.status].hint}>
                        {STAMPS[r.status].text}
                      </span>
                    )}
                    <span className="recurring-day">Day {r.day_of_month}</span>
                  </span>
                  <span className="recurring-label">
                    {r.label}
                    <small>{r.kind === 'income' ? 'Income' : r.category || 'Expense'}</small>
                  </span>
                  <span className={`recurring-amount ${r.kind}`}>{formatMoney(r.amount, currency, 0)}</span>
                  <span className="recurring-acts">
                    {r.status !== 'logged' && (
                      <button className="btn-link" title={`Log ${r.label} now`} disabled={logNow.isPending}
                              onClick={() => logNow.mutate(r.id)}>Log now</button>
                    )}
                    <button className="btn-link" title={`Edit ${r.label}`} onClick={() => startEdit(r)}>Edit</button>
                    <button className="btn-link" title={`Remove ${r.label}`} aria-label={`Remove ${r.label}`} onClick={() => del.mutate(r.id)}>✕</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="recurring-form">
          <div className="settings-form">
            <label>Label<input value={label} placeholder="Rent" onChange={(e) => setLabel(e.target.value)} /></label>
            <label>
              Kind
              <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>
            <label>Amount ({currency.code})<input type="number" min={0} step={500} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label>Day of month<input type="number" min={1} max={28} value={day} onChange={(e) => setDay(e.target.value)} /></label>
            {kind === 'expense' && (
              <label className="wide">
                Category
                <select value={cat} onChange={(e) => setCategory(e.target.value)}>
                  {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            )}
          </div>
          {warn && <div className="notice warn">{warn}</div>}
          <div className="recurring-actions">
            <button className="btn-link wide" onClick={submit} disabled={busy}>
              {editing !== null ? 'Save changes' : 'Add recurring'}
            </button>
            {editing !== null && <button className="btn-link wide" onClick={reset}>Cancel</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
