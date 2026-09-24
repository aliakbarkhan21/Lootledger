import { useEffect, useRef, useState } from 'react'
import { useAddEntry, useBoard, useCategories } from '../api/hooks'
import { formatDisplayDate, formatMoney, todayIso } from '../lib/money'
import { useUi } from '../state/ui'
import DatePicker from './DatePicker'

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

const PARTICULARS: Record<Kind, { label: string; placeholder: string }> = {
  expense: { label: 'Particulars', placeholder: 'Karahi with the boys' },
  income: { label: 'Source', placeholder: 'Monthly salary' },
  owed: { label: 'Who owes you', placeholder: 'Employer — August salary' },
  lent: { label: 'Who took it', placeholder: 'Sara' },
  borrowed: { label: 'Who you owe', placeholder: 'Bhai' },
}

/** Which column of the ledger the entry will be written into, if any. */
function posting(kind: Kind, how: How): { side: 'debit' | 'credit' | 'none'; note: string } {
  if (kind === 'expense') return { side: 'debit', note: 'Debit — money out' }
  if (kind === 'income') return { side: 'credit', note: 'Credit — money in' }
  if (kind === 'owed') return { side: 'none', note: 'No cash moves until it is paid' }
  if (how === 'covered') return { side: 'none', note: 'No cash moves now' }
  return kind === 'lent'
    ? { side: 'debit', note: 'Debit — cash handed over' }
    : { side: 'credit', note: 'Credit — cash received' }
}

const STORE_KEY = 'll-entry-dock'

function initiallyOpen(): boolean {
  try {
    const saved = window.localStorage.getItem(STORE_KEY)
    if (saved === 'open') return true
    if (saved === 'closed') return false
  } catch {
    /* private mode etc. */
  }
  // Open by default; on a phone it would bury the page, so it starts folded.
  return !window.matchMedia?.('(max-width: 900px)').matches
}

/** The entry panel, docked to the left of the book and always on screen, so
 * a movement can be logged while the ledger and the figures stay in view. */
