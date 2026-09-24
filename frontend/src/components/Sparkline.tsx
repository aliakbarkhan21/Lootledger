export default function Sparkline({ values, width = 104, height = 26, color = 'var(--gold)' }: {
  values: number[]
  width?: number
  height?: number
  color?: string
}) {
  if (values.length < 2) return <svg width={width} height={height} />
  const max = Math.max(...values, 0.0001)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const step = width / (values.length - 1)
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(' ')
  return (
    <svg width={width} height={height}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  )
}
