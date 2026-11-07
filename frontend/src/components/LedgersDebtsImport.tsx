import { startTransition, useLayoutEffect, useRef, useState } from 'react'
import type { BoardRow, Currency } from '../api/types'
import { useUi, type LdiTab } from '../state/ui'
import LedgersTab from './LedgersTab'
import EditTab from './EditTab'
import DebtsTab from './DebtsTab'
import ImportTab from './ImportTab'
import { ChevronIcon } from './GlassIcons'

const TABS: { id: LdiTab; label: string }[] = [
  { id: 'ledgers', label: 'Ledgers' },
  { id: 'edit', label: 'Edit' },
  { id: 'debts', label: 'Debts' },
  { id: 'import', label: 'Import' },
]

export default function LedgersDebtsImport({
  arrivals, departures, currency, periodKey,
}: { arrivals: BoardRow[]; departures: BoardRow[]; currency: Currency; periodKey: string }) {
  const { ledgersOpen: open, setLedgersOpen: setOpen, ldiTab: tab, setLdiTab: setTab, style } = useUi()
  const glass = style === 'glass'
  const tabsRef = useRef<HTMLDivElement>(null)
  const [clip, setClip] = useState<{ ring: string; lit: string } | null>(null)
  const [ready, setReady] = useState(false)

  // Glass: the open sheet's thumb is a window onto a lit copy of the tab row,
  // clipped to the chosen tab. Moving the window (clip-path, on the ui
  // spring) carries the thumb and the lit label together, so the colour
  // changes exactly where the thumb is rather than cross-fading per tab.
  const clipFor = (id: LdiTab) => {
    const box = tabsRef.current
    const btn = box?.querySelector<HTMLElement>(`[data-tab="${id}"]`)
    if (!box || !btn || !box.offsetWidth) return null
    const w = box.clientWidth
    const h = box.clientHeight
    const t = btn.offsetTop
    const l = btn.offsetLeft
    const r = w - (l + btn.offsetWidth)
    const b = h - (t + btn.offsetHeight)
    return {
      ring: `inset(${t}px ${r}px ${b}px ${l}px round 999px)`,
      lit: `inset(${t + 1}px ${r + 1}px ${b + 1}px ${l + 1}px round 999px)`,
    }
  }

  // A click moves the thumb at once, by writing the window straight to the
  // two layers, and only then asks React for the new sheet, as a transition:
  // a heavy sheet renders in slices behind the moving thumb instead of
  // holding it still until the render is done.
  const choose = (id: LdiTab) => {
    const next = glass ? clipFor(id) : null
    const box = tabsRef.current
    if (next && box) {
      box.querySelector<HTMLElement>('.section-tabs-ring')?.style.setProperty('clip-path', next.ring)
      box.querySelector<HTMLElement>('.section-tabs-lit')?.style.setProperty('clip-path', next.lit)
    }
    if (glass) startTransition(() => setTab(id))
    else setTab(id)
  }

  useLayoutEffect(() => {
    if (!glass) return
    const box = tabsRef.current
    if (!box) return
    const measure = () => {
      const next = clipFor(tab)
      if (next) setClip(next)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    // The first placement lands at once; only later moves travel.
    const id = requestAnimationFrame(() => setReady(true))
    return () => { ro.disconnect(); cancelAnimationFrame(id) }
  }, [glass, tab])

  // Folded, the body stays mounted (and inert), so an import half-way through
  // or a row being edited is still there when it is opened again. The fold
  // itself is animated in board.css: the sheet drops open under the bar.
  return (
    <section id="ledgers-debts-import" className={`ldi ${open ? 'open' : ''}`}>
      <button
        className="ldi-toggle lg lg-lite"
        aria-expanded={open}
        aria-controls="ldi-body"
        onClick={() => setOpen(!open)}
      >
        {/* Glass draws the shared chevron, centred in its well, turning up while open; the journal keeps its gold mark. */}
        <span className="ldi-chevron" aria-hidden="true">{glass ? <ChevronIcon /> : '▸'}</span>
        <span className="ldi-title">Ledgers, debts and import</span>
        <span className="ldi-hint">{open ? 'Fold away' : 'Edit rows, settle debts, import a sheet'}</span>
      </button>
      <div id="ldi-body" className="ldi-body" inert={!open}>
        <div className="ldi-clip">
          <div className="ldi-sheet">
            <div className="section-tabs" role="tablist" ref={tabsRef}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  data-tab={t.id}
                  aria-selected={tab === t.id}
                  className={`section-tab ${tab === t.id ? 'active' : ''}`}
                  onClick={() => choose(t.id)}
                >
                  {t.label}
                </button>
              ))}
              {glass && clip && (
                <>
                  <span
                    className="section-tabs-ring"
                    aria-hidden="true"
                    data-ready={ready ? '' : undefined}
                    style={{ clipPath: clip.ring }}
                  />
                  <span
                    className="section-tabs-lit"
                    aria-hidden="true"
                    data-ready={ready ? '' : undefined}
                    style={{ clipPath: clip.lit }}
                  >
                    {TABS.map((t) => <span key={t.id} className="section-tab">{t.label}</span>)}
                  </span>
                </>
              )}
            </div>
            <div className="section-body lg lg-dense" role="tabpanel">
              {tab === 'ledgers' && (
                <LedgersTab arrivals={arrivals} departures={departures} currency={currency} periodKey={periodKey} />
              )}
              {tab === 'edit' && <EditTab currency={currency} />}
              {tab === 'debts' && <DebtsTab currency={currency} />}
              {tab === 'import' && <ImportTab currency={currency} />}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
