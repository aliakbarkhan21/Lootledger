import { useState } from 'react'
import type { BoardRow, Currency } from '../api/types'
import LedgersTab from './LedgersTab'
import EditTab from './EditTab'
import DebtsTab from './DebtsTab'
import ImportTab from './ImportTab'

const TABS = [
  { id: 'ledgers', label: 'Ledgers' },
  { id: 'edit', label: 'Edit' },
  { id: 'debts', label: 'Debts' },
  { id: 'import', label: 'Import' },
] as const
type TabId = (typeof TABS)[number]['id']

export default function LedgersDebtsImport({
  arrivals, departures, currency, periodKey,
}: { arrivals: BoardRow[]; departures: BoardRow[]; currency: Currency; periodKey: string }) {
  const [tab, setTab] = useState<TabId>('ledgers')

  return (
    <section id="ledgers-debts-import" className="ldi">
      <div className="folio-heading">Ledgers, debts and import</div>
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
    </section>
  )
}
