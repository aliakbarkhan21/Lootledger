import type { ReactNode } from 'react'

/** The Glass style's icon set: one authored family on a 24 grid at 1.6
 * stroke, round caps and joins, drawn in currentColor so every icon takes
 * the ink of the control it sits in. Decorative: the control carries the
 * accessible name. */
function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
    >
      {children}
    </svg>
  )
}

/** The board: four panes of unequal size. */
export const BoardIcon = () => (
  <Icon>
    <rect x="3.5" y="3.5" width="7" height="9.5" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="5.5" rx="2" />
    <rect x="13.5" y="12" width="7" height="8.5" rx="2" />
    <rect x="3.5" y="16" width="7" height="4.5" rx="2" />
  </Icon>
)

/** Recurring: the same entry coming round again. */
export const RepeatIcon = () => (
  <Icon>
    <path d="M17 3.5l3 3-3 3" />
    <path d="M4 11.5v-.5a4.5 4.5 0 0 1 4.5-4.5H20" />
    <path d="M7 20.5l-3-3 3-3" />
    <path d="M20 12.5v.5a4.5 4.5 0 0 1-4.5 4.5H4" />
  </Icon>
)

/** Obligations: what is owed each way, weighed against each other. */
export const ScaleIcon = () => (
  <Icon>
    <path d="M12 4v16" />
    <path d="M8.5 20h7" />
    <path d="M5 7.5h14" />
    <path d="M5 7.5L2.5 13a2.5 2.5 0 0 0 5 0z" />
    <path d="M19 7.5L16.5 13a2.5 2.5 0 0 0 5 0z" />
  </Icon>
)

export const SearchIcon = () => (
  <Icon size={18}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </Icon>
)

export const CalendarIcon = () => (
  <Icon size={18}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17" />
    <path d="M8 3v4" />
    <path d="M16 3v4" />
  </Icon>
)

export const ChevronIcon = () => (
  <Icon size={16}>
    <path d="M6.5 9.5l5.5 5.5 5.5-5.5" />
  </Icon>
)

export const MoonIcon = () => (
  <Icon>
    <path d="M19.5 14.6A7.6 7.6 0 0 1 9.4 4.5a7.6 7.6 0 1 0 10.1 10.1z" />
  </Icon>
)

export const SunIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Icon>
)

/** The other style: the Ledger Journal, an open book. */
export const BookIcon = () => (
  <Icon>
    <path d="M12 6.5C10 5 7 4.6 3.5 5v13c3.5-.4 6.5 0 8.5 1.5 2-1.5 5-1.9 8.5-1.5V5C17 4.6 14 5 12 6.5z" />
    <path d="M12 6.5v13" />
  </Icon>
)

/** The Finance Bot. */
export const SparkIcon = () => (
  <Icon>
    <path d="M11 3.5c.7 3.9 2.6 5.8 6.5 6.5-3.9.7-5.8 2.6-6.5 6.5-.7-3.9-2.6-5.8-6.5-6.5 3.9-.7 5.8-2.6 6.5-6.5z" />
    <path d="M18.5 15.5c.3 1.5 1 2.2 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.3 2.2-1 2.5-2.5z" />
  </Icon>
)

/** Settings: two sliders. */
export const SlidersIcon = () => (
  <Icon>
    <path d="M4 7.5h9M17 7.5h3M4 16.5h3M11 16.5h9" />
    <circle cx="15" cy="7.5" r="2" />
    <circle cx="9" cy="16.5" r="2" />
  </Icon>
)
