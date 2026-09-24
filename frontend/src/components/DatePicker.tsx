import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatDisplayDate, todayIso } from '../lib/money'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December']
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DOW_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const GAP = 6
const EDGE = 8

function parts(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? [Number(m[1]), Number(m[2]) - 1, Number(m[3])] : null
}

function toIso(y: number, m: number, d: number): string {
  // Through Date so month and day overflow roll over (the 32nd is the 1st).
  const t = new Date(y, m, d)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
}

function shiftDays(iso: string, n: number): string {
  const [y, m, d] = parts(iso)!
  return toIso(y, m, d + n)
}

function shiftMonths(iso: string, n: number): string {
  const [y, m, d] = parts(iso)!
  const last = new Date(y, m + n + 1, 0).getDate()
  return toIso(y, m + n, Math.min(d, last))
}

/** A date field whose calendar is drawn on the ledger's own paper, in place of
 * the browser's picker (which ignores the page's theme). The value is an ISO
 * date, YYYY-MM-DD, or '' when `clearable` allows none. Arrow keys move by
 * day and week, Page Up/Down by month, Enter picks, Escape closes. */
export default function DatePicker({
  value, onChange, label, clearable = false, className = '',
}: {
  value: string
  onChange: (iso: string) => void
  label: string
  clearable?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => (parts(value) ? value : todayIso()))
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  // Set when the focused day should follow the cursor: on opening and on
  // arrow-key moves, not when the month buttons are clicked.
  const focusDay = useRef(false)
  const today = todayIso()

  const [cy, cm] = parts(cursor)!
  const weeks = useMemo(() => {
    const lead = (new Date(cy, cm, 1).getDay() + 6) % 7
    const days = new Date(cy, cm + 1, 0).getDate()
    const cells: (string | null)[] = Array(lead).fill(null)
    for (let d = 1; d <= days; d++) cells.push(toIso(cy, cm, d))
    while (cells.length % 7 !== 0) cells.push(null)
    const rows: (string | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    return rows
  }, [cy, cm])

  const place = useCallback(() => {
    const t = trigger.current?.getBoundingClientRect()
    const p = pop.current
    if (!t || !p) return
    const w = p.offsetWidth
    const h = p.offsetHeight
    const roomBelow = window.innerHeight - t.bottom - GAP - EDGE
    const above = roomBelow < h && t.top - GAP - EDGE > roomBelow
    const top = above ? Math.max(EDGE, t.top - GAP - h) : Math.min(t.bottom + GAP, window.innerHeight - EDGE - h)
    const left = Math.min(Math.max(EDGE, t.left), window.innerWidth - EDGE - w)
    setPos({ top, left, above })
  }, [])

  function show() {
    setCursor(parts(value) ? value : today)
    setPos(null)
    focusDay.current = true
    setOpen(true)
  }

  function close(refocus: boolean) {
    setOpen(false)
    if (refocus) trigger.current?.focus({ preventScroll: true })
  }

  function pick(iso: string) {
    onChange(iso)
    close(true)
  }

  // Measured before paint, so the sheet never shows in the wrong place.
  useLayoutEffect(() => { if (open) place() }, [open, place, weeks.length])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!pop.current?.contains(target) && !trigger.current?.contains(target)) close(false)
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  useEffect(() => {
    if (!open || !pos || !focusDay.current) return
    focusDay.current = false
    pop.current?.querySelector<HTMLButtonElement>(`[data-iso="${cursor}"]`)?.focus({ preventScroll: true })
  }, [open, pos, cursor])

  function onGridKey(e: React.KeyboardEvent) {
    const weekday = (new Date(cy, cm, parts(cursor)![2]).getDay() + 6) % 7 // Monday = 0
    const moves: Record<string, () => string> = {
      ArrowLeft: () => shiftDays(cursor, -1),
      ArrowRight: () => shiftDays(cursor, 1),
      ArrowUp: () => shiftDays(cursor, -7),
      ArrowDown: () => shiftDays(cursor, 7),
      Home: () => shiftDays(cursor, -weekday),
      End: () => shiftDays(cursor, 6 - weekday),
      PageUp: () => shiftMonths(cursor, e.shiftKey ? -12 : -1),
      PageDown: () => shiftMonths(cursor, e.shiftKey ? 12 : 1),
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    focusDay.current = true
    setCursor(move())
  }

  const shown = parts(value) ? formatDisplayDate(value) : ''

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`dp-field ${open ? 'open' : ''} ${className}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${shown || 'none'}`}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && e.altKey && !open) { e.preventDefault(); show() } }}
      >
        <span className={shown ? '' : 'dp-placeholder'}>{shown || 'dd/mm/yyyy'}</span>
        <svg className="dp-glyph" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="1.5" y="3" width="13" height="11.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M1.5 6.5h13M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.3" fill="none" />
        </svg>
      </button>
      {open && createPortal(
        <div
          ref={pop}
          className={`dp-pop ${pos?.above ? 'above' : ''}`}
          role="dialog"
          aria-label={`Choose ${label.toLowerCase()}`}
          style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close(true) } }}
          onBlur={(e) => {
            const next = e.relatedTarget as Node | null
            if (next && !pop.current?.contains(next) && next !== trigger.current) close(false)
          }}
        >
          <div className="dp-head">
            <button type="button" className="icon-btn dp-nav" aria-label="Previous month" onClick={() => setCursor(shiftMonths(cursor, -1))}>‹</button>
            <div className="dp-title" aria-live="polite">{MONTHS[cm]} <span>{cy}</span></div>
            <button type="button" className="icon-btn dp-nav" aria-label="Next month" onClick={() => setCursor(shiftMonths(cursor, 1))}>›</button>
          </div>
          <div className="dp-grid" role="grid" aria-label={`${MONTHS[cm]} ${cy}`} onKeyDown={onGridKey}>
            <div className="dp-dow" role="row">
              {DOW.map((d, i) => <span key={i} role="columnheader" aria-label={DOW_FULL[i]}>{d}</span>)}
            </div>
            {weeks.map((week, wi) => (
              <div className="dp-week" role="row" key={wi}>
                {week.map((iso, di) => iso === null ? (
                  <span className="dp-blank" role="gridcell" key={di} />
                ) : (
                  <button
                    key={di}
                    type="button"
                    role="gridcell"
                    data-iso={iso}
                    tabIndex={iso === cursor ? 0 : -1}
                    aria-selected={iso === value}
                    aria-current={iso === today ? 'date' : undefined}
                    aria-label={`${DOW_FULL[di]} ${Number(iso.slice(8))} ${MONTHS[cm]} ${cy}`}
                    className={[
                      'dp-day',
                      iso === value ? 'picked' : '',
                      iso === today ? 'today' : '',
                      iso > today ? 'ahead' : '',
                    ].join(' ')}
                    onClick={() => pick(iso)}
                  >
                    {Number(iso.slice(8))}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="dp-foot">
            <button type="button" className="btn-link dp-quick" onClick={() => pick(today)}>Today</button>
            <button type="button" className="btn-link dp-quick" onClick={() => pick(shiftDays(today, -1))}>Yesterday</button>
            {clearable && value && (
              <button type="button" className="btn-link danger dp-quick clear" onClick={() => pick('')}>Clear</button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
