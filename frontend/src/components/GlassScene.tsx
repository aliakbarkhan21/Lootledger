import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'

/** Set by vite.config.ts: whether frontend/public/glass-backdrop.jpg exists. */
declare const __GLASS_BACKDROP__: boolean

/** The Glass style's backdrop and the two things the glass needs from
 * script. Mounted only in Glass, so the journal never runs any of it.
 *
 * 1. The scene: a soft, neutral field with a few large grey shapes in it,
 *    drawn once into a small canvas and blurred there, then stretched to the
 *    window, so the sheet has something to frost and some depth. It is a
 *    picture, not an animation: it is redrawn only when the theme or the
 *    window's shape changes, so the sheet's blur above it has nothing to
 *    recompute while the page sits still. Its colours are the --lg-scene-*
 *    tokens in glass.css, all neutral grey. It shows only outside the sheet,
 *    which is opaque. With a photo in
 *    public/glass-backdrop.jpg the photo is shown instead (glass.css).
 *
 * 2. Light that follows the pointer: one pointermove listener, throttled to
 *    a frame, writes --mx/--my on the card under the pointer (and rests
 *    while a dialog is open).
 *
 * 3. The board cut off at the stuck top bar's top edge, so what scrolls up
 *    under the bar is never drawn in the gap above it (the gap shows the
 *    sheet, with no layer over it): a window that sticks at the bar's top
 *    edge, with the board moved inside it on the compositor by the page's
 *    scroll (see useUnderBarCut). Ways measured and dropped: a mask moved
 *    from a scroll listener (a frame behind a fast touchpad scroll), the
 *    same on each of the page's children (~30ms a frame), anything on .page
 *    itself (the bar's backdrop root: the board under the bar unblurred), a
 *    scroll-driven clip-path animation (Chrome's compositor painted rows
 *    above the bar) and clip-path set on scroll (p95 18ms against 4ms). */

const SCENE = ['top', 'mid', 'low', 'light', 'shape-1', 'shape-2', 'shape-3'] as const
type Scene = Record<(typeof SCENE)[number], string>

function readScene(): Scene {
  const cs = getComputedStyle(document.documentElement)
  const scene = {} as Scene
  for (const k of SCENE) scene[k] = cs.getPropertyValue(`--lg-scene-${k}`).trim() || '#f2f2f4'
  return scene
}

/** Three box passes each way: close to a gaussian, and on a canvas a few
 * hundred pixels across it costs well under a millisecond. */
function blur(img: ImageData, r: number) {
  const { width: w, height: h, data } = img
  const tmp = new Float32Array(data.length)
  const pass = (src: ArrayLike<number>, dst: Float32Array | Uint8ClampedArray, horizontal: boolean) => {
    const lines = horizontal ? h : w
    const len = horizontal ? w : h
    const step = horizontal ? 4 : w * 4
    const span = 2 * r + 1
    for (let line = 0; line < lines; line++) {
      const base = horizontal ? line * w * 4 : line * 4
      for (let ch = 0; ch < 4; ch++) {
        let sum = 0
        // Edge pixels repeat outward, so the frame never darkens at its rim.
        for (let i = -r; i <= r; i++) sum += src[base + Math.min(len - 1, Math.max(0, i)) * step + ch]
        for (let i = 0; i < len; i++) {
          dst[base + i * step + ch] = sum / span
          const add = Math.min(len - 1, i + r + 1)
          const drop = Math.max(0, i - r)
          sum += src[base + add * step + ch] - src[base + drop * step + ch]
        }
      }
    }
  }
  for (let n = 0; n < 3; n++) {
    pass(data, tmp, true)
    pass(tmp, data, false)
  }
}

/** The scene, in fractions of the frame so it holds its composition on a
 * phone held upright as well as on a wide screen. Hard shapes on purpose:
 * the blur afterwards is what makes them read as things out of focus behind
 * the glass rather than a gradient poster. */
function paintScene(canvas: HTMLCanvasElement, scene: Scene) {
  const H = 180
  const aspect = window.innerWidth / Math.max(1, window.innerHeight)
  const W = Math.round(Math.min(440, Math.max(84, H * aspect)))
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d', { willReadFrequently: true })
  if (!c) return
  const box = (u0: number, v0: number, u1: number, v1: number, color: string, alpha = 1) => {
    c.globalAlpha = alpha
    c.fillStyle = color
    c.fillRect(u0 * W, v0 * H, (u1 - u0) * W, (v1 - v0) * H)
  }
  const blob = (u: number, v: number, ru: number, rv: number, color: string, alpha = 1) => {
    c.globalAlpha = alpha
    c.fillStyle = color
    c.beginPath()
    c.ellipse(u * W, v * H, ru * W, rv * H, 0, 0, Math.PI * 2)
    c.fill()
  }

  // The field: a soft top-to-bottom fall of light.
  const field = c.createLinearGradient(0, 0, 0, H)
  field.addColorStop(0, scene.top)
  field.addColorStop(0.45, scene.mid)
  field.addColorStop(1, scene.low)
  c.fillStyle = field
  c.fillRect(0, 0, W, H)

  // A few large, soft shapes for the sheet to frost.
  blob(0.08, 0.18, 0.2, 0.34, scene['shape-1'], 0.9)
  box(0.3, -0.1, 0.46, 0.42, scene['shape-2'], 0.85)
  blob(0.62, 0.78, 0.24, 0.3, scene['shape-1'], 0.75)
  box(0.78, 0.08, 0.9, 0.62, scene['shape-3'], 0.9)
  blob(0.2, 0.92, 0.22, 0.16, scene['shape-2'], 0.8)
  // Light from the upper right.
  blob(0.98, 0.12, 0.2, 0.3, scene.light, 0.9)
  blob(0.5, 0.48, 0.12, 0.16, scene.light, 0.6)
  c.globalAlpha = 1

  const img = c.getImageData(0, 0, W, H)
  blur(img, Math.round(H * 0.05))
  c.putImageData(img, 0, 0)
}

