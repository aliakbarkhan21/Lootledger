import type { Banners as BannersType } from '../api/types'
import { useDismissDigest, useDismissSetupHint, useRecurringBulk } from '../api/hooks'
import { useUi } from '../state/ui'

export default function Banners({ banners }: { banners: BannersType }) {
  const { setSettingsOpen } = useUi()
  const dismissHint = useDismissSetupHint()
  const dismissDigest = useDismissDigest()
  const recurring = useRecurringBulk()

  const showHint = !banners.setup_hint_hidden && (!banners.opening_balance_set || !banners.budgets_set)
  const showDigest = banners.digest.text && banners.digest.period && banners.digest.dismissed_for !== banners.digest.period
  const dueCount = banners.recurring_due.length

  if (!banners.demo_active && !showHint && !showDigest && !dueCount) return null

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
      {showDigest && (
        <div className="banner">
          <span>{banners.digest.text}</span>
          <div className="banner-actions">
            <button onClick={() => dismissDigest.mutate()}>Dismiss</button>
          </div>
        </div>
      )}
      {dueCount > 0 && (
        <div className="banner">
          <span>{dueCount} recurring {dueCount === 1 ? 'entry is' : 'entries are'} due this month.</span>
          <div className="banner-actions">
            <button onClick={() => recurring.mutate('log-all')}>Log all</button>
            <button onClick={() => recurring.mutate('skip-all')}>Not this month</button>
          </div>
        </div>
      )}
    </div>
  )
}
