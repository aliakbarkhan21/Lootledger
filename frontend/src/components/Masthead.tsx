export default function Masthead({ periodLabel }: { periodLabel: string }) {
  return (
    <div className="masthead">
      <div className="brand">
        {/* The app's mark as a seal: the icon's gold italic LL inside a thin
            double ring. */}
        <div className="brand-seal" aria-hidden="true">
          <span className="brand-ll">LL</span>
        </div>
        <div>
          <div className="wordmark">Loot Ledger</div>
          <div className="greeting">Hello, Ali Akbar</div>
        </div>
      </div>
      <div className="folio-no">
        Journal Folio
        <span className="no">{periodLabel}</span>
      </div>
    </div>
  )
}