export default function EntryDock() {
  const { period } = useUi()
  const { data: board } = useBoard(period)
  const { data: categories } = useCategories()
  const addEntry = useAddEntry()
  const [open, setOpen] = useState(initiallyOpen)
  // Set by the first fold or unfold, so the tab's entrance plays after a fold
  // and not when the page loads with the dock already folded.
  const [moved, setMoved] = useState(false)
  const [kind, setKind] = useState<Kind>('expense')
  const [date, setDate] = useState(todayIso())
  const [text, setText] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [how, setHow] = useState<How>('cash')
  const [warning, setWarning] = useState<string | null>(null)
  const [entered, setEntered] = useState<string | null>(null)
  const firstField = useRef<HTMLInputElement>(null)
  const unfoldButton = useRef<HTMLButtonElement>(null)

  const currency = board?.currency
  const cats = categories || []
  const platform = cats.includes(category) ? category : cats[0] ?? 'Other'
  const post = posting(kind, how)
  const isDebt = kind === 'lent' || kind === 'borrowed'

  useEffect(() => {
    try { window.localStorage.setItem(STORE_KEY, open ? 'open' : 'closed') } catch { /* ignore */ }
  }, [open])

  useEffect(() => {
    if (!entered) return
    const t = window.setTimeout(() => setEntered(null), 3200)
    return () => window.clearTimeout(t)
  }, [entered])

  // Everything resets after an entry, the date included: left alone, a
  // backdated date silently kept applying to every entry logged after it.
  function reset() {
    setDate(todayIso())
    setText('')
    setAmount('')
    setHow('cash')
    setWarning(null)
    firstField.current?.focus()
  }

  // Folding moves focus to whichever control is left showing, so the keyboard
  // never ends up on something that has just been put away.
  function fold(next: boolean) {
    setMoved(true)
    setOpen(next)
    requestAnimationFrame(() => {
      if (next) firstField.current?.focus({ preventScroll: true })
      else unfoldButton.current?.focus({ preventScroll: true })
    })
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

    const summary = `${name} · ${currency ? `${currency.symbol} ${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : amt} · ${formatDisplayDate(date)}`
    addEntry.mutate(
      { kind, body },
      {
        onSuccess: () => { setEntered(summary); reset() },
        onError: (err) => setWarning(err instanceof Error ? err.message : 'Could not record that.'),
      },
    )
  }

  // Both states stay mounted so the fold can be animated (board.css): open, the
  // slip swings out from the edge of the book like a leaf on its hinge and the
  // desk makes room for it; folded, it swings shut and leaves a bookmark tab.
  return (
    <aside className={`entry-dock ${open ? 'is-open' : 'is-folded'} ${moved ? 'moved' : ''}`} aria-label="Record a movement">
      <button
        ref={unfoldButton}
        className="dock-unfold"
        onClick={() => fold(true)}
        aria-expanded="false"
        title="Open the entry panel"
        inert={open}
      >
        <span className="dock-unfold-plus" aria-hidden="true">+</span>
        <span className="dock-unfold-label">Record a movement</span>
      </button>

      <div className="dock-leaf" inert={!open}>
        <div className="dock-clip">
          <div className="dock-paper">
            <div className="dock-head">
              <h2>Record a movement</h2>
              <button className="icon-btn dock-fold" onClick={() => fold(false)} aria-expanded="true" title="Fold the entry panel away">
                ‹
              </button>
            </div>

            <form onSubmit={submit} className="dock-form" noValidate>
              <label className="dock-field">
                <span>Movement</span>
                <select value={kind} onChange={(e) => { setKind(e.target.value as Kind); setWarning(null) }}>
                  {(Object.keys(KIND_LABEL) as Kind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </select>
              </label>

              <div className="dock-field">
                <span aria-hidden="true">Date</span>
                <DatePicker value={date} onChange={(iso) => setDate(iso || todayIso())} label="Date" />
              </div>

              <label className="dock-field">
                <span>{PARTICULARS[kind].label}</span>
                <input
                  ref={firstField}
                  placeholder={PARTICULARS[kind].placeholder}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </label>

              {kind === 'expense' && (
                <label className="dock-field">
                  <span>Platform</span>
                  <select value={platform} onChange={(e) => setCategory(e.target.value)}>
                    {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              )}

              <label className="dock-field">
                <span>Amount{currency ? ` (${currency.code})` : ''}</span>
                <input
                  type="number" step="0.01" min="0" inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>

              {isDebt && (
                <fieldset className="dock-how">
                  <legend>How it happened</legend>
                  {(Object.keys(DEBT_HOW[kind]) as How[]).map((k) => (
                    <label key={k} className={how === k ? 'picked' : ''}>
                      <input type="radio" name="dock-how" value={k} checked={how === k} onChange={() => setHow(k)} />
                      <span>
                        <span className="how-label">{DEBT_HOW[kind][k].label}</span>
                        <span className="how-effect">{DEBT_HOW[kind][k].effect}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              {kind === 'owed' && (
                <p className="dock-caption">
                  Your cash on hand does not move — nothing has been paid yet. It counts towards what you are owed
                  and towards net worth, and ticking Settled records the payment as that day's arrival.
                </p>
              )}

              <div className={`dock-posting ${post.side}`}>
                <span className="dock-posting-k">Posts to</span>
                <span>{post.note}</span>
              </div>

              <button type="submit" className="dock-submit" disabled={addEntry.isPending}>
                {addEntry.isPending ? 'Recording…' : SUBMIT_LABEL[kind]}
              </button>

              {warning && <div className="notice warn" role="alert">{warning}</div>}
              {entered && (
                <div className="dock-entered" role="status">
                  <span className="dock-stamp">Entered</span>
                  <span>{entered}</span>
                </div>
              )}
            </form>

            {board && currency && (
              <p className="dock-foot">
                {board.period.label}: {formatMoney(board.figures.on_hand, currency, 0)} carried forward
              </p>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
