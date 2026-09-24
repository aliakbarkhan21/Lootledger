import { useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../api/client'
import type { Currency, SettingsResponse } from '../api/types'
import {
  useAddRecurring, useAuthStatus, useBackups, useCategories, useClearDemo, useDeleteBudget,
  useDeleteRecurring, useEraseEverything, useLedger, useMergeCategory, useRefreshRates,
  useRestoreBackup, useSeedDemo, useSetBudget, useSetCurrency, useSetNetSameMonthDebts,
  useSetOpeningBalance, useSettings,
} from '../api/hooks'
import { formatMoney, toDisplay } from '../lib/money'
import { platformColor } from '../lib/platforms'
import { useUi } from '../state/ui'

function errText(e: unknown): string {
  return e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong.'
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-block">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function Caption({ children }: { children: ReactNode }) {
  return <p className="settings-caption">{children}</p>
}

// ---------------------------------------------------------------- budgets

function BudgetRow({ category, cap, currency }: { category: string; cap: number; currency: Currency }) {
  const setBudget = useSetBudget()
  const deleteBudget = useDeleteBudget()
  const shown = Math.round(toDisplay(cap, currency) * 100) / 100
  const [value, setValue] = useState(shown.toFixed(2))
  useEffect(() => setValue(shown.toFixed(2)), [shown])

  // Compared in DISPLAY units, not rupees: a cap round-tripped out through
  // the display rate and back does not land on the rupee it started from, so
  // comparing stored figures would rewrite every cap for no reason.
  function commit() {
    const n = parseFloat(value)
    if (!Number.isFinite(n)) { setValue(shown.toFixed(2)); return }
    if (n <= 0) deleteBudget.mutate(category)
    else if (Math.abs(n - shown) > 0.005) setBudget.mutate({ category, monthly_cap: n })
  }

  return (
    <div className="settings-row">
      <span className="settings-row-label swatch-label"><i className="swatch" style={{ background: platformColor(category) }} />{category}</span>
      <input
        type="number" min={0} step={500} value={value}
        aria-label={`${category} cap (${currency.code})`}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      />
      <button className="btn-link" title={`Remove the ${category} cap`} onClick={() => deleteBudget.mutate(category)}>✕</button>
    </div>
  )
}

function Budgets({ settings, categories }: { settings: SettingsResponse; categories: string[] }) {
  const currency = settings.currency
  const setBudget = useSetBudget()
  const uncapped = categories.filter((c) => !(c in settings.budgets))
  const [cat, setCat] = useState('')
  const [amount, setAmount] = useState('')
  const [warn, setWarn] = useState<string | null>(null)
  const picked = uncapped.includes(cat) ? cat : uncapped[0] ?? ''

  function add() {
    const n = parseFloat(amount)
    if (!(n > 0)) { setWarn('A cap needs an amount above zero.'); return }
    setWarn(null)
    setBudget.mutate({ category: picked, monthly_cap: n }, { onSuccess: () => setAmount('') })
  }

  return (
    <Block title="Budgets">
      <Caption>A monthly cap per category. Platform load shows spent-vs-cap once one is set.</Caption>
      {uncapped.length > 0 ? (
        <div className="settings-row">
          <select value={picked} onChange={(e) => setCat(e.target.value)} aria-label="Category">
            {uncapped.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="number" min={0} step={500} placeholder={`Cap (${currency.code})`}
            value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={`Monthly cap (${currency.code})`}
          />
          <button className="btn-link" onClick={add} disabled={setBudget.isPending}>Save</button>
        </div>
      ) : (
        <Caption>Every category has a cap.</Caption>
      )}
      {warn && <div className="notice warn">{warn}</div>}
      {Object.keys(settings.budgets).sort().map((c) => (
        <BudgetRow key={`${c}-${currency.code}`} category={c} cap={settings.budgets[c]} currency={currency} />
      ))}
    </Block>
  )
}

// ---------------------------------------------------------------- merge

function MergeCategory({ categories }: { categories: string[] }) {
  const { data: expenses } = useLedger('expenses')
  const merge = useMergeCategory()
  const used = Array.from(new Set((expenses || []).map((r) => r.category).filter(Boolean) as string[])).sort()
  const [from, setFrom] = useState('')
  const [into, setInto] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const src = used.includes(from) ? from : used[0] ?? ''
  const targets = categories.filter((c) => c !== src)
  const dst = targets.includes(into) ? into : targets[0] ?? ''
  const movable = (expenses || []).filter((r) => r.category === src).length

  return (
    <Block title="Merge a category">
      <Caption>
        Moves every expense from one category into another — for the near-duplicates imports bring in,
        a “Transport” beside the “Transportation” that already exists. The rows keep their dates and
        amounts; only the label moves.
      </Caption>
      {used.length === 0 ? (
        <Caption>No expenses to merge yet.</Caption>
      ) : (
        <>
          <div className="settings-row">
            <select value={src} onChange={(e) => { setFrom(e.target.value); setDone(null) }} aria-label="From">
              {used.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="settings-arrow">→</span>
            <select value={dst} onChange={(e) => setInto(e.target.value)} aria-label="Into">
              {targets.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              className="btn-link"
              disabled={!movable || merge.isPending}
              onClick={() => merge.mutate(
                { from_category: src, to_category: dst },
                { onSuccess: (r) => {
                  const moved = (r as { moved: number }).moved
                  setDone(`Moved ${moved} entr${moved === 1 ? 'y' : 'ies'} into ${dst}.`)
                } },
              )}
            >
              Merge
            </button>
          </div>
          <Caption>{movable} entr{movable === 1 ? 'y' : 'ies'} currently in {src}.</Caption>
          {done && <div className="notice ok">{done}</div>}
        </>
      )}
    </Block>
  )
}

// ---------------------------------------------------------------- recurring

function Recurring({ settings, categories }: { settings: SettingsResponse; categories: string[] }) {
  const currency = settings.currency
  const add = useAddRecurring()
  const del = useDeleteRecurring()
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [day, setDay] = useState('1')
  const [category, setCategory] = useState('')
  const [warn, setWarn] = useState<string | null>(null)
  const cat = categories.includes(category) ? category : categories[0] ?? 'Other'

  function submit() {
    const n = parseFloat(amount)
    const d = Math.min(28, Math.max(1, parseInt(day, 10) || 1))
    if (!label.trim() || !(n > 0)) { setWarn('Needs a label and an amount above zero.'); return }
    setWarn(null)
    add.mutate(
      { label: label.trim(), kind, category: kind === 'expense' ? cat : null, amount: n, day_of_month: d },
      { onSuccess: () => { setLabel(''); setAmount(''); setDay('1') } },
    )
  }

  return (
    <Block title="Recurring">
      <Caption>
        Rent, subscriptions, salary — the same entry every month. A due template shows as a banner
        above the board once its day arrives.
      </Caption>
      {settings.recurring.map((r) => (
        <div className="settings-row" key={r.id}>
          <span className="settings-row-label">
            {r.label} — {formatMoney(r.amount, currency, 0)} on day {r.day_of_month}{' '}
            ({r.kind === 'income' ? 'Income' : r.category || 'Expense'})
          </span>
          <button className="btn-link" title={`Remove ${r.label}`} onClick={() => del.mutate(r.id)}>✕</button>
        </div>
      ))}
      <div className="settings-form">
        <label>Label<input value={label} placeholder="Rent" onChange={(e) => setLabel(e.target.value)} /></label>
        <label>
          Kind
          <select value={kind} onChange={(e) => setKind(e.target.value as 'expense' | 'income')}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>
        <label>Amount ({currency.code})<input type="number" min={0} step={500} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label>Day of month<input type="number" min={1} max={28} value={day} onChange={(e) => setDay(e.target.value)} /></label>
        {kind === 'expense' && (
          <label>
            Category
            <select value={cat} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}
      </div>
      {warn && <div className="notice warn">{warn}</div>}
      <button className="btn-link wide" onClick={submit} disabled={add.isPending}>Add recurring</button>
    </Block>
  )
}

// ---------------------------------------------------------------- snapshots / reset

function Snapshots({ totalRows }: { totalRows: number }) {
  const { data: backups } = useBackups()
  const restore = useRestoreBackup()
  const [chosen, setChosen] = useState('')
  const [armed, setArmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const list = backups || []
  const picked = list.find((b) => b.name === chosen) ?? list[0]

  return (
    <Block title="Restore a snapshot">
      {list.length === 0 ? (
        <Caption>No snapshots yet. One is taken automatically before anything that erases records.</Caption>
      ) : (
        <>
          <Caption>
            {list.length} available. One is taken automatically before anything that erases records, and
            restoring backs up the current file first, so this is reversible too.
          </Caption>
          <select
            className="wide" value={picked?.name}
            onChange={(e) => { setChosen(e.target.value); setArmed(false) }} aria-label="Snapshot"
          >
            {list.map((b) => (
              <option key={b.name} value={b.name}>
                {new Date(b.taken * 1000).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {'  ·  '}{b.total} records{'  ·  '}{b.automatic ? 'auto' : 'manual'}
              </option>
            ))}
          </select>
          {picked && (
            <Caption>
              {Object.keys(picked.counts).map((k) => `${k}: ${picked.counts[k] ?? 0}`).join('  ·  ')}
            </Caption>
          )}
          {!armed ? (
            <button className="btn-link wide" disabled={!picked || picked.total === 0} onClick={() => setArmed(true)}>
              Restore this snapshot
            </button>
          ) : (
            <div className="confirm-row">
              <span>This replaces all {totalRows} current records with the {picked?.total} in this snapshot.</span>
              <div className="btns">
                <button
                  className="danger"
                  disabled={restore.isPending}
                  onClick={() => picked && restore.mutate(picked.path, {
                    onSuccess: () => setArmed(false),
                    onError: (e) => { setArmed(false); setError(`Could not restore that snapshot: ${errText(e)}`) },
                  })}
                >
                  Yes, restore
                </button>
                <button onClick={() => setArmed(false)}>Cancel</button>
              </div>
            </div>
          )}
          {error && <div className="notice warn">{error}</div>}
        </>
      )}
    </Block>
  )
}

function Session() {
  const { data: auth } = useAuthStatus()
  const qc = useQueryClient()
  if (!auth || auth.mode === 'open') return null
  return (
    <Block title="Session">
      <Caption>This board is password protected.</Caption>
      <button
        className="btn-link wide"
        onClick={async () => {
          await api.post('/auth/logout')
          qc.clear()
          await qc.invalidateQueries({ queryKey: ['auth-status'] })
        }}
      >
        Lock board
      </button>
    </Block>
  )
}

function Erase({ totalRows }: { totalRows: number }) {
  const erase = useEraseEverything()
  const [armed, setArmed] = useState(false)
  // Two clicks, not one: a single press on a button a few pixels from "Load
  // sample data" is one slip away from losing the whole ledger.
  return (
    <Block title="Reset">
      <Caption>Deletes every record in every ledger. This cannot be undone.</Caption>
      {!armed ? (
        <button className="btn-danger wide" onClick={() => setArmed(true)}>Erase everything</button>
      ) : (
        <div className="confirm-row">
          <span>This deletes all {totalRows} records permanently.</span>
          <div className="btns">
            <button className="danger" disabled={erase.isPending} onClick={() => erase.mutate(undefined, { onSuccess: () => setArmed(false) })}>
              Yes, erase everything
            </button>
            <button onClick={() => setArmed(false)}>Cancel</button>
          </div>
        </div>
      )}
    </Block>
  )
}

// ---------------------------------------------------------------- dialog

export default function SettingsDialog() {
  const { settingsOpen, setSettingsOpen } = useUi()
  const { data: settings } = useSettings()
  const { data: categories } = useCategories()
  const setNet = useSetNetSameMonthDebts()
  const setOpening = useSetOpeningBalance()
  const setCurrency = useSetCurrency()
  const refreshRates = useRefreshRates()
  const seedDemo = useSeedDemo()
  const clearDemo = useClearDemo()
  const [opening, setOpeningDraft] = useState('')
  const [demoError, setDemoError] = useState<string | null>(null)

  const currency = settings?.currency
  useEffect(() => {
    if (settings && currency) setOpeningDraft(toDisplay(settings.opening_balance, currency).toFixed(2))
  }, [settings?.opening_balance, currency?.code, currency?.rate])

  useEffect(() => {
    if (!settingsOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSettingsOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settingsOpen, setSettingsOpen])

  if (!settingsOpen) return null

  const counts = settings?.counts ?? {}
  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0)
  const present = Object.entries(counts).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing yet'
  const cats = categories || []

  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false) }}>
      <div className="modal settings" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="modal-head">
          <h2 id="settings-title">Settings</h2>
          <button className="icon-btn" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>✕</button>
        </div>
        {!settings || !currency ? (
          <p className="panel-empty">Loading…</p>
        ) : (
          <div className="modal-body">
            <p className="settings-summary"><strong>{totalRows} records</strong> — {present}</p>

            <Block title="Debts settled the same month">
              <label className="check" title="A debt borrowed and repaid inside one month moves money out and back again, so it changes nothing. Leaving both legs in adds its value to your arrivals AND departures totals. Either way your on-hand balance is identical.">
                <input
                  type="checkbox" checked={settings.net_same_month_debts}
                  onChange={(e) => setNet.mutate(e.target.checked)}
                />
                Keep them out of arrivals and departures
              </label>
              <Caption>
                Debts still outstanding, or settled in a later month, always show — only same-month round trips are hidden.
              </Caption>
            </Block>

            <Block title="Opening balance">
              <Caption>
                What you had saved before this board started. It seeds the earliest month's brought-forward
                instead of being logged as income, so it never counts as money earned.
              </Caption>
              <div className="settings-row">
                <input
                  type="number" min={0} step={500} value={opening}
                  aria-label={`Opening balance (${currency.code})`}
                  onChange={(e) => setOpeningDraft(e.target.value)}
                />
                <button
                  className="btn-link"
                  disabled={setOpening.isPending}
                  onClick={() => { const n = parseFloat(opening); if (Number.isFinite(n) && n >= 0) setOpening.mutate(n) }}
                >
                  Save balance
                </button>
              </div>
              {settings.opening_balance > 0 && (
                <Caption>Currently {formatMoney(settings.opening_balance, currency)} — carried into the first month on the board.</Caption>
              )}
            </Block>

            <Block title="Finance bot">
              <Caption>
                Messages, receipts and CSVs you send to the bot, plus the ledger figures needed to answer them,
                go to Google's Gemini API to generate a reply. Nothing else on this board leaves your machine.
              </Caption>
            </Block>

            <Block title="Currency">
              <Caption>
                Changes what the board is read in. Your records stay stored in rupees exactly as entered — this
                converts on display only, so switching back restores the original figures precisely.
              </Caption>
              <div className="settings-row">
                <select value={currency.code} onChange={(e) => setCurrency.mutate(e.target.value)} aria-label="Display currency">
                  {Object.entries(settings.currencies).map(([code, c]) => (
                    <option key={code} value={code}>{code} — {c.label}</option>
                  ))}
                </select>
                <button className="btn-link" disabled={refreshRates.isPending} onClick={() => refreshRates.mutate()}>
                  {refreshRates.isPending ? 'Refreshing…' : 'Refresh rates'}
                </button>
              </div>
              <Caption>
                {currency.code === 'PKR'
                  ? 'Rates on file: ' + Object.keys(settings.currencies).filter((c) => c !== 'PKR')
                    .map((c) => `1 ${c} = ${(currency.rates[c] ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR`)
                    .join(' · ')
                  : `1 ${currency.code} = ${currency.rate.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} PKR`}
              </Caption>
              {currency.stale ? (
                <div className="notice warn">
                  Showing rates from {currency.fetched_on} — could not reach a live source just now ({currency.source}).
                  Figures are converted with the last good rates.
                </div>
              ) : (
                <Caption>Source: {currency.source} · updated {currency.fetched_on}</Caption>
              )}
            </Block>

            <Budgets settings={settings} categories={cats} />
            <MergeCategory categories={cats} />
            <Recurring settings={settings} categories={cats} />

            <Block title="Sample data">
              {settings.demo_active ? (
                <>
                  <Caption>The board is showing generated sample records right now.</Caption>
                  <button className="btn-link wide" disabled={clearDemo.isPending} onClick={() => clearDemo.mutate()}>
                    Clear sample data
                  </button>
                </>
              ) : (
                <>
                  <Caption>
                    Fills three months with plausible generated records so the board can be judged with data in it.
                    Labelled while active.
                  </Caption>
                  {totalRows > 0 && (
                    <Caption>Clear your real records first — sample rows are never mixed into data you entered.</Caption>
                  )}
                  <button
                    className="btn-link wide"
                    disabled={totalRows > 0 || seedDemo.isPending}
                    onClick={() => seedDemo.mutate(undefined, { onError: (e) => setDemoError(errText(e)) })}
                  >
                    Load sample data
                  </button>
                  {demoError && <div className="notice warn">{demoError}</div>}
                </>
              )}
            </Block>

            <Block title="Backup">
              <Caption>
                Every record in every ledger as one CSV — readable in any spreadsheet, and the only copy of this
                data that is not the app's own database file.
              </Caption>
              {totalRows > 0 ? (
                <a className="btn-link wide" href="/api/settings/export/csv" download>Download all records (CSV)</a>
              ) : (
                <button className="btn-link wide" disabled>Download all records (CSV)</button>
              )}
            </Block>

            <Snapshots totalRows={totalRows} />
            <Session />
            <Erase totalRows={totalRows} />
          </div>
        )}
      </div>
    </div>
  )
}
