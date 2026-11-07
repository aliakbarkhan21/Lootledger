import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/** The Glass style's backdrop and the three things the glass needs from
 * script. Mounted only in Glass, so the journal never runs any of it.
 *
 * 1. The scene: a fixed layer behind the page with something for the glass
 *    to bend and frost. Soft orbs of light that drift (transform only), and a
 *    few sharp, faint things to distort: ledger rules, a large LL seal, thin
 *    arcs. All styling lives in glass.css.
 *
 * 2. Edge refraction (Chromium only). One SVG filter per refracting surface,
 *    each with a displacement map drawn for that surface's exact size and
 *    corner radius: neutral in the middle, bending only within a band at the
 *    rim, so a lens edge follows the curve of the corners. The filter keeps
 *    the rim lightly blurred and the body fully frosted, which is what makes
 *    the bend visible. A surface only switches to its filter once its map is
 *    drawn (data-lg-refract), so it never shows an unmapped frame.
 *
 * 3. Light that follows the pointer: one pointermove listener, throttled to
 *    a frame, writes --mx/--my on the glass card under the pointer (and
 *    rests while a dialog is open). And a
 *    data-lg-scrolled flag on the root once the page has moved, so the
 *    scroll-edge veil above the top bar only blurs when there is something
 *    under it. */

/** The surfaces that refract, by filter id. At most four. */
/* The bend must stay a lens and never a mirror. A point `d` px inside the
 * rim samples the backdrop at d + (scale / 2) * (1 - d / band)^2 further in;
 * that only keeps moving inward as d grows while scale < band. Past that the
 * mapping folds back on itself and the rim shows the content beside it
 * upside down. The red channel bends 10% further for the dispersion, so
 * scale stays at 0.8 of the band to keep even red clear of the fold. */
const REFRACT: { id: string; selector: string; band: number; scale: number }[] = [
  { id: 'lg-refract-bar', selector: '.g-topbar', band: 18, scale: 14 },
  { id: 'lg-refract-rail', selector: '.g-rail', band: 16, scale: 12 },
  { id: 'lg-refract-dock', selector: '.dock-paper', band: 28, scale: 22 },
  { id: 'lg-refract-hero', selector: '.fig-carried', band: 28, scale: 22 },
]

/** Chromium is the only engine that renders an SVG filter in
 * backdrop-filter; the CSS has the same gate in @supports. */
function canRefract(): boolean {
  if (typeof CSS === 'undefined' || !CSS.supports('backdrop-filter', 'url(#a)')) return false
  if (CSS.supports('-moz-appearance', 'none')) return false
  if (CSS.supports('font', '-apple-system-body')) return false
  return true
}

/** A displacement map for a rounded rectangle: R and G push the backdrop
 * along the outward normal within `band` px of the edge, easing to zero
 * (128) inward; B is the rim mask the filter uses to choose the lightly
 * blurred, displaced layer over the frosted one. */