function useScene(canvas: RefObject<HTMLCanvasElement | null>) {
  useLayoutEffect(() => {
    const el = canvas.current
    if (!el) return
    const root = document.documentElement
    let last = ''
    const draw = () => {
      const scene = readScene()
      const key = `${JSON.stringify(scene)}|${Math.round((window.innerWidth / Math.max(1, window.innerHeight)) * 20)}`
      if (key === last) return
      last = key
      paintScene(el, scene)
    }
    draw()
    // A new theme changes the palette; a new window shape, the composition.
    const mo = new MutationObserver(draw)
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-style'] })
    let t = 0
    const onResize = () => {
      window.clearTimeout(t)
      t = window.setTimeout(draw, 150)
    }
    window.addEventListener('resize', onResize)
    return () => {
      mo.disconnect()
      window.removeEventListener('resize', onResize)
      window.clearTimeout(t)
    }
  }, [canvas])
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

/** The bar sticks only where this matches (glass.css); elsewhere it scrolls
 * with the page and nothing needs cutting. */
const STICKS = '(min-width: 641px) and (min-height: 561px)'

/** Scroll-driven animations (Chrome 115+): the board's window needs them;
 * without them the mask below stands in. */
type ScrollTimelineCtor = new (options: { source: Element; axis: 'block' }) => AnimationTimeline
const ScrollTimelineImpl = (window as unknown as { ScrollTimeline?: ScrollTimelineCtor }).ScrollTimeline

/** The board cut off at the stuck bar's top edge, in the compositor's frame.
 *
 * .board-body is a window that sticks with its top at the bar's top edge and
 * clips there; .board-scroll, the board, is moved inside it by a transform
 * driven by the page's scroll (a ScrollTimeline, run on the compositor), at
 * exactly the rate the window holds still, so the board scrolls as before;
 * .board-tail stands in for the board's height in the page's flow. Window
 * and board both move in the compositor's frame, so however fast a touchpad
 * scrolls, nothing of the board is drawn in the gap above the bar. A mask
 * moved from a scroll listener ran a frame behind: a fast scroll showed a
 * strip of the board above the bar, wider the faster it went.
 *
 * Measured, not per frame: once now, and again when the board, the bar or
 * the window changes size. */
function useUnderBarCut() {
  useEffect(() => {
    const page = document.querySelector<HTMLElement>('.page')
    const desk = document.querySelector<HTMLElement>('.desk')
    if (!page || !desk) return
    if (!ScrollTimelineImpl) return maskCut(page)
    const Timeline = ScrollTimelineImpl
    const sticks = window.matchMedia(STICKS)
    const root = document.documentElement
    let body: HTMLElement | null = null
    let board: HTMLElement | null = null
    let tail: HTMLElement | null = null
    let anim: Animation | null = null
    let last = ''
    let frame = 0
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    const ro = new ResizeObserver(schedule)

    const off = () => {
      anim?.cancel()
      anim = null
      last = ''
      if (body) {
        delete body.dataset.lgWindow
        for (const k of ['top', 'height', 'margin-top', 'padding-top']) body.style.removeProperty(k)
      }
      tail?.style.removeProperty('height')
      page.style.removeProperty('padding-bottom')
      desk.style.removeProperty('padding-bottom')
    }

    function measure() {
      frame = 0
      const b = page!.querySelector<HTMLElement>(':scope > .board-body')
      const s = b?.querySelector<HTMLElement>(':scope > .board-scroll') ?? null
      const t = page!.querySelector<HTMLElement>(':scope > .board-tail')
      const wrap = page!.querySelector<HTMLElement>(':scope > .g-topbar-wrap')
      if (b !== body || s !== board || t !== tail) {
        off()
        if (board) ro.unobserve(board)
        body = b
        board = s
        tail = t
        if (board) ro.observe(board)
      }
      if (!body || !board || !tail || !wrap || !sticks.matches) {
        off()
        return
      }
      // The page's and the desk's foot room, as laid out without the window
      // (the window moves it into the tail, where the window can use it).
      page!.style.removeProperty('padding-bottom')
      desk!.style.removeProperty('padding-bottom')
      const foot = (parseFloat(getComputedStyle(page!).paddingBottom) || 0) + (parseFloat(getComputedStyle(desk!).paddingBottom) || 0)
      const gap = parseFloat(getComputedStyle(wrap).paddingTop) || 0
      // From the bar's top edge to the board's first row.
      // (Box heights unrounded: a fraction lost here left the window a
      // fraction of a pixel short of the bar at the very end of the page.)
      const lead = wrap.getBoundingClientRect().height - gap
      const view = window.innerHeight - gap
      const run = lead + board.getBoundingClientRect().height + foot - view
      if (run <= 0) {
        // The board fits under the bar: nothing ever scrolls up to it.
        off()
        return
      }
      body.dataset.lgWindow = ''
      body.style.top = `${gap}px`
      body.style.height = `${view}px`
      body.style.marginTop = `${-lead}px`
      body.style.paddingTop = `${lead}px`
      // Two pixels to spare, so the window still holds at the very end of the
      // page however the browser rounds the scroll range.
      tail.style.height = `${run + 2}px`
      page!.style.paddingBottom = '0px'
      desk!.style.paddingBottom = '0px'
      // The window sticks from the scroll at which the bar's top reaches the
      // gap, and holds there to the end of the page; the board moves up by
      // the same amount over the same range.
      const start = Math.max(0, page!.getBoundingClientRect().top + window.scrollY - gap)
      const max = root.scrollHeight - window.innerHeight
      if (start >= max) return
      const key = `${max}|${start}`
      if (key === last && anim) return
      last = key
      anim?.cancel()
      anim = null
      anim = board.animate(
        [
          { transform: 'translateY(0px)', offset: 0 },
          { transform: 'translateY(0px)', offset: start / max },
          { transform: `translateY(${-(max - start)}px)`, offset: 1 },
        ],
        { timeline: new Timeline({ source: root, axis: 'block' }), fill: 'both', easing: 'linear' },
      )
    }

    measure()
    ro.observe(page)
    const wrapEl = page.querySelector<HTMLElement>(':scope > .g-topbar-wrap')
    if (wrapEl) ro.observe(wrapEl)
    const mo = new MutationObserver(schedule)
    mo.observe(page, { childList: true })
    window.addEventListener('resize', schedule)
    sticks.addEventListener('change', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', schedule)
      sticks.removeEventListener('change', schedule)
      off()
    }
  }, [])
}

/** How far the fallback mask reaches past the board on every side, so
 * nothing a card paints outside its row (a hover lift, a soft shadow) is cut
 * anywhere but at the bar (glass.css sizes and places the mask to match). */
const CUT_REACH = 400

/** Without scroll-driven animations: a hard-edged mask on .board-body, moved
 * on scroll. It runs a frame behind a fast scroll, which the window above
 * does not. Never on .page: a mask on the bar's own ancestor makes it the
 * bar's backdrop root, and the board under the bar is drawn unblurred. */
function maskCut(page: HTMLElement) {
  const sticks = window.matchMedia(STICKS)
  let body: HTMLElement | null = null
  let last = ''
  const clear = () => {
    if (body) {
      body.style.removeProperty('mask-image')
      body.style.removeProperty('-webkit-mask-image')
      delete body.dataset.lgCut
    }
    last = ''
  }
  const apply = () => {
    const found = page.querySelector<HTMLElement>(':scope > .board-body')
    if (found !== body) {
      clear()
      body = found
    }
    const wrap = page.querySelector<HTMLElement>(':scope > .g-topbar-wrap')
    if (!body || !wrap || !sticks.matches) {
      if (last) clear()
      return
    }
    const gap = parseFloat(getComputedStyle(wrap).paddingTop) || 0
    const r = body.getBoundingClientRect()
    const at = Math.min(Math.max(Math.round(gap - r.top), -CUT_REACH), Math.ceil(r.height) + CUT_REACH) + CUT_REACH
    const next = `linear-gradient(to bottom, transparent ${at}px, #000 ${at}px)`
    if (next === last) return
    body.dataset.lgCut = ''
    body.style.maskImage = next
    body.style.setProperty('-webkit-mask-image', next)
    last = next
  }
  apply()
  window.addEventListener('scroll', apply, { passive: true })
  window.addEventListener('resize', apply)
  sticks.addEventListener('change', apply)
  const ro = new ResizeObserver(apply)
  ro.observe(page)
  const mo = new MutationObserver(apply)
  mo.observe(page, { childList: true })
  return () => {
    window.removeEventListener('scroll', apply)
    window.removeEventListener('resize', apply)
    sticks.removeEventListener('change', apply)
    ro.disconnect()
    mo.disconnect()
    clear()
  }
}

export default function GlassScene() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useScene(canvas)
  usePointerLight()
  useUnderBarCut()

  return createPortal(
    <div className="lg-scene" aria-hidden="true">
      <canvas ref={canvas} className="lg-backdrop" />
      {__GLASS_BACKDROP__ ? <div className="lg-photo" style={{ backgroundImage: 'url(/glass-backdrop.jpg)' }} /> : null}
    </div>,
    document.body,
  )
}
