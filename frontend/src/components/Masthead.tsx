export default function Masthead({ periodLabel }: { periodLabel: string }) {
  return (
    <div className="masthead">
      <div>
        <div className="wordmark">Loot Ledger</div>
        <div className="greeting">Hello, Ali Akbar</div>
      </div>
      <div className="folio-no">
        Journal Folio
        <span className="no">{periodLabel}</span>
      </div>
    </div>
  )
}
