/** The entry slip's fold and unfold on a wide screen, in either style.
 *
 * Neither style may change the board's layout as a slide lands: the last
 * frame of the motion has to be the resting frame. (An earlier version slid
 * a wider board across and swapped to the narrow layout once it arrived;
 * that swap was the snap at the end of opening.) Both directions run one
 * duration and one curve.
 *
 * Glass: the board takes its resting layout as the slide begins and holds
 * still in it; only the leaf moves, by transform, and its pane fades. The
 * leaf is pinned to the slip's right edge (glass.css), so it slides out
 * from beside the rail into the room the board has made, and back over the
 * board as it widens. Animating the board's real width every frame was
 * measured first and dropped frames (every pane of glass re-rasterised as
 * it resized, 33ms frames at the 95th percentile), so it is not used here.
 *
 * Journal: the slip's real width animates and the sheet beside it takes a
 * real layout on every frame (its columns are fluid), so its last frame is
 * its resting layout; that stays inside the frame budget, as the paper has
 * no glass to redraw. The leaf keeps its hinge (board.css) on the same
 * timing. The width runs in whole pixels, so the final frames sit exactly
 * on the resting layout rather than a fraction of a pixel short of it. */

export const DOCK_MS = 380
export const DOCK_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

const SLIDE = 'data-dock-slide'

const q = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)

const px = (v: string) => parseFloat(v) || 0

export function canSlide(): boolean {
  return typeof Element.prototype.animate === 'function'
    && window.matchMedia('(min-width: 901px)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Whether the slip's width can animate through a registered custom
 * property read as round(…, 1px). */
let rounded: boolean | null = null
function canRound(): boolean {
  if (rounded !== null) return rounded
  rounded = false
  try {
    if (typeof CSS !== 'undefined' && 'registerProperty' in CSS && CSS.supports('width', 'round(1.5px, 1px)')) {
      try {
        CSS.registerProperty({ name: '--dock-slide-basis', syntax: '<length>', inherits: false, initialValue: '0px' })
      } catch { /* already registered */ }
      rounded = true
    }
  } catch { rounded = false }
  return rounded
}

export function createDockSlide() {
  let anims: Animation[] = []
  let pending: { next: boolean; glass: boolean; dockW: number } | null = null
  let undo: (() => void) | null = null

  function end() {
    // The animations and the sliding flag come off in one task; each
    // animation's last value is the resting state, so nothing moves.
    const running = anims
    anims = []
    undo?.()
    undo = null
    q('.desk')?.removeAttribute(SLIDE)
    for (const a of running) a.cancel()
  }

  return {
    /** Before the open state changes. A slide still running plays back
     * from where it is instead of starting over. */
    prepare(next: boolean, glass: boolean) {
      pending = null
      if (anims.length) {
        for (const a of anims) a.reverse()
        return
      }
      const desk = q('.desk')
      const dock = q('.entry-dock')
      if (!desk || !dock || !canSlide()) return
      // Read while the layout is still clean, so it costs nothing.
      pending = { next, glass, dockW: dock.getBoundingClientRect().width }
      desk.setAttribute(SLIDE, glass ? 'glass' : 'journal')
    },

    /** After the open state is committed, before it is painted. */
    start() {
      const p = pending
      pending = null
      if (!p) return
      const dock = q('.entry-dock')
      const leaf = q('.dock-leaf')
      const paper = q('.dock-paper')
      if (!dock || !leaf || !paper) { q('.desk')?.removeAttribute(SLIDE); return }
      // With transitions off while sliding, the committed class already
      // holds the slip's new width; read from style, not layout.
      const toW = px(getComputedStyle(dock).flexBasis) || p.dockW
      const opts: KeyframeAnimationOptions = { duration: DOCK_MS, easing: DOCK_EASE, fill: 'both' }
      if (p.glass) {
        // The leaf starts (or ends) one slip-width change to the left of
        // where it rests, which is where the folded tab's edge is.
        const d = toW - p.dockW
        anims = [
          leaf.animate([{ transform: `translateX(${-d}px)` }, { transform: 'translateX(0px)' }], opts),
          paper.animate(
            p.next
              ? [{ opacity: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 1 }]
              : [{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }],
            opts,
          ),
        ]
      } else if (canRound()) {
        dock.style.flexBasis = 'round(var(--dock-slide-basis), 1px)'
        undo = () => { dock.style.flexBasis = '' }
        anims = [dock.animate([{ '--dock-slide-basis': `${p.dockW}px` }, { '--dock-slide-basis': `${toW}px` }], opts)]
      } else {
        anims = [dock.animate([{ flexBasis: `${p.dockW}px` }, { flexBasis: `${toW}px` }], opts)]
      }
      // Whichever way it last ran (a reversed slide finishes at its start).
      anims[0].onfinish = end
    },

    /** Unmounting or switching style mid-slide: drop it where it is. */
    stop() {
      pending = null
      if (anims.length || undo) end()
      q('.desk')?.removeAttribute(SLIDE)
    },
  }
}
