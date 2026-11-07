import type { ChangeEvent, FocusEvent, KeyboardEvent, MouseEvent, SelectHTMLAttributes, SyntheticEvent } from 'react'

/** Whether the engine matches select:open while a select's list is showing
 * (Chrome 133 and later). Where it does not, withOpenFlag keeps a data-open
 * attribute in step instead, which the same chevron rules also read. */
const OPEN_SELECTOR = typeof CSS !== 'undefined' && CSS.supports?.('selector(:open)') === true

/** The fallback for engines without select:open: data-open goes on when the
 * list is opened by the pointer or the keys that open it, and comes off on
 * a choice, Escape, Tab or blur. It only marks; the select itself still does
 * all of its own keyboard and pointer handling. */
export function withOpenFlag<T extends SelectHTMLAttributes<HTMLSelectElement>>(props: T): T {
  if (OPEN_SELECTOR) return props
  const set = (e: SyntheticEvent<HTMLSelectElement>, on: boolean) => {
    if (on) e.currentTarget.setAttribute('data-open', '')
    else e.currentTarget.removeAttribute('data-open')
  }
  return {
    ...props,
    onMouseDown: (e: MouseEvent<HTMLSelectElement>) => {
      set(e, !e.currentTarget.hasAttribute('data-open'))
      props.onMouseDown?.(e)
    },
    onKeyDown: (e: KeyboardEvent<HTMLSelectElement>) => {
      const open = e.currentTarget.hasAttribute('data-open')
      if (e.key === 'Escape' || e.key === 'Tab' || (open && e.key === 'Enter')) set(e, false)
      else if ((e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) || e.key === 'F4' || e.key === ' ') set(e, !open)
      props.onKeyDown?.(e)
    },
    onChange: (e: ChangeEvent<HTMLSelectElement>) => {
      set(e, false)
      props.onChange?.(e)
    },
    onBlur: (e: FocusEvent<HTMLSelectElement>) => {
      set(e, false)
      props.onBlur?.(e)
    },
  }
}
