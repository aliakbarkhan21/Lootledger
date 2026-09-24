import './styles/board.css'
import AuthGate from './components/AuthGate'
import Book from './components/Book'
import Masthead from './components/Masthead'
import Banners from './components/Banners'
import Toolbar from './components/Toolbar'
import EntryDock from './components/EntryDock'
import SummaryBand from './components/SummaryBand'
import LedgerTable from './components/LedgerTable'
import PlatformLoad from './components/PlatformLoad'
import Capacity from './components/Capacity'
import Obligations from './components/Obligations'
import IncomeSource from './components/IncomeSource'
import SpendingCalendar from './components/SpendingCalendar'
import RunStrip from './components/RunStrip'
import LedgersDebtsImport from './components/LedgersDebtsImport'
import SettingsDialog from './components/SettingsDialog'
import FinanceBot from './components/FinanceBot'
import CommandPalette from './components/CommandPalette'
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
      <Banners banners={board.banners} currency={board.currency} />
      {/* Where the section always sat: above the controls, folded until wanted. */}
      <LedgersDebtsImport
        arrivals={board.arrivals}
        departures={board.departures}
        currency={board.currency}
        periodKey={board.period.key}
      />
      <Toolbar months={periods.months} current={periods.current} totalRows={totalRows} currency={board.currency} />
      <SummaryBand figures={board.figures} currency={board.currency} />
      <LedgerTable
        arrivals={board.arrivals}
        departures={board.departures}
        currency={board.currency}
        search={search}
        periodLabel={board.period.label}
      />

      <div className="folio-heading" id="obligations">Obligations</div>
      <Obligations figures={board.figures} currency={board.currency} />

      {/* Capacity is one bar and two lines, so it runs the full width. Below it,
          the two share panels stack in one column beside the calendar: cards
          keep their own height instead of being stretched to the calendar's. */}
      <Capacity
        burnPct={board.capacity.burn_pct}
        usualDailyOutflow={board.capacity.usual_daily_outflow}
        isAllTime={board.period.is_all_time}
        currency={board.currency}
      />

      <div className="panel-cols">
        <div className="panel-col">
          <PlatformLoad
            byCategory={board.by_category}
            trend={board.trend.category}
            budgets={board.budgets}
            currency={board.currency}
          />
          <IncomeSource bySource={board.income_by_source} trend={board.trend.income} currency={board.currency} />
        </div>
        <div className="panel-col">
          {board.calendar ? (
            <SpendingCalendar calendar={board.calendar} periodKey={board.period.key} currency={board.currency} />
          ) : (
            <div className="panel">
              <div className="panel-head"><h3>Spending Rhythm</h3></div>
              <p className="panel-empty">All Time has no single month's shape to show.</p>
            </div>
          )}
        </div>
      </div>

      <div className="folio-heading">Last 12 Months</div>
      <RunStrip months={board.run_strip} currency={board.currency} />


      <CommandPalette months={periods.months} currency={board.currency} periodLabel={board.period.label} />
      <FinanceBot periodKey={board.period.is_all_time ? 'all' : board.period.key} periodLabel={board.period.label} />

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
      <Book dock={<EntryDock />}>
        <BoardPage />
      </Book>
      <SettingsDialog />
    </AuthGate>
  )
}
