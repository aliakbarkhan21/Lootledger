import type { Currency } from '../api/types'

/** The TS mirror of finance.py's to_display()/money()/money_compact() — the
 * one place amounts are converted from stored PKR into whatever currency the
 * board is displaying. Every component formats money through these, never
 * by hand, so the invariant ("Rs. 1,234.56" everywhere) actually holds. */

export function toDisplay(pkr: number, currency: Currency): number {
  if (!currency.rate) return 0
  return pkr / currency.rate
}

export function formatMoney(pkr: number, currency: Currency, decimals = 2): string {
  const value = toDisplay(pkr, currency)
  return `${currency.symbol} ${value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

export function formatMoneyCompact(pkr: number, currency: Currency): string {
  const converted = toDisplay(pkr, currency)
  const av = Math.abs(converted)
  const sign = converted < 0 ? '-' : ''
  if (av >= 1_000_000) {
    return `${sign}${(av / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`
  }
  if (av < 1000 && currency.code !== 'PKR') {
    return `${sign}${av.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `${sign}${av.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function formatDisplayDate(iso: string): string {
  // Stored/returned as YYYY-MM-DD; shown as DD/MM/YYYY, matching finance.display_date().
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

export function formatDayMonth(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso.slice(0, 5)
  return `${m[3]}/${m[2]}`
}

export function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
