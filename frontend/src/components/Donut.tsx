/** A small hand-drawn SVG donut — no charting library, matching the
 * product's own "every graphic is hand-drawn" principle. Slices are drawn in
 * amber tints stepped by share when `tinted` is set (income-by-source, which
 * isn't a taxonomy and shouldn't read in categorical hues), or in a rotating
 * green/gold/red-adjacent ledger palette otherwise (spending categories). */
export default function Donut({
  values, tinted = false, size = 108,
}: {
  values: number[]
  tinted?: boolean
  size?: number
}) {
  const total = values.reduce((a, b) => a + b, 0)
  const r = size / 2 - 8
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r

  const palette = ['#7f9a72', '#9c7a2e', '#b5493d', '#4c5d46', '#c9a04a', '#5c6e50', '#8a6f8f', '#6b8a9a']

  let offset = 0
  const segments = values.map((v, i) => {
    const frac = total > 0 ? v / total : 0
    const dash = frac * circumference
    const seg = (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={tinted ? `color-mix(in srgb, var(--gold) ${30 + (i * 12) % 60}%, var(--paper-2))` : palette[i % palette.length]}
        strokeWidth={12}
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={-offset}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    )
    offset += dash
    return seg
  })

  return (
    <svg width={size} height={size} role="img" aria-label="Category share">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--paper-3)" strokeWidth={12} />
      {segments}
    </svg>
  )
}
