/** One fixed ink per platform, so a category keeps its colour in every panel
 * and every period — the donut, the load list, the ledger's platform column
 * and the budget caps all agree. Defined as tokens so the dark reading can
 * lift them without changing hue. */
const SLUG: Record<string, string> = {
  Food: 'food',
  Games: 'games',
  Hangouts: 'hangouts',
  Shopping: 'shopping',
  Subscriptions: 'subscriptions',
  Transportation: 'transportation',
  Utilities: 'utilities',
  Other: 'other',
  // arrivals-side platforms
  Income: 'income',
  Returned: 'returned',
  Loan: 'loan',
  Lent: 'lent',
  Settled: 'other',
}

export function platformColor(name: string): string {
  return `var(--plat-${SLUG[name] ?? 'other'})`
}
