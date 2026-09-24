import { useState } from 'react'
import { useAddEntry, useCategories } from '../api/hooks'
import { todayIso } from '../lib/money'

// No "Transport" here: a bare fare with no description was a second, thinner
// way to write an expense, and the Transportation platform already says it.
type Kind = 'expense' | 'income' | 'owed' | 'lent' | 'borrowed'
type How = 'cash' | 'covered'

const KIND_LABEL: Record<Kind, string> = {
  expense: 'Expense',
  income: 'Income',
  owed: 'Owed to me',
  lent: 'Lent out',
  borrowed: 'Borrowed',
}

const SUBMIT_LABEL: Record<Kind, string> = {
  expense: 'Add departure',
  income: 'Add arrival',
  owed: 'Record what you are owed',
  lent: 'Record receivable',
  borrowed: 'Record payable',
}

// Whether cash moved when a debt started decides whether cash on hand goes up,
// down or nowhere, so each option states its own consequence.
const DEBT_HOW: Record<'lent' | 'borrowed', Record<How, { label: string; effect: string }>> = {
  lent: {
    cash: { label: 'I gave them cash', effect: 'Leaves your cash now, comes back when they repay.' },
    covered: {
      label: 'I paid for something on their behalf',
      effect: 'Your cash does not move now — log the purchase itself as an expense. Marking it settled brings the money back in.',
    },
  },
  borrowed: {
    cash: { label: 'They gave me cash', effect: 'Adds to your cash now, leaves again when you repay.' },
    covered: {
      label: 'They paid for something on my behalf',
      effect: 'Your cash does not move now — nothing was handed to you. Marking it settled is what takes the money out.',
    },
  },
}

const WHO: Record<'owed' | 'lent' | 'borrowed', { label: string; placeholder: string }> = {
  owed: { label: 'Who owes you', placeholder: 'Employer — August salary' },
  lent: { label: 'Who took it', placeholder: 'Sara' },
  borrowed: { label: 'Who you owe', placeholder: 'Bhai' },
}

export default function EntryForm({ currencyCode }: { currencyCode: string }) {
  const { data: categories } = useCategories()
  const addEntry = useAddEntry()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind>('expense')
  const [date, setDate] = useState(todayIso())
  const [text, setText] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [how, setHow] = useState<How>('cash')
  const [warning, setWarning] = useState<string | null>(null)

  const cats = categories || []
  const platform = cats.includes(category) ? category : cats[0] ?? 'Other'

  // Everything resets after an entry, the date included: left alone, a
  // backdated date silently kept applying to every entry logged after it.
  function reset() {
    setDate(todayIso())
    setText('')
    setAmount('')
    setHow('cash')
    setWarning(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    const name = text.trim()
    if (!name || !(amt > 0)) {
      setWarning(
        kind === 'expense' ? 'Needs a description and an amount above zero.'
          : kind === 'income' ? 'Needs a source and an amount above zero.'
            : 'Needs a name and an amount above zero.',
      )
      return
    }
    let body: Record<string, unknown>
    if (kind === 'expense') body = { date, description: name, category: platform, amount: amt }
    else if (kind === 'income') body = { date, source: name, amount: amt }
    else if (kind === 'owed') body = { date, person: name, amount: amt }
    else body = { date, [kind === 'lent' ? 'person' : 'lender']: name, amount: amt, kind: how }

    addEntry.mutate(
      { kind, body },
      { onSuccess: reset, onError: (err) => setWarning(err instanceof Error ? err.message : 'Could not record that.') },
    )
  }

  const isDebt = kind === 'lent' || kind === 'borrowed'

  return (
    <div className="entry-form">
      <button className="entry-form-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? '− Close entry' : '+ Record a movement'}
      </button>
      {open && (
        <form onSubmit={submit} className="entry-form-body">
          <div className="entry-form-grid">
            <select aria-label="Movement" value={kind} onChange={(e) => { setKind(e.target.value as Kind); setWarning(null) }}>
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
            <input type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} required />

            {kind === 'expense' && (
              <>
                <input aria-label="Description" placeholder="Karahi with the boys" value={text} onChange={(e) => setText(e.target.value)} />
                <select aria-label="Platform" value={platform} onChange={(e) => setCategory(e.target.value)}>
                  {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </>
            )}
            {kind === 'income' && (
              <input aria-label="Source" placeholder="Monthly salary" value={text} onChange={(e) => setText(e.target.value)} />
            )}
            {(kind === 'owed' || isDebt) && (
              <input
                aria-label={WHO[kind as 'owed' | 'lent' | 'borrowed'].label}
                placeholder={WHO[kind as 'owed' | 'lent' | 'borrowed'].placeholder}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            )}

            <input
              type="number" step="0.01" min="0"
              aria-label={`Amount (${currencyCode})`}
              placeholder={`Amount (${currencyCode})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button type="submit" disabled={addEntry.isPending}>
              {addEntry.isPending ? 'Recording…' : SUBMIT_LABEL[kind]}
            </button>
          </div>

          {isDebt && (
            <fieldset className="entry-how">
              <legend>How it happened</legend>
              {(Object.keys(DEBT_HOW[kind]) as How[]).map((k) => (
                <label key={k} className={how === k ? 'picked' : ''}>
                  <input type="radio" name="how" value={k} checked={how === k} onChange={() => setHow(k)} />
                  <span>
                    <span className="how-label">{DEBT_HOW[kind][k].label}</span>
                    <span className="how-effect">{DEBT_HOW[kind][k].effect}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {kind === 'owed' && (
            <p className="entry-caption">
              Your cash on hand does not move — nothing has been paid yet. It counts towards what you are owed
              and towards net worth, and ticking Settled records the payment as that day's arrival.
            </p>
          )}
          {warning && <div className="notice warn">{warning}</div>}
        </form>
      )}
    </div>
  )
}
