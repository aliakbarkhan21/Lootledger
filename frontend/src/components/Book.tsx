import type { ReactNode } from 'react'
import { useUi } from '../state/ui'

const TABS = [
  { id: 'board', label: 'Board' },
  { id: 'ledgers', label: 'Ledgers' },
  { id: 'assistant', label: 'Assistant' },
] as const

export default function Book({ children }: { children: ReactNode }) {
  const { botOpen, setBotOpen } = useUi()
  return (
    <div className={`desk ${botOpen ? 'with-rail' : ''}`}>
      <div className="book">
        <div className="spine" />
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${t.id === 'assistant' ? (botOpen ? 'active' : '') : t.id === 'board' ? 'active' : ''}`}
              onClick={() => {
                if (t.id === 'assistant') setBotOpen(true)
                if (t.id === 'ledgers') {
                  document.getElementById('ledgers-debts-import')?.scrollIntoView({ behavior: 'smooth' })
                }
                if (t.id === 'board') {
                  window.scrollTo({ top: 0, behavior: 'smooth' })
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
