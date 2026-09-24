/** Amber stepped by rank: the largest share darkest. */
export function tint(i: number, n: number): string {
  const strength = n <= 1 ? 85 : Math.round(85 - (i / (n - 1)) * 55)
  return `color-mix(in srgb, var(--gold) ${strength}%, var(--paper-2))`
}

/** A small hand-drawn SVG donut — no charting library, matching the
 * product's own "every graphic is hand-drawn" principle. Slices are drawn in
 * amber tints stepped by share when `tinted` is set (income-by-source, which
 * isn't a taxonomy and shouldn't read in categorical hues), or in each
 * platform's own fixed ink otherwise (spending categories). */
export default function Donut({
  values, colors, tinted = false, size = 108, label = 'Share',
}: {
  values: number[]
  colors?: string[]
  tinted?: boolean
  size?: number
  label?: string
}) {
  const total = values.reduce((a, b) => a + b, 0)
  const r = size / 2 - 8
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r

  const dashes = values.map((v) => (total > 0 ? v / total : 0) * circumference)
  const starts = dashes.map((_, i) => dashes.slice(0, i).reduce((a, d) => a + d, 0))
  const segments = values.map((_, i) => {
    const dash = dashes[i]
    return (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={tinted ? tint(i, values.length) : colors?.[i] ?? 'var(--plat-other)'}
        strokeWidth={12}
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={-starts[i]}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    )
  })

  return (
    <svg width={size} height={size} role="img" aria-label={label} style={{ flex: '0 0 auto' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--paper-3)" strokeWidth={12} />
      {segments}
    </svg>
  )
}
