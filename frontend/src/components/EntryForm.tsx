import { useState } from 'react'
import { useAddEntry, useCategories } from '../api/hooks'
import { todayIso } from '../lib/money'

type Kind = 'expense' | 'income' | 'owed' | 'lent' | 'borrowed'

const KIND_LABEL: Record<Kind, string> = {
  expense: 'Expense',
  income: 'Income',
  owed: 'Owed to me',
  lent: 'Lent out',
  borrowed: 'Borrowed',
}

export default function EntryForm({ currencyCode }: { currencyCode: string }) {
  const { data: categories } = useCategories()
  const addEntry = useAddEntry()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind>('expense')
  const [date, setDate] = useState(todayIso())
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Food')
  const [who, setWho] = useState('')
  const [amount, setAmount] = useState('')
  const [how, setHow] = useState<'cash' | 'covered'>('cash')

  function reset() {
    setDescription('')
    setWho('')
    setAmount('')
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return
    let body: Record<string, unknown>
    if (kind === 'expense') body = { date, description: description || 'Expense', category, amount: amt }
    else if (kind === 'income') body = { date, source: description || who || 'Income', amount: amt }
    else if (kind === 'owed') body = { date, person: who, amount: amt }
    else body = { date, [kind === 'lent' ? 'person' : 'lender']: who, amount: amt, kind: how }

    addEntry.mutate({ kind, body }, { onSuccess: reset })
  }

  return (
    <div className="entry-form">
      <button className="entry-form-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '− Close entry' : '+ Record a movement'}
      </button>
      {open && (
        <form onSubmit={submit} className="entry-form-grid">
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

          {kind === 'expense' && (
            <>
              <input
                placeholder="What was it?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {(categories || []).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </>
          )}
          {kind === 'income' && (
            <input
              placeholder="Source"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
          {(kind === 'owed' || kind === 'lent' || kind === 'borrowed') && (
            <input
              placeholder={kind === 'borrowed' ? 'Lender' : 'Person'}
              value={who}
              onChange={(e) => setWho(e.target.value)}
              required
            />
          )}
          {(kind === 'lent' || kind === 'borrowed') && (
            <select value={how} onChange={(e) => setHow(e.target.value as 'cash' | 'covered')}>
              <option value="cash">Cash changed hands</option>
              <option value="covered">Covered — no cash moved</option>
            </select>
          )}

          <input
            type="number"
            step="0.01"
            min="0"
            placeholder={`Amount (${currencyCode})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <button type="submit" disabled={addEntry.isPending}>
            {addEntry.isPending ? 'Recording…' : 'Record'}
          </button>
        </form>
      )}
    </div>
  )
}