function drawMap(w: number, h: number, radius: number, band: number): string {
  // Drawn at half size and stretched: the map is smooth, so this halves the
  // work with no visible difference.
  const s = 0.5
  const W = Math.max(2, Math.round(w * s))
  const H = Math.max(2, Math.round(h * s))
  const R = Math.min(radius * s, W / 2, H / 2)
  const B = band * s
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(W, H)
  const d = img.data
  for (let j = 0; j < H; j++) {
    const py = j + 0.5 - H / 2
    const qy = Math.abs(py) - (H / 2 - R)
    for (let i = 0; i < W; i++) {
      const px = i + 0.5 - W / 2
      const qx = Math.abs(px) - (W / 2 - R)
      const ox = Math.max(qx, 0)
      const oy = Math.max(qy, 0)
      // Signed distance to the rounded rectangle; depth is how far inside.
      const depth = -(Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - R)
      let nx = 0
      let ny = 0
      let f = 0
      let m = 0
      if (depth < B) {
        const t = 1 - Math.max(depth, 0) / B
        f = t * t
        m = Math.min(1, t * 1.5)
        if (qx > 0 && qy > 0) {
          const l = Math.hypot(ox, oy) || 1
          nx = (ox / l) * Math.sign(px)
          ny = (oy / l) * Math.sign(py)
        } else if (qx > qy) {
          nx = Math.sign(px)
        } else {
          ny = Math.sign(py)
        }
      }
      const k = (j * W + i) * 4
      d[k] = 128 - nx * f * 127
      d[k + 1] = 128 - ny * f * 127
      d[k + 2] = m * 255
      d[k + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL()
}

function useRefraction() {
  useEffect(() => {
    if (!canRefract()) return
    const sizes = new Map<string, string>()
    const maps = new Map<string, string>()
    const watched = new Map<Element, string>()
    let frame = 0

    const paint = (el: HTMLElement, spec: (typeof REFRACT)[number]) => {
      const w = el.offsetWidth
      const h = el.offsetHeight
      if (!w || !h) return
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
      const key = `${w}x${h}r${radius}`
      if (sizes.get(spec.id) === key && el.hasAttribute('data-lg-refract')) return
      const filter = document.getElementById(spec.id)
      const image = filter?.querySelector('feImage')
      if (!filter || !image) return
      // A surface goes back and forth between a few sizes (the slip open or
      // folded), so each map is drawn once per size and reused.
      const cacheKey = `${spec.id}:${key}`
      const url = maps.get(cacheKey) ?? drawMap(w, h, radius, spec.band)
      if (!url) return
      maps.set(cacheKey, url)
      for (const node of [filter, image]) {
        node.setAttribute('width', String(w))
        node.setAttribute('height', String(h))
      }
      image.setAttribute('href', url)
      sizes.set(spec.id, key)
      el.setAttribute('data-lg-refract', '')
    }

    // While a surface is resizing (the entry slip opening reflows the whole
    // board for half a second), it drops back to plain frost: resizing an SVG
    // filter's region re-samples its map every frame, and redrawing the map
    // is a per-pixel loop and a PNG encode. The lens returns, drawn for the
    // new size, once the size has held still.
    const settle = new Map<string, number>()
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement
        const spec = REFRACT.find((s) => s.id === watched.get(el))
        if (!spec) continue
        const key = `${el.offsetWidth}x${el.offsetHeight}`
        if (sizes.get(spec.id)?.startsWith(key + 'r')) continue
        el.removeAttribute('data-lg-refract')
        window.clearTimeout(settle.get(spec.id))
        // Long enough for the slip's fold (500ms) to finish first, so the lens
        // never switches back on mid-motion.
        settle.set(spec.id, window.setTimeout(() => paint(el, spec), 620))
      }
    })

    // The surfaces mount after the board loads and the dock can fold, so
    // look again whenever the tree changes (at most once a frame).
    const scan = () => {
      frame = 0
      for (const spec of REFRACT) {
        const el = document.querySelector<HTMLElement>(spec.selector)
        if (!el || watched.has(el)) continue
        for (const [old, id] of watched) {
          if (id === spec.id) { ro.unobserve(old); watched.delete(old) }
        }
        watched.set(el, spec.id)
        ro.observe(el)
        paint(el, spec)
      }
    }
    const mo = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(scan)
    })
    mo.observe(document.body, { childList: true, subtree: true })
    scan()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      for (const t of settle.values()) window.clearTimeout(t)
      mo.disconnect()
      ro.disconnect()
      for (const el of watched.keys()) el.removeAttribute('data-lg-refract')
    }
  }, [])
}

