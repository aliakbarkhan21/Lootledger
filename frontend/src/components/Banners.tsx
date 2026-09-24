import { useEffect, useRef } from 'react'
import type { Banners as BannersType, Currency } from '../api/types'
import { useDismissDigest, useDismissSetupHint, useGenerateDigest, useRecurringBulk } from '../api/hooks'
import { formatMoney } from '../lib/money'
import { useUi } from '../state/ui'

export default function Banners({ banners, currency }: { banners: BannersType; currency: Currency }) {
  const { setSettingsOpen } = useUi()
  const dismissHint = useDismissSetupHint()
  const dismissDigest = useDismissDigest()
  const generateDigest = useGenerateDigest()
  const recurring = useRecurringBulk()
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

  const showHint = !banners.setup_hint_hidden && (!banners.opening_balance_set || !banners.budgets_set)
  const digest = banners.digest.text
  const due = banners.recurring_due
  const dueTotal = due.reduce((sum, r) => sum + r.amount, 0)

  if (!banners.demo_active && !showHint && !digest && !due.length) return null

  return (
    <div className="banners">
      {banners.demo_active && (
        <div className="banner demo">
          <span>This board is showing generated sample data, not your real records.</span>
        </div>
      )}
      {showHint && (
        <div className="banner warn">
          <span>
            Settings would change what the board reports —{' '}
            {!banners.opening_balance_set && 'opening balance is unset'}
            {!banners.opening_balance_set && !banners.budgets_set && ', '}
            {!banners.budgets_set && 'no category budgets set'}.
          </span>
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
              {due.length} recurring due this month
              <span className="recur-total">{formatMoney(dueTotal, currency, 0)}</span>
            </div>
            {due.map((r) => (
              <div className="recur-item" key={r.id}>
                <span>{r.label}</span>
                <span className="sub">{r.category || (r.kind === 'income' ? 'Income' : 'Expense')}</span>
                <span className="amt">{formatMoney(r.amount, currency, 0)}</span>
              </div>
            ))}
          </div>
          <div className="banner-actions">
            <button onClick={() => recurring.mutate('log-all')} disabled={recurring.isPending}>Log all</button>
            <button onClick={() => recurring.mutate('skip-all')} disabled={recurring.isPending}>Not this month</button>
          </div>
        </div>
      )}
    </div>
  )
}
