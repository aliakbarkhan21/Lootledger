import { useId, type CSSProperties, type SelectHTMLAttributes } from 'react'
import { useUi } from '../state/ui'
import { ChevronIcon } from './GlassIcons'
import { withOpenFlag } from '../lib/selectOpen'

/** A native select. In Glass it is followed by its own chevron, an inline
 * SVG anchored to the select's right edge (CSS anchor positioning, so the
 * select keeps its exact place in every layout it sits in), which turns to
 * point up while the list is open. In the journal it is the plain select. */
export default function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { style: look } = useUi()
  const id = useId()
  const flagged = withOpenFlag(props)
  if (look !== 'glass') return <select {...props} />
  const anchor = `--gsel-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <>
      <select {...flagged} style={{ ...props.style, anchorName: anchor } as CSSProperties} />
      <ChevronIcon className="g-select-chev" style={{ positionAnchor: anchor } as CSSProperties} />
    </>
  )
}
