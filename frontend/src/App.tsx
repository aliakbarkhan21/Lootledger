import { createPortal } from 'react-dom'
import './styles/board.css'
// After board.css on purpose: every rule in it is scoped under
// [data-style='glass'], so the Ledger Journal never matches one.
import './styles/glass.css'
import AuthGate from './components/AuthGate'
import Book from './components/Book'
import Masthead from './components/Masthead'
import GlassTopBar from './components/GlassTopBar'
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
import RecurringPanel from './components/RecurringPanel'
import RunStrip from './components/RunStrip'
import LedgersDebtsImport from './components/LedgersDebtsImport'
import SettingsDialog from './components/SettingsDialog'
import FinanceBot from './components/FinanceBot'
import CommandPalette from './components/CommandPalette'
import { useBoard, usePeriods } from './api/hooks'
import { useUi } from './state/ui'

function BoardPage() {
  const { period, search, style } = useUi()
  const { data: periods } = usePeriods()
  const { data: board, isLoading } = useBoard(period)
  // Glass folds the masthead and the toolbar row into one floating top bar;
  // everything else on the page is the same component in either style.
  const glass = style === 'glass'

  if (isLoading || !board || !periods) {
    return (
      <>
        {glass ? <GlassTopBar /> : <Masthead periodLabel="…" />}
        <p style={{ color: 'var(--ink-soft)', marginTop: 20 }}>Opening the ledger…</p>
      </>
    )
  }

  const totalRows = Object.values(board.counts).reduce((a, b) => a + b, 0)
  const capacity = (
    <Capacity
      burnPct={board.capacity.burn_pct}
      usualDailyOutflow={board.capacity.usual_daily_outflow}
      isAllTime={board.period.is_all_time}
      currency={board.currency}
    />
  )

  return (
    <>
      {glass ? (
        <GlassTopBar months={periods.months} current={periods.current} totalRows={totalRows} currency={board.currency} />
      ) : (
        <Masthead periodLabel={board.period.label} />
      )}
      {/* Everything below the masthead or top bar. The journal lays it out as
          if these boxes were not there (display: contents). In Glass the body
          is a window that sticks at the stuck top bar's top edge and clips
          there, and the board inside it is moved by the page's own scroll on
          Chrome's compositor (GlassScene), so nothing scrolled up under the
          bar can show in the gap above it, however fast the page moves. The
          tail stands in for the board's height in the page's flow. */}
      <div className="board-body">
        <div className="board-scroll">
          <Banners banners={board.banners} currency={board.currency} />
          {/* Where the section always sat: above the controls, folded until wanted. */}
          <LedgersDebtsImport
            arrivals={board.arrivals}
            departures={board.departures}
            currency={board.currency}
            periodKey={board.period.key}
          />
          {!glass && (
            <Toolbar months={periods.months} current={periods.current} totalRows={totalRows} currency={board.currency} />
          )}
          <SummaryBand figures={board.figures} currency={board.currency} />
          {/* Glass sets Platform Load beside the month's log, so the month's
              shape shows as the board opens; the journal keeps it below
              (both wrappers are display: contents there). */}
          <div className="log-row">
            <div className="log-main">
              <LedgerTable
                arrivals={board.arrivals}
                departures={board.departures}
                currency={board.currency}
                search={search}
                periodLabel={board.period.label}
              />
            </div>
            {glass && (
              <PlatformLoad
                byCategory={board.by_category}
                trend={board.trend.category}
                budgets={board.budgets}
                currency={board.currency}
              />
            )}
          </div>

          <div className="folio-heading" id="obligations">Obligations</div>
          <Obligations figures={board.figures} currency={board.currency} />

          {/* Capacity is one bar and two lines, so in the journal it runs the full
              width. Below it, the two share panels stack in one column beside the
              calendar: cards keep their own height instead of being stretched to
              the calendar's. Glass has moved Platform Load up beside the log, so
              Capacity takes its place at the head of that column. */}
          {!glass && capacity}

          <div className="panel-cols">
            <div className="panel-col">
              {glass ? capacity : (
                <PlatformLoad
                  byCategory={board.by_category}
                  trend={board.trend.category}
                  budgets={board.budgets}
                  currency={board.currency}
                />
              )}
              <IncomeSource bySource={board.income_by_source} trend={board.trend.income} currency={board.currency} />
            </div>
            <div className="panel-col">
              {board.calendar ? (
                <SpendingCalendar calendar={board.calendar} periodKey={board.period.key} currency={board.currency} />
              ) : (
                <div className="panel lg">
                  <div className="panel-head"><h3>Spending Rhythm</h3></div>
                  <p className="panel-empty">All Time has no single month's shape to show.</p>
                </div>
              )}
            </div>
          </div>

          <RecurringPanel currency={board.currency} />

          <div className="folio-heading">Last 12 Months</div>
          <RunStrip months={board.run_strip} currency={board.currency} />


          {/* Fixed overlays, kept out of the page: the page slides by transform
              while the entry slip folds, and a fixed box inside a transformed one
              would ride along with it. */}
          {createPortal(
            <>
              <CommandPalette months={periods.months} currency={board.currency} periodLabel={board.period.label} />
              <FinanceBot periodKey={board.period.is_all_time ? 'all' : board.period.key} periodLabel={board.period.label} />
            </>,
            document.body,
          )}

          <footer style={{ marginTop: 48, fontSize: '0.74rem', color: 'var(--ink-soft)', textAlign: 'center' }}>
            Built by{' '}
            <a href="https://www.linkedin.com/in/muhammad-ali-akbar-khan-7b37b8197" target="_blank" rel="noreferrer">
              Muhammad Ali Akbar
            </a>
          </footer>
        </div>
      </div>
      <div className="board-tail" aria-hidden="true" />
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
