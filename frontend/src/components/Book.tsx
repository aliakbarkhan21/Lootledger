import type { ReactNode } from 'react'
import { useUi } from '../state/ui'
import GlassRail, { type RailTarget } from './GlassRail'

// The Finance Bot is not a tab: it opens from the ✦ button in the toolbar and
// from the command palette (Ctrl K).
const TABS = [
  { id: 'board', label: 'Board' },
  { id: 'recurring', label: 'Recurring' },
  { id: 'obligations', label: 'Obligations' },
] as const

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Where each tab (or, in the Glass style, each rail button) lands. */
function goTo(id: RailTarget) {
  if (id === 'board') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } else if (id === 'recurring') {
    // The Recurring panel beneath the Spending Rhythm calendar.
    scrollToId('recurring')
  } else {
    // The Board's own Obligations section: what is owed each way,
    // net worth, and the panels beneath it.
    scrollToId('obligations')
  }
}

export default function Book({ children, dock }: { children: ReactNode; dock?: ReactNode }) {
  const { botOpen, style } = useUi()
  // One tree for both styles: the rail, spine and tabs come and go in their
  // own slots, so switching style never remounts the entry slip or the page
  // (a half-typed entry or a streaming bot reply survives the switch).
  // Glass has no spine and no paper tabs; the rail floats over the backdrop.
  const glass = style === 'glass'
  return (
    <div className={`desk ${botOpen ? 'with-rail' : ''}`}>
      {glass ? <GlassRail onGo={goTo} /> : null}
      {dock}
      <div className="book">
        {glass ? null : <div className="spine" />}
        {glass ? null : (
          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tab ${t.id === 'board' ? 'active' : ''}`}
                onClick={() => goTo(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <div className="page">{children}</div>
      </div>
    </div>
  )
}
