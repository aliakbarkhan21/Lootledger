import type { BoardRow, Currency } from '../api/types'
import { useUi, type LdiTab } from '../state/ui'
import LedgersTab from './LedgersTab'
import EditTab from './EditTab'
import DebtsTab from './DebtsTab'
import ImportTab from './ImportTab'

const TABS: { id: LdiTab; label: string }[] = [
  { id: 'ledgers', label: 'Ledgers' },
  { id: 'edit', label: 'Edit' },
  { id: 'debts', label: 'Debts' },
  { id: 'import', label: 'Import' },
]

export default function LedgersDebtsImport({
  arrivals, departures, currency, periodKey,
}: { arrivals: BoardRow[]; departures: BoardRow[]; currency: Currency; periodKey: string }) {
  const { ledgersOpen: open, setLedgersOpen: setOpen, ldiTab: tab, setLdiTab: setTab } = useUi()

  // Folded, the body stays mounted (and inert), so an import half-way through
  // or a row being edited is still there when it is opened again. The fold
  // itself is animated in board.css: the sheet drops open under the bar.
  return (
    <section id="ledgers-debts-import" className={`ldi ${open ? 'open' : ''}`}>
      <button
        className="ldi-toggle"
        aria-expanded={open}
        aria-controls="ldi-body"
        onClick={() => setOpen(!open)}
      >
        <span className="ldi-chevron" aria-hidden="true">▸</span>
        <span className="ldi-title">Ledgers, debts and import</span>
        <span className="ldi-hint">{open ? 'Fold away' : 'Edit rows, settle debts, import a sheet'}</span>
      </button>
      <div id="ldi-body" className="ldi-body" inert={!open}>
        <div className="ldi-clip">
          <div className="ldi-sheet">
            <div className="section-tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`section-tab ${tab === t.id ? 'active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="section-body" role="tabpanel">
              {tab === 'ledgers' && (
                <LedgersTab arrivals={arrivals} departures={departures} currency={currency} periodKey={periodKey} />
              )}
              {tab === 'edit' && <EditTab currency={currency} />}
              {tab === 'debts' && <DebtsTab currency={currency} />}
              {tab === 'import' && <ImportTab currency={currency} />}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
