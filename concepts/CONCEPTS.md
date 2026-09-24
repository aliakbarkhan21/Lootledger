# Loot Ledger — React Migration Concepts

Three static mockups of the main transaction view, built to be genuinely different
readings of "personal finance UI," not three palettes on one shell. Each uses ~15
invented sample transactions (see `data.js`) — not real financial data. Fonts are
bundled locally in `fonts/` (woff2, no CDN calls). Screenshots at 1440px are in
`screenshots/`.

---

## 1. Terminal Board — `01-terminal-board.html`

Pushes the current app's departure-board idea further and more literally: a black
CRT panel with a live split-flap summary strip (opening balance, arrivals, departures,
running total rendered as four physical flap tiles per figure), scanline texture, a
blinking cursor clock, and a monospaced arrivals/departures ledger below. Where the
current app uses split-flap as an accent, this concept makes the whole screen behave
like the board — amber for outbound figures, phosphor green for inbound and status,
nothing else colored.

- **Fonts:** Oswald (condensed, signage-style headers/labels) + Space Mono (all
  figures, amounts, body data) — a airport-signage/terminal pairing, not the
  current app's Condensed-only system.
- **Palette:** Near-black void (`#050705`) panels, amber `#ffb300` for outbound
  figures and the wordmark, phosphor green `#39ff6a` for inbound figures and status,
  desaturated green-grey ink for body text. Two hues only, both with a glow/text-shadow
  to read as lit rather than printed.
- **Layout:** Full-bleed dark masthead + a 4-up split-flap summary strip + a single
  dense list panel (date / description / category chip / amount) with a status
  footer, evoking a station board rather than a dashboard of cards.

---

## 2. Ledger Journal — `02-ledger-journal.html`

An open accounting-ledger book page: a bound spine with vertical tabs (Sept /
Budgets / Assistant), a ruled double-entry table with debit and credit columns,
a wax-stamp "Balanced" mark, and italic serif "particulars" the way a hand-kept
journal names a transaction. This is the furthest concept from the board metaphor —
no split-flaps, no glow, no dark mode surface at all.

- **Fonts:** Spectral (serif, italic for entry descriptions, the wordmark) +
  Courier Prime (typewriter mono for entry numbers, dates, and all money figures) —
  a serif/typewriter pairing rather than a serif/grotesque-sans one.
- **Palette:** Pale ledger-green paper (`#e9efe0`), a green rule line for row
  dividers, a red margin rule and "Balanced" stamp for the ledger's traditional
  two-ink system, forest-black-green ink text, and a muted gold for tab/entry-number
  accents. Formula is "tinted ruled paper," not neutral cream plus one accent.
- **Layout:** A physical book on a darker desk background — spine, page tabs, a
  brought-forward/carried-forward summary band, then a ruled table. Structure is a
  page, not a panel or a card grid.

---

## 3. Receipt Strip — `03-receipt-strip.html`

A single narrow thermal-receipt strip centered on a dark desk backdrop, torn/perforated
at both edges, printed top to bottom: header, period, a dotted-rule transaction list
(description + category on one line, amount + date on the next), a totals block, and
a barcode footer. Reads as something handed to you at checkout, not a screen.

- **Fonts:** Barlow Condensed (all labels, descriptions, category tags — narrow,
  print-condensed) + Cutive Mono (wordmark and every dollar figure — a
  typewriter/receipt-printer face distinct from the other two concepts' monospace
  choices).
- **Palette:** Off-white receipt paper (`#f6f5ef`) on a near-black desk (`#1a1c22`),
  black ink text, brick red for outbound amounts, muted green for inbound — a
  print-and-desk contrast rather than a single-surface panel.
- **Layout:** One fixed-width vertical strip, not a full-width panel — perforated
  top/bottom edges, dashed item rules, a barcode + "keep this strip" sign-off. The
  narrowest and most literal of the three.

---

## Explicitly avoided

Per instruction, none of the three reuse Dossierbuild's or Paper Trail's design
language: no Inter, no Source Serif 4, no `#faf9f7`-style neutral cream with a single
desaturated accent, no 6/10/14/20px radius or `.card`/`.field`/`.btn` primitive system,
and no fixed sidebar-plus-sticky-topbar app shell. All three fonts pairs, palettes,
and structural shells here are original to this set.
