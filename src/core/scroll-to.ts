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
  /** Stop the scroll when this signal aborts. The end reason is `'cancelled'`. */
  signal?: AbortSignal
  /** Called once the scroll starts, before the first frame. */
  onStart?: (detail: ScrollDetail) => void
  /** Called on every frame with how far along the scroll is. */
  onProgress?: (detail: ScrollProgress) => void
  /** Called once when the scroll ends, for any reason. */
  onEnd?: (result: ScrollResult) => void
}

/** Why a scroll ended. */
export const END_REASONS = ['arrived', 'interrupted', 'replaced', 'cancelled', 'missing'] as const
export type ScrollEndReason = (typeof END_REASONS)[number]

/** What a scroll is doing: passed to `onStart` and in the `scroll-to:start` event. */
export interface ScrollDetail {
  /** The resolved target element, or `null` for positions and `'top'`. */
  target: Element | null
  /** What scrolls: the page (`window`) or an element. */
  container: Element | Window
  /** The trigger that was clicked, when `autoScrollTo` started it. */
  trigger: Element | null
  /** Current vertical scroll position in pixels. */
  top: number
  /** Current horizontal scroll position in pixels. */
  left: number
}

/** Passed to `onProgress` on every frame. */
export interface ScrollProgress extends ScrollDetail {
  /** Time elapsed, from `0` to `1`. */
  progress: number
  /** Distance covered, from `0` to `1`, after easing. */
  eased: number
}

/** Passed to `onEnd` and in the `scroll-to:end` event. */
export interface ScrollResult extends ScrollDetail {
  /** `true` only when the reason is `'arrived'`. */
  arrived: boolean
  /** Why it ended. */
  reason: ScrollEndReason
}

/** A scroller with shared defaults, from `createScrollTo`. */
export interface ScrollToInstance {
  /** `scrollTo` with the defaults. */
  to: (target: ScrollTarget, options?: ScrollToOptions) => Promise<boolean>
  /** `scrollPosition` with the defaults. */
  position: (
    target: ScrollTarget,
    options?: ScrollToOptions
  ) => { top: number; left: number } | null
  /** Stop the scroll running on the default container. */
  cancel: () => void
  /** Whether the default container is scrolling. */
  isScrolling: () => boolean
  /** `autoScrollTo` with the defaults; destroyed together with this instance. */
  auto: (options?: AutoScrollToOptions) => ScrollToController
  /** Stop the running scroll and every `auto` controller. Later calls do nothing. */
  destroy: () => void
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
/** Set to `'scrolling'` on the trigger and the scrolling element while a scroll runs. */
export const STATE_ATTRIBUTE = 'data-scroll-to-state'
/** Bubbling events dispatched on the target (or the scrolling element). */
export const EVENTS = { start: 'scroll-to:start', end: 'scroll-to:end' } as const

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
