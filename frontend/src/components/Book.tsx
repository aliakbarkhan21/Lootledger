import type { ReactNode } from 'react'
import { useUi } from '../state/ui'

// The Finance Bot is not a tab: it opens from the ✦ button in the toolbar and
// from the command palette (Ctrl K).
const TABS = [
  { id: 'board', label: 'Board' },
  { id: 'ledgers', label: 'Ledgers' },
  { id: 'obligations', label: 'Obligations' },
] as const

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function Book({ children, dock }: { children: ReactNode; dock?: ReactNode }) {
  const { botOpen, setLedgersOpen, setLdiTab } = useUi()
  return (
    <div className={`desk ${botOpen ? 'with-rail' : ''}`}>
      {dock}
      <div className="book">
        <div className="spine" />
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${t.id === 'board' ? 'active' : ''}`}
              onClick={() => {
                if (t.id === 'board') {
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                } else if (t.id === 'ledgers') {
                  // Opens the Ledgers, debts and import section on its Ledgers sheet.
                  setLdiTab('ledgers')
                  setLedgersOpen(true)
                  requestAnimationFrame(() => scrollToId('ledgers-debts-import'))
                } else {
                  // The Board's own Obligations section: what is owed each way,
                  // net worth, and the panels beneath it.
                  scrollToId('obligations')
                }
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="page">{children}</div>
      </div>
    </div>
  )
}
