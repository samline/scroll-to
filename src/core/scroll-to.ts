// DOM-free part of scroll-to: types, constants and pure helpers. The DOM
// controller lives in src/vanilla/scroll-to.ts.

export const ALIGNS = ['start', 'center', 'end', 'nearest'] as const
export type Align = (typeof ALIGNS)[number]
export type Easing = (progress: number) => number
/** A named easing from `EASINGS`, a CSS `cubic-bezier(x1, y1, x2, y2)` string or a function. */
export type EasingValue = keyof typeof EASINGS | `cubic-bezier(${string})` | Easing

/**
 * A position on either axis: pixels from the start (`400`), or relative to
 * where the container is now (`'+=400'`, `'-=50%'`, a percentage of its size).
 */
export type ScrollCoordinate = number | `+=${string}` | `-=${string}`
/** A position on both axes. A missing axis stays where it is. */
export interface ScrollPoint {
  top?: ScrollCoordinate
  left?: ScrollCoordinate
}
/**
 * An element, an `#id`, a selector, `'top'`, `'bottom'`, `'next'` or
 * `'prev'` (the next or previous of `sections`), a vertical position (`400`,
 * `'+=400'`, `'-=50%'`) or a point on both axes (`{ top, left }`).
 */
export type ScrollTarget = Element | string | number | ScrollPoint

/** Passed to a function `offset`. */
export interface OffsetContext {
  /** What scrolls: the page (`window`) or an element. */
  container: Element | Window
  /** The target element. */
  target: Element
}
/**
 * One part of an offset: pixels, `'80px'`, a percentage of the container
 * height, an element or selector whose height is used, `'auto'` (fixed and
 * sticky elements stuck at the top), `'css'` (`scroll-padding-top` and
 * `scroll-margin-top`) or a function.
 */
export type OffsetValue = number | string | Element | ((context: OffsetContext) => number)

