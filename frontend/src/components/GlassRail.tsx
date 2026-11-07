import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { BoardIcon, RepeatIcon, ScaleIcon } from './GlassIcons'

export type RailTarget = 'board' | 'recurring' | 'obligations'

const ITEMS: { id: RailTarget; label: string; icon: ReactNode }[] = [
  // In the order the sections run down the page: Obligations, then Recurring.
  { id: 'board', label: 'Board', icon: <BoardIcon /> },
  { id: 'obligations', label: 'Obligations', icon: <ScaleIcon /> },
  { id: 'recurring', label: 'Recurring', icon: <RepeatIcon /> },
]

/** Which section the reader is in: the last one whose top has passed the
 * upper part of the window. Obligations sits above Recurring on the page. */
function sectionInView(): RailTarget {
  const line = window.innerHeight * 0.4
  const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
  const top = (id: string) => document.getElementById(id)?.getBoundingClientRect().top ?? Infinity
  if (top('recurring') <= line || (atBottom && top('recurring') < window.innerHeight)) return 'recurring'
  if (top('obligations') <= line) return 'obligations'
  return 'board'
}

/** The Glass style's navigation: the book's three tabs as a floating pill
 * of icons down the left edge (a labelled bar along the bottom on narrow
 * screens). Each label lives inside its button, so it is the button's
 * accessible name and doubles as the tooltip.
 *
 * One highlight marks the current section and travels between buttons on a
 * spring. It follows a click at once, and otherwise follows the reader's
 * scroll; while a click's own scroll is under way the scroll is not read,
 * so the highlight does not stop at sections passed on the way.
 *
 * Tooltips wait on the first hover so a pointer crossing the rail does not
 * set them flashing, then answer instantly while the pointer stays on the
 * rail: once one tooltip has shown, the next is already expected. */
export default function GlassRail({ onGo }: { onGo: (id: RailTarget) => void }) {
  const [warm, setWarm] = useState(false)
  const [current, setCurrent] = useState<RailTarget>('board')
  const timer = useRef<number | undefined>(undefined)
  const nav = useRef<HTMLElement>(null)
  const thumb = useRef<HTMLSpanElement>(null)
  const buttons = useRef(new Map<RailTarget, HTMLButtonElement>())
  const lockUntil = useRef(0)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // The highlight is one layer over the whole rail, clipped to the current
  // button: moving it changes only its clip, which the compositor animates.
  const place = useCallback(() => {
    const t = thumb.current
    const n = nav.current
    const b = buttons.current.get(current)
    if (!t || !n || !b) return
    const top = b.offsetTop
    const left = b.offsetLeft
    const right = n.clientWidth - left - b.offsetWidth
    const bottom = n.clientHeight - top - b.offsetHeight
    t.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round ${b.offsetHeight / 2}px)`
  }, [current])

  useLayoutEffect(() => {
    place()
    // The first placement (and any after a resize) lands without travelling.
    if (thumb.current && !thumb.current.hasAttribute('data-ready')) {
      void thumb.current.offsetWidth
      thumb.current.setAttribute('data-ready', '')
    }
  }, [place])

  // The rail changes shape at the narrow-screen breakpoint and with text size.
  useEffect(() => {
    const n = nav.current
    if (!n) return
    const ro = new ResizeObserver(() => {
      const t = thumb.current
      if (!t) return
      t.removeAttribute('data-ready')
      place()
      void t.offsetWidth
      t.setAttribute('data-ready', '')
    })
    ro.observe(n)
    return () => ro.disconnect()
  }, [place])

  // Follow the reader's own scrolling.
  useEffect(() => {
    let frame = 0
    const read = () => {
      frame = 0
      if (performance.now() < lockUntil.current) return
      setCurrent(sectionInView())
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read) }
    const onScrollEnd = () => { lockUntil.current = 0 }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scrollend', onScrollEnd, { passive: true })
    // A wheel, touch or key during a click's scroll hands control back.
    const release = () => { lockUntil.current = 0 }
    window.addEventListener('wheel', release, { passive: true })
    window.addEventListener('touchstart', release, { passive: true })
    window.addEventListener('keydown', release)
    read()
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('scrollend', onScrollEnd)
      window.removeEventListener('wheel', release)
      window.removeEventListener('touchstart', release)
      window.removeEventListener('keydown', release)
    }
  }, [])

  return (
    <nav
      ref={nav}
      className="g-rail lg lg-chrome"
      aria-label="Board sections"
      data-warm={warm ? '' : undefined}
      onPointerLeave={() => {
        window.clearTimeout(timer.current)
        setWarm(false)
      }}
    >
      <span ref={thumb} className="g-rail-thumb" aria-hidden="true" />
      <span className="g-mark" aria-hidden="true">LL</span>
      <span className="g-rail-sep" aria-hidden="true" />
      {ITEMS.map((it) => (
        <button
          key={it.id}
          ref={(el) => {
            if (el) buttons.current.set(it.id, el)
            else buttons.current.delete(it.id)
          }}
          type="button"
          className="g-rail-btn"
          aria-current={it.id === current ? 'true' : undefined}
          onClick={() => {
            // Ignore the scroll this click starts until it settles (scrollend),
            // with a ceiling for browsers that do not fire it.
            lockUntil.current = performance.now() + 1500
            setCurrent(it.id)
            onGo(it.id)
          }}
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
