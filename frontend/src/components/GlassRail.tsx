import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BoardIcon, RepeatIcon, ScaleIcon } from './GlassIcons'

export type RailTarget = 'board' | 'recurring' | 'obligations'

const ITEMS: { id: RailTarget; label: string; icon: ReactNode }[] = [
  { id: 'board', label: 'Board', icon: <BoardIcon /> },
  { id: 'recurring', label: 'Recurring', icon: <RepeatIcon /> },
  { id: 'obligations', label: 'Obligations', icon: <ScaleIcon /> },
]

/** The Glass style's navigation: the book's three tabs as a floating pill
 * of icons down the left edge (a labelled bar along the bottom on narrow
 * screens). Each label lives inside its button, so it is the button's
 * accessible name and doubles as the tooltip.
 *
 * Tooltips wait on the first hover so a pointer crossing the rail does not
 * set them flashing, then answer instantly while the pointer stays on the
 * rail: once one tooltip has shown, the next is already expected. */
export default function GlassRail({ onGo }: { onGo: (id: RailTarget) => void }) {
  const [warm, setWarm] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <nav
      className="g-rail"
      aria-label="Board sections"
      data-warm={warm ? '' : undefined}
      onPointerLeave={() => {
        window.clearTimeout(timer.current)
        setWarm(false)
      }}
    >
      <span className="g-mark" aria-hidden="true">LL</span>
      <span className="g-rail-sep" aria-hidden="true" />
      {ITEMS.map((it) => (
        <button
          key={it.id}
          type="button"
          className="g-rail-btn"
          aria-current={it.id === 'board' ? 'true' : undefined}
          onClick={() => onGo(it.id)}
          onPointerEnter={(e) => {
            if (warm || e.pointerType !== 'mouse') return
            window.clearTimeout(timer.current)
            timer.current = window.setTimeout(() => setWarm(true), 420)
          }}
        >
          {it.icon}
          <span className="g-tip">{it.label}</span>
        </button>
      ))}
    </nav>
  )
}
