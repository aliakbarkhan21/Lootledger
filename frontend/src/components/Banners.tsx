import { useEffect, useMemo, useRef, useState } from 'react'
import type { Banners as BannersType, Currency } from '../api/types'
import { useDismissDigest, useDismissSetupHint, useGenerateDigest, useRecurringBulk, useRecurringResolve } from '../api/hooks'
import { formatMoney } from '../lib/money'
import { useUi } from '../state/ui'

export default function Banners({ banners, currency }: { banners: BannersType; currency: Currency }) {
  const { setSettingsOpen } = useUi()
  const dismissHint = useDismissSetupHint()
  const dismissDigest = useDismissDigest()
  const generateDigest = useGenerateDigest()
  const recurring = useRecurringBulk()
  const resolve = useRecurringResolve()
  // Rows the user has unticked; everything due starts ticked.
  const [unticked, setUnticked] = useState<Set<number>>(new Set())
  const asked = useRef(false)

  // The month's digest is one Gemini call on the first load of a new month.
  // Fired after the board has painted, so it never holds the page up; the
  // server marks the month as attempted before calling out, so it runs once.
  useEffect(() => {
    if (banners.digest.needs_generation && !asked.current) {
      asked.current = true
      generateDigest.mutate()
    }
  }, [banners.digest.needs_generation, generateDigest])

  const gaps = banners.setup_gaps
  const showHint = gaps.length > 0
  const digest = banners.digest.text
  const due = banners.recurring_due
  const dueKey = due.map((r) => r.id).join(',')
  const pending = recurring.isPending || resolve.isPending

  // A new due list (after any action, or a refetch) starts with everything ticked.
  useEffect(() => { setUnticked(new Set()) }, [dueKey])

  const picked = useMemo(() => due.filter((r) => !unticked.has(r.id)), [due, unticked])
  const pickedTotal = picked.reduce((sum, r) => sum + r.amount, 0)
  const toggle = (id: number) =>
    setUnticked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const logSelected = () =>
    resolve.mutate({
      log_ids: picked.map((r) => r.id),
      skip_ids: due.filter((r) => unticked.has(r.id)).map((r) => r.id),
    })

  if (!banners.demo_active && !showHint && !digest && !due.length) return null

  return (
    <div className="banners">
      {banners.demo_active && (
        <div className="banner demo">
          <span>
            <strong>Sample data</strong> — these figures are generated for demonstration, not real records.
            Clear them from Settings.
          </span>
        </div>
      )}
      {showHint && (
        <div className="banner warn">
          <div className="setup-body">
            <div className="banner-title">
              {gaps.length > 1 ? 'Two settings' : 'One setting'} would change what the board reports
            </div>
            {gaps.map((g) => (
              <p className="setup-item" key={g.title}><b>{g.title}</b> {g.body}</p>
            ))}
          </div>
          <div className="banner-actions">
            <button onClick={() => setSettingsOpen(true)}>Open Settings</button>
            <button onClick={() => dismissHint.mutate()}>Not now</button>
          </div>
        </div>
      )}
      {digest && (
        <div className="banner digest">
          <div>
            <div className="banner-title">{banners.digest.label} digest</div>
            <div className="banner-text">{digest}</div>
          </div>
          <div className="banner-actions">
            <button onClick={() => dismissDigest.mutate()}>Dismiss</button>
          </div>
        </div>
      )}
      {due.length > 0 && (
        <div className="banner recur">
          <div className="recur-body">
            <div className="banner-title">
              {picked.length} of {due.length} selected
              <span className="recur-total">{formatMoney(pickedTotal, currency, 0)}</span>
              <span className="recur-what">recurring due this month</span>
            </div>
            {due.map((r) => (
              <label className="recur-item" key={r.id}>
                <input
                  type="checkbox"
                  checked={!unticked.has(r.id)}
                  onChange={() => toggle(r.id)}
                  disabled={pending}
                />
                <span className="recur-box" aria-hidden="true" />
                <span className="recur-label">{r.label}</span>
                <span className="sub">{r.category || (r.kind === 'income' ? 'Income' : 'Expense')}</span>
                <span className="amt">{formatMoney(r.amount, currency, 0)}</span>
              </label>
            ))}
            {unticked.size > 0 && (
              <p className="recur-hint">Unticked items will be skipped for this month.</p>
            )}
          </div>
          <div className="banner-actions">
            <button className="primary" onClick={logSelected} disabled={pending || picked.length === 0}>
              Log selected ({picked.length})
            </button>
            <button onClick={() => recurring.mutate('log-all')} disabled={pending}>Log all</button>
            <button onClick={() => recurring.mutate('skip-all')} disabled={pending}>Not this month</button>
          </div>
        </div>
      )}
    </div>
  )
}