function usePointerLight() {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    let frame = 0
    let x = 0
    let y = 0
    let target: EventTarget | null = null
    const update = () => {
      frame = 0
      const card = target instanceof Element ? target.closest<HTMLElement>('.lg:not(.lg-chrome)') : null
      if (!card) return
      const r = card.getBoundingClientRect()
      card.style.setProperty('--mx', `${Math.round(x - r.left)}px`)
      card.style.setProperty('--my', `${Math.round(y - r.top)}px`)
    }
    const root = document.documentElement
    const onMove = (e: PointerEvent) => {
      // Under an open dialog the page is still and the light holds where it
      // was: no per-move style writes while the dialog scrolls.
      if (root.hasAttribute('data-modal-open')) return
      x = e.clientX
      y = e.clientY
      target = e.target
      if (!frame) frame = requestAnimationFrame(update)
    }
    document.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      document.removeEventListener('pointermove', onMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
}

function useScrolledFlag() {
  useEffect(() => {
    const root = document.documentElement
    let on: boolean | null = null
    let idle = 0
    const check = () => {
      const now = window.scrollY > 4
      if (now === on) return
      on = now
      if (now) root.setAttribute('data-lg-scrolled', '')
      else root.removeAttribute('data-lg-scrolled')
    }
    // While the page is moving, the orbs hold still: every blurred pane is
    // already redrawing as content passes beneath it, and a drift of a few
    // pixels over a second of scrolling is invisible. They resume when the
    // scroll settles.
    const onScroll = () => {
      check()
      if (!idle) root.setAttribute('data-lg-scrolling', '')
      window.clearTimeout(idle)
      idle = window.setTimeout(() => { idle = 0; root.removeAttribute('data-lg-scrolling') }, 180)
    }
    check()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(idle)
      root.removeAttribute('data-lg-scrolled')
      root.removeAttribute('data-lg-scrolling')
    }
  }, [])
}

/** The refraction filter. The backdrop is displaced along the map (sharp,
 * so the bend reads), the red channel a little further than green and blue
 * for a hint of dispersion, then laid over the frosted backdrop only where
 * the map's rim mask is set. The middle is frost alone, so nothing there
 * moves. Both displacements sample inward, along the map, so they never
 * reach past the pane's own backdrop: an offset copy of a channel did, and
 * left a red and cyan fringe down the pane's right edge. */
function RefractFilter({ id, scale }: { id: string; scale: number }) {
  return (
    <filter
      id={id}
      x="0"
      y="0"
      width="1"
      height="1"
      filterUnits="userSpaceOnUse"
      primitiveUnits="userSpaceOnUse"
      colorInterpolationFilters="sRGB"
    >
      <feImage x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map" />
      <feGaussianBlur in="SourceGraphic" stdDeviation="18" edgeMode="duplicate" result="frost" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" result="bent" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale={scale * 1.1} xChannelSelector="R" yChannelSelector="G" result="bentRed" />
      <feColorMatrix in="bentRed" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
      <feColorMatrix in="bent" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb" />
      <feBlend in="r" in2="gb" mode="screen" result="rim" />
      <feColorMatrix in="map" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0" result="mask" />
      <feComposite in="rim" in2="mask" operator="in" result="lens" />
      <feMerge>
        <feMergeNode in="frost" />
        <feMergeNode in="lens" />
      </feMerge>
    </filter>
  )
}

export default function GlassScene() {
  useRefraction()
  usePointerLight()
  useScrolledFlag()

  return createPortal(
    <div className="lg-scene" aria-hidden="true">
      <div className="lg-orb lg-orb-1" />
      <div className="lg-orb lg-orb-2" />
      <div className="lg-orb lg-orb-3" />
      <div className="lg-orb lg-orb-4" />
      <div className="lg-orb lg-orb-5" />
      <div className="lg-rules" />
      <svg className="lg-arcs" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        {/* Placed to cross the floating glass at 1440x900: the top bar, the
            entry slip and Carried forward, so their rims have a curve to bend. */}
        <circle cx="1150" cy="1250" r="1200" />
        <circle cx="1404" cy="545" r="120" />
        <circle cx="300" cy="900" r="330" />
        <circle cx="1480" cy="-120" r="760" />
      </svg>
      <div className="lg-seal">LL</div>
      <svg className="lg-defs" width="0" height="0" focusable="false">
        {REFRACT.map((r) => <RefractFilter key={r.id} id={r.id} scale={r.scale} />)}
      </svg>
    </div>,
    document.body,
  )
}