export interface ScrollToOptions {
  /**
   * What scrolls: the page (default), an element or a selector. Use the
   * element for scrolling boxes, tab strips and carousels. `'auto'` scrolls
   * every ancestor of the target that scrolls, then the page, like
   * `scrollIntoView`; the `offset` applies to the outermost one.
   */
  container?: Element | Window | string | null
  /**
   * Space kept above the target, for fixed headers: pixels (`80`), a
   * percentage of the container height (`'10%'`), an element or selector
   * whose height is used (`'#header'`), `'auto'` to measure fixed and sticky
   * elements stuck at the top, `'css'` to use `scroll-padding-top` and
   * `scroll-margin-top`, a function, or an array of these, added up.
   * Defaults to `0`.
   */
  offset?: OffsetValue | readonly OffsetValue[]
  /** Vertical alignment. Defaults to `'start'`. */
  block?: Align
  /**
   * Horizontal alignment. Right to left, `'start'` is the right edge.
   * Defaults to `'nearest'`.
   */
  inline?: Align
  /**
   * Duration in milliseconds, or `'auto'` to scale with the distance
   * (300–1000 ms, or from `speed`). Defaults to `'auto'`.
   */
  duration?: number | 'auto'
  /** Pixels per second, for an `'auto'` duration that grows with the distance. */
  speed?: number
  /** The longest an `'auto'` duration can be, in milliseconds. Defaults to `1000` without `speed`. */
  maxDuration?: number
  /**
   * A name from `EASINGS`, a CSS `'cubic-bezier(x1, y1, x2, y2)'` string or a
   * function. Defaults to `'ease-in-out'`.
   */
  easing?: EasingValue
  /**
   * `'needed'` does not move when the target element is already fully
   * visible below the offset. Defaults to `'always'`.
   */
  when?: 'always' | 'needed'
  /**
   * What `'next'` and `'prev'` step through, inside the container. Defaults
   * to `'section'`.
   */
  sections?: string
  /**
   * Open closed `<details>` and `hidden="until-found"` content around the
   * target before scrolling, like the browser does for fragment links.
   * Defaults to `true`.
   */
  reveal?: boolean
  /** `'instant'` jumps. Reduced motion always jumps. Defaults to `'smooth'`. */
  behavior?: 'smooth' | 'instant'
  /**
   * Wait for the running scroll on the container (and the ones already
   * waiting) instead of replacing it. A scroll without `queue`, an
   * interruption or `cancelScroll()` ends the waiting ones unstarted.
   * Defaults to `false`.
   */
  queue?: boolean
  /** Stop when the visitor scrolls, touches or presses a key. Defaults to `true`. */
  interruptible?: boolean
  /**
   * Mark the target with `data-scroll-to-arrived` once it arrives, for a CSS
   * highlight: `true` for 1500 ms, or a number of milliseconds. Defaults to
   * `false`.
   */
  highlight?: boolean | number
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

export interface BackToTopOptions extends ScrollToOptions {
  /** Where the button scrolls to. Defaults to `'top'`. */
  target?: ScrollTarget
  /**
   * How far the container must be scrolled before the button shows: pixels,
   * or a percentage of the container height (`'50%'`). Defaults to `'100%'`.
   */
  threshold?: number | string
}

export interface BackToTopController {
  /** Measure again, after the content changed size without a scroll. */
  update: () => void
  /** Stop listening and remove the attributes. Later calls do nothing. */
  destroy: () => void
}

export const ATTRIBUTE = 'data-scroll-to'
/** Set to `'scrolling'` on the trigger and the scrolling element while a scroll runs. */
export const STATE_ATTRIBUTE = 'data-scroll-to-state'
/** Set on the target for `highlight` milliseconds once it arrives. */
export const ARRIVED_ATTRIBUTE = 'data-scroll-to-arrived'
/** `'true'` or `'false'` on a `backToTop` button, past its threshold or not. */
export const VISIBLE_ATTRIBUTE = 'data-scroll-to-visible'
/**
 * CSS custom properties: `progress` (0–1, eased) on the trigger and the
 * scrolling element while a scroll runs; `scrolled` (0–1) on a `backToTop`
 * button, how far down the container is.
 */
export const PROPERTIES = {
  progress: '--scroll-to-progress',
  scrolled: '--scroll-to-scrolled',
} as const
/** How long `highlight: true` keeps the arrived attribute, in milliseconds. */
export const HIGHLIGHT_DURATION = 1500
/** Bubbling events dispatched on the target (or the scrolling element). */
export const EVENTS = { start: 'scroll-to:start', end: 'scroll-to:end' } as const

export const EASINGS = {
  linear: (t: number) => t,
  'ease-in': (t: number) => t ** 3,
  'ease-out': (t: number) => 1 - (1 - t) ** 3,
  'ease-in-out': (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  'ease-out-quint': (t: number) => 1 - (1 - t) ** 5,
  /** Overshoots a little and settles back. */
  'ease-out-back': (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
}

/** The easing of a CSS `cubic-bezier(x1, y1, x2, y2)`; `x1` and `x2` must be within 0–1. */
export const cubicBezier = (x1: number, y1: number, x2: number, y2: number): Easing => {
  // One axis of the curve at t, from 0 to 1.
  const at = (t: number, p1: number, p2: number) =>
    3 * p1 * t * (1 - t) ** 2 + 3 * p2 * t ** 2 * (1 - t) + t ** 3
  return progress => {
    if (progress <= 0) return 0
    if (progress >= 1) return 1
    // x grows with t when x1 and x2 are within 0–1, so bisection finds it.
    let low = 0
    let high = 1
    while (high - low > 1e-5) {
      const t = (low + high) / 2
      if (at(t, x1, x2) < progress) low = t
      else high = t
    }
    return at((low + high) / 2, y1, y2)
  }
}

/** The easing function for an `easing` option; unknown values use `'ease-in-out'`. */
export const parseEasing = (easing: ScrollToOptions['easing']): Easing => {
  if (typeof easing === 'function') return easing
  const name = String(easing ?? '').trim()
  if (Object.prototype.hasOwnProperty.call(EASINGS, name)) {
    return EASINGS[name as keyof typeof EASINGS]
  }
  const values = /^cubic-bezier\(([^)]*)\)$/
    .exec(name)?.[1]
    ?.split(',')
    .map(value => (value.trim() ? Number(value) : NaN))
  if (values?.length === 4 && values.every(Number.isFinite)) {
    const [x1, y1, x2, y2] = values as [number, number, number, number]
    if (x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1) return cubicBezier(x1, y1, x2, y2)
  }
  return EASINGS['ease-in-out']
}

/** How long a scroll of `distance` pixels lasts, in milliseconds. */
export const durationFor = (
  distance: number,
  { duration, speed, maxDuration }: Pick<ScrollToOptions, 'duration' | 'speed' | 'maxDuration'>
): number => {
  if (typeof duration === 'number') return Math.max(0, duration)
  if (speed && speed > 0) return Math.min(maxDuration ?? Infinity, (distance / speed) * 1000)
  return Math.max(0, Math.min(maxDuration ?? 1000, Math.max(300, distance / 2)))
}

/**
 * A relative position (`'+=400'`, `'-=25%'`) from `current`, with
 * percentages of `size`; `null` when `value` is not relative.
 */
export const relativeTo = (value: string, current: number, size: number): number | null => {
  const match = /^([+-])=\s*(\d*\.?\d+)(px|%)?$/.exec(value.trim())
  if (!match) return null
  const amount = parseFloat(match[2]!) * (match[3] === '%' ? size / 100 : 1)
  return current + (match[1] === '-' ? -amount : amount)
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
