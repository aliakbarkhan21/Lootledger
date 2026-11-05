/** Amber stepped by rank: the largest share darkest. */
export function tint(i: number, n: number): string {
  const strength = n <= 1 ? 85 : Math.round(85 - (i / (n - 1)) * 55)
  // --g-heat is Glass's own amber; the journal has none and keeps its gold.
  return `color-mix(in srgb, var(--g-heat, var(--gold)) ${strength}%, var(--paper-2))`
}

/** A small hand-drawn SVG donut — no charting library, matching the
 * product's own "every graphic is hand-drawn" principle. Slices are drawn in
 * amber tints stepped by share when `tinted` is set (income-by-source, which
 * isn't a taxonomy and shouldn't read in categorical hues), or in each
 * platform's own fixed ink otherwise (spending categories). */
export default function Donut({
  values, colors, tinted = false, size = 108, label = 'Share', names, hot = null, onHot, variant = 'journal',
}: {
  values: number[]
  colors?: string[]
  tinted?: boolean
  size?: number
  label?: string
  /** Per-slice labels, used for the hover title. */
  names?: string[]
  /** The slice lifted out of the ring, shared with the list beside it. */
  hot?: number | null
  onHot?: (i: number | null) => void
  /** 'glass' draws round-capped slices parted by a small gap, on a track
   * that reads on frosted glass; the journal ring is unchanged. */
  variant?: 'journal' | 'glass'
}) {
  const glass = variant === 'glass'
  const total = values.reduce((a, b) => a + b, 0)
  const strokeW = glass ? 14 : 12
  // Room inside the box for a hovered slice to thicken without clipping.
  const r = size / 2 - 10
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r

  const dashes = values.map((v) => (total > 0 ? v / total : 0) * circumference)
  const starts = dashes.map((_, i) => dashes.slice(0, i).reduce((a, d) => a + d, 0))
  const segments = values.map((_, i) => {
    let dash = dashes[i]
    let offset = -starts[i]
    let cap: 'round' | 'butt' | undefined
    if (glass && values[i] <= 0) return null
    if (glass && values.length > 1) {
      if (dash > strokeW + 3) {
        // A round cap reaches half the stroke past each end of its dash, so
        // the slice is shortened by its two caps plus a gap and kept centred
        // on its share: it still covers exactly its own arc.
        dash -= strokeW + 3
        offset -= (strokeW + 3) / 2
        cap = 'round'
      } else {
        // Too small for caps: drawn square at its true length (less a hair
        // of gap), never inflated into a dot bigger than its share.
        const gap = Math.min(1.5, dash / 4)
        dash -= gap * 2
        offset -= gap
        cap = 'butt'
      }
    } else if (glass) {
      cap = 'round'
    }
    return (
      <circle
        key={i}
        className={`donut-seg ${hot === i ? 'hot' : ''}`}
        onMouseEnter={() => onHot?.(i)}
        onMouseLeave={() => onHot?.(null)}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={tinted ? tint(i, values.length) : colors?.[i] ?? 'var(--plat-other)'}
        strokeWidth={strokeW}
        strokeLinecap={cap}
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
      >
        {names?.[i] && <title>{`${names[i]} — ${total > 0 ? Math.round((values[i] / total) * 100) : 0}%`}</title>}
      </circle>
    )
  })

  return (
    <svg
      className={`donut ${hot !== null ? 'has-hot' : ''}`}
      width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      role="img" aria-label={label} style={{ flex: '0 0 auto' }}
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={glass ? 'var(--g-track)' : 'var(--paper-3)'} strokeWidth={strokeW} />
      {segments}
    </svg>
  )
}
