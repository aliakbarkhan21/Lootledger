import './styles/board.css'
import AuthGate from './components/AuthGate'
import Book from './components/Book'
import Masthead from './components/Masthead'
import Banners from './components/Banners'
import Toolbar from './components/Toolbar'
import EntryForm from './components/EntryForm'
import SummaryBand from './components/SummaryBand'
import LedgerTable from './components/LedgerTable'
import { useBoard, usePeriods } from './api/hooks'
import { useUi } from './state/ui'

function BoardPage() {
  const { period, search } = useUi()
  const { data: periods } = usePeriods()
  const { data: board, isLoading } = useBoard(period)

  if (isLoading || !board || !periods) {
    return (
      <>
        <Masthead periodLabel="…" />
        <p style={{ color: 'var(--ink-soft)', marginTop: 20 }}>Opening the ledger…</p>
      </>
    )
  }

  const totalRows = Object.values(board.counts).reduce((a, b) => a + b, 0)

  return (
    <>
      <Masthead periodLabel={board.period.label} />
      <Banners banners={board.banners} />
      <Toolbar months={periods.months} current={periods.current} totalRows={totalRows} />
      <EntryForm currencyCode={board.currency.code} />
      <SummaryBand figures={board.figures} currency={board.currency} />
      <LedgerTable
        arrivals={board.arrivals}
        departures={board.departures}
        currency={board.currency}
        search={search}
      />
      <footer style={{ marginTop: 48, fontSize: '0.74rem', color: 'var(--ink-soft)', textAlign: 'center' }}>
        Built by{' '}
        <a href="https://www.linkedin.com/in/muhammad-ali-akbar-khan-7b37b8197" target="_blank" rel="noreferrer">
          Muhammad Ali Akbar
        </a>
      </footer>
    </>
  )
}

export default function App() {
  return (
    <AuthGate>
      <Book>
        <BoardPage />
      </Book>
    </AuthGate>
  )
}
