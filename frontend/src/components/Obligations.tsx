import type { Currency, Figures } from '../api/types'
import { formatMoney } from '../lib/money'

export default function Obligations({ figures, currency }: { figures: Figures; currency: Currency }) {
  return (
    <div className="panel obligations">
      <div>
        <div className="k">Owed To You</div>
        <div className="v credit">{formatMoney(figures.receivable_open, currency)}</div>
        <div className="note">{figures.receivable_count} open</div>
      </div>
      <div>
        <div className="k">You Owe</div>
        <div className="v debit">{formatMoney(figures.payable_open, currency)}</div>
        <div className="note">{figures.payable_count} open</div>
      </div>
      <div>
        <div className="k">Net Worth</div>
        <div className="v">{formatMoney(figures.net_worth, currency)}</div>
      </div>
    </div>
  )
}
