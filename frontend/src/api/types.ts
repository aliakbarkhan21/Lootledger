export interface Currency {
  code: string
  symbol: string
  rate: number
  source: string
  fetched_on: string
  stale: boolean
  rates: Record<string, number>
}

export interface BoardRow {
  id: number
  date: string
  label: string
  platform: string
  amount: number
  kind: string
}

export interface CategoryTotal {
  category: string
  amount: number
}

export interface SourceTotal {
  source: string
  amount: number
}

export interface TopCategory {
  category: string
  amount: number
}

export interface Figures {
  opening: number
  inflow: number
  outflow: number
  on_hand: number
  savings_rate: number
  burn_pct: number
  status: 'on-time' | 'delayed' | 'cancelled' | 'quiet'
  outflow_delta_pct: number | null
  receivable_open: number
  payable_open: number
  receivable_count: number
  payable_count: number
  net_worth: number
  has_activity: boolean
  top_category: TopCategory | null
}

export interface CategoryTrend {
  mode: 'daily' | 'monthly'
  months: string[]
  series: Record<string, number[]>
  vs_avg: Record<string, number | null>
}

export interface IncomeTrend {
  months: string[]
  series: Record<string, number[]>
  vs_avg: Record<string, number | null>
}

export interface CalendarData {
  days_in_month: number
  daily_outflow: number[]
  category_by_day: Record<string, [string, number][]>
  today_day: number | null
}

export interface RunStripMonth {
  key: string
  short: string
  outflow: number
  closing: number
  is_current: boolean
}

export interface RecurringItem {
  id: number
  label: string
  kind: 'expense' | 'income'
  category: string | null
  amount: number
  day_of_month: number
  last_logged: string | null
}

export interface Banners {
  demo_active: boolean
  setup_hint_hidden: boolean
  opening_balance_set: boolean
  budgets_set: boolean
  digest: { label: string; text: string | null; needs_generation: boolean }
  recurring_due: RecurringItem[]
}

export interface BoardResponse {
  period: { key: string; label: string; is_all_time: boolean; prev_key: string | null }
  currency: Currency
  figures: Figures
  arrivals: BoardRow[]
  departures: BoardRow[]
  by_category: CategoryTotal[]
  income_by_source: SourceTotal[]
  capacity: { burn_pct: number; usual_daily_outflow: number | null; days_in_period: number | null }
  trend: { category: CategoryTrend; income: IncomeTrend }
  calendar: CalendarData | null
  run_strip: RunStripMonth[]
  budgets: Record<string, number>
  banners: Banners
  counts: Record<string, number>
}

export interface PeriodOption {
  key: string
  label: string
  short: string
  outflow: number
}

export interface PeriodsResponse {
  current: string
  months: PeriodOption[]
}

export interface PersonDebt {
  name: string
  owed_to_you: number
  you_owe: number
  rows: number
  oldest_days: number
  net: number
  both_ways: boolean
}

export interface LedgerRow {
  id: number
  date: string
  amount: number
  description?: string
  category?: string
  source?: string
  person?: string
  lender?: string
  paid_back?: number
  settled_date?: string | null
  kind?: string
}

export interface SettingsResponse {
  counts: Record<string, number>
  opening_balance: number
  opening_balance_set: boolean
  net_same_month_debts: boolean
  currency: Currency
  currencies: Record<string, { symbol: string; label: string }>
  budgets: Record<string, number>
  recurring: RecurringItem[]
  demo_active: boolean
}

export interface BackupInfo {
  name: string
  path: string
  taken: number
  size: number
  counts: Record<string, number>
  total: number
  automatic: boolean
}

export interface ChatSummary {
  id: string
  title: string
  message_count: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface Chat {
  id: string
  title: string
  messages: ChatMessage[]
}

export interface AuthStatus {
  mode: 'open' | 'password'
  raw_mode: 'open' | 'password' | 'oidc'
  unlocked: boolean
  demo: boolean
}
