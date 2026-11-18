// DOM-free part of scroll-to: types, constants and pure helpers. The DOM
// controller lives in src/vanilla/scroll-to.ts.

export const ALIGNS = ['start', 'center', 'end', 'nearest'] as const
export type Align = (typeof ALIGNS)[number]
export type Easing = (progress: number) => number
export type ScrollTarget = Element | string | number

export interface ScrollToOptions {
  /**
   * What scrolls: the page (default), an element or a selector. Use the
   * element for scrolling boxes, tab strips and carousels.
   */
  container?: Element | Window | string | null
  /**
   * Space kept above the target, for fixed headers: pixels (`80`), a
   * percentage of the container height (`'10%'`), or an element or selector
   * whose height is used (`'#header'`). Defaults to `0`.
   */
  offset?: number | string | Element
  /** Vertical alignment. Defaults to `'start'`. */
  block?: Align
  /** Horizontal alignment. Defaults to `'nearest'`. */
  inline?: Align
  /**
   * Duration in milliseconds, or `'auto'` to scale with the distance
   * (300–1000 ms). Defaults to `'auto'`.
   */
  duration?: number | 'auto'
  /** A name (`'ease-in-out'`, `'ease-out'`, `'linear'`) or a function. Defaults to `'ease-in-out'`. */
  easing?: keyof typeof EASINGS | Easing
  /** `'instant'` jumps. Reduced motion always jumps. Defaults to `'smooth'`. */
  behavior?: 'smooth' | 'instant'
  /** Stop when the visitor scrolls, touches or presses a key. Defaults to `true`. */
  interruptible?: boolean
  /** Move keyboard focus to the target once it arrives. Defaults to `false`. */
  focus?: boolean
  /** Put the target's `#id` in the URL: `'push'`, `'replace'` or `false`. Defaults to `false`. */
  hash?: 'push' | 'replace' | false
}

export interface AutoScrollToOptions extends ScrollToOptions {
  /** Triggers to handle. Defaults to `'[data-scroll-to], a[href^="#"]'`. */
  selector?: string
  /** Where clicks are listened to. Defaults to `document`. */
  scope?: Document | Element
  /** On load, align the URL's `#id` with the offset. Defaults to `true`. */
  initialHash?: boolean
}

export interface ScrollToController {
  /** Stop handling clicks. */
  destroy: () => void
}

export const ATTRIBUTE = 'data-scroll-to'

export const EASINGS = {
  linear: (t: number) => t,
  'ease-out': (t: number) => 1 - (1 - t) ** 3,
  'ease-in-out': (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
}

export const INTERRUPTIONS = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const

/** Scroll position along one axis that aligns `[start, end]` inside `[viewStart, viewEnd]`. */
export const align = (
  mode: Align,
  current: number,
  start: number,
  end: number,
  viewStart: number,
  viewEnd: number
) => {
  const size = end - start
  const view = viewEnd - viewStart
  if (mode === 'start') return current + start - viewStart
  if (mode === 'end') return current + end - viewEnd
  if (mode === 'center') return current + start - viewStart - (view - size) / 2
  // nearest: only move when it is (partly) outside.
  if (start < viewStart || size > view) return current + start - viewStart
  if (end > viewEnd) return current + end - viewEnd
  return current
}

export const clamp = (value: number, max: number) => Math.min(Math.max(0, max), Math.max(0, value))
