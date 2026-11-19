import {
  isBrowser,
  prefersReducedMotion,
  readEnum,
  readNumber,
  readString,
} from '@samline/internal'
import {
  ALIGNS,
  type ScrollTarget,
  type ScrollToOptions,
  type AutoScrollToOptions,
  type ScrollToController,
  type ScrollToInstance,
  type ScrollDetail,
  type ScrollEndReason,
  type ScrollResult,
  type ScrollPoint,
  type OffsetValue,
  ATTRIBUTE,
  EVENTS,
  INTERRUPTIONS,
  STATE_ATTRIBUTE,
  align,
  clamp,
  durationFor,
  parseEasing,
  relativeTo,
} from '../core/scroll-to.js'

interface Running {
  cancel: (reason: ScrollEndReason) => void
}
const running = new WeakMap<object, Running>()
const WHEN = ['always', 'needed'] as const

const resolveContainer = (container: ScrollToOptions['container']): Element | Window => {
  if (!container || container === window) return window
  if (typeof container === 'string') return document.querySelector(container) ?? window
  return container as Element
}

/** A target as an element, or as a point on both axes (positions, `'top'`, `'bottom'`, `'+=400'`). */
const resolveTarget = (target: ScrollTarget): Element | ScrollPoint | null => {
  if (typeof target === 'number') return { top: target }
  if (typeof target !== 'string') return target
  const value = target.trim()
  if (value === '#' || value === '#top' || value === 'top') return { top: 0 }
  if (value === 'bottom') return { top: Infinity }
  if (/^[+-]=/.test(value)) return { top: value as `+=${string}` }
  if (value.startsWith('#')) {
    let id = value.slice(1)
    try {
      id = decodeURIComponent(id)
    } catch {
      // Keep the raw id.
    }
    const byId = document.getElementById(id)
    if (byId) return byId
  }
  try {
    return document.querySelector(value)
  } catch {
    return null
  }
}

/** The element that represents the container in the DOM: the root for the page. */
const hostOf = (container: Element | Window): Element =>
  container === window ? document.documentElement : (container as Element)

/** The visible box of the container and how far it can scroll. */
const viewport = (container: Element | Window) => {
  if (container === window) {
    const root = document.scrollingElement ?? document.documentElement
    return {
      top: 0,
      left: 0,
      width: root.clientWidth,
      height: root.clientHeight,
      x: window.scrollX,
      y: window.scrollY,
      maxX: root.scrollWidth - root.clientWidth,
      maxY: root.scrollHeight - root.clientHeight,
    }
  }
  const element = container as Element
  const box = element.getBoundingClientRect()
  return {
    top: box.top + element.clientTop,
    left: box.left + element.clientLeft,
    width: element.clientWidth,
    height: element.clientHeight,
    x: element.scrollLeft,
    y: element.scrollTop,
    maxX: element.scrollWidth - element.clientWidth,
    maxY: element.scrollHeight - element.clientHeight,
  }
}

type View = ReturnType<typeof viewport>

/** A CSS length in pixels, with percentages of `size`; `0` for `auto` and the unknown. */
const cssLength = (value: string, size: number) =>
  (value.trim().endsWith('%') ? (size * parseFloat(value)) / 100 : parseFloat(value)) || 0

/** `scroll-padding-top` of the container plus `scroll-margin-top` of the target. */
const cssOffset = (container: Element | Window, target: Element, height: number) =>
  cssLength(getComputedStyle(hostOf(container)).getPropertyValue('scroll-padding-top'), height) +
  cssLength(getComputedStyle(target).getPropertyValue('scroll-margin-top'), height)

/**
 * How far fixed and sticky elements reach into the top of the container once
 * the target arrives. Sticky elements that come before the target (siblings
 * of it or of its ancestors) stick at their `top` by then, even when they are
 * not stuck yet. Fixed ones, and whatever is stuck below them, are found at
 * the top edge. Elements taller than half of the container are ignored.
 */
const stuckOffset = (container: Element | Window, view: View, target: Element) => {
  const host = hostOf(container)
  const limit = view.height / 2
  let reach = view.top
  for (let node: Element | null = target; node && node !== host; node = node.parentElement) {
    for (let before = node.previousElementSibling; before; before = before.previousElementSibling) {
      const style = getComputedStyle(before)
      if (style.position !== 'sticky' || !style.top || style.top === 'auto') continue
      const height = before.getBoundingClientRect().height
      if (height <= limit)
        reach = Math.max(reach, view.top + cssLength(style.top, view.height) + height)
    }
  }
  if (typeof document.elementsFromPoint !== 'function') return reach - view.top
  const seen = new Set<Element>()
  // Probe just below the edge until nothing stuck reaches further.
  for (let edge = view.top, round = 0; round < 4; round++) {
    let next = edge
    for (const fraction of [0.1, 0.5, 0.9]) {
      const x = view.left + view.width * fraction
      for (const element of document.elementsFromPoint(x, edge + 1)) {
        if (seen.has(element) || element === host) continue
        seen.add(element)
        if (container !== window && !host.contains(element)) continue
        const position = getComputedStyle(element).position
        if (position !== 'fixed' && position !== 'sticky') continue
        const box = element.getBoundingClientRect()
        if (box.top > edge + 1 || box.height > limit) continue
        next = Math.max(next, box.bottom)
      }
    }
    if (next <= edge) break
    edge = next
    reach = Math.max(reach, edge)
  }
  return reach - view.top
}

const resolveOffset = (
  offset: OffsetValue | readonly OffsetValue[] | undefined,
  container: Element | Window,
  target: Element,
  view: View
): number => {
  if (offset === undefined) return 0
  if (Array.isArray(offset)) {
    return offset.reduce<number>(
      (sum, part: OffsetValue) => sum + resolveOffset(part, container, target, view),
      0
    )
  }
  const value = offset as OffsetValue
  if (typeof value === 'number') return value
  if (typeof value === 'function') return Number(value({ container, target })) || 0
  if (typeof value !== 'string') return value.getBoundingClientRect().height
  const text = value.trim()
  if (text === 'auto') return stuckOffset(container, view, target)
  if (text === 'css') return cssOffset(container, target, view.height)
  if (/^-?\d*\.?\d+%$/.test(text)) return (view.height * parseFloat(text)) / 100
  if (/^-?\d*\.?\d+(px)?$/.test(text)) return parseFloat(text)
  try {
    const element = document.querySelector(text)
    return element ? element.getBoundingClientRect().height : 0
  } catch {
    return 0
  }
}

/** One axis of a point: absolute, relative to `current`, or unchanged. */
const coordinate = (value: ScrollPoint['top'], current: number, size: number) => {
  if (typeof value === 'number') return Number.isNaN(value) ? current : value
  if (typeof value !== 'string') return current
  return relativeTo(value, current, size) ?? current
}

/** Where the container must scroll to show `target` as asked. */
export const scrollPosition = (
  target: ScrollTarget,
  options: Omit<ScrollToOptions, 'duration' | 'easing' | 'behavior'> = {}
): { top: number; left: number } | null => {
  if (!isBrowser()) return null
  const container = resolveContainer(options.container)
  const resolved = resolveTarget(target)
  if (resolved === null) return null
  const view = viewport(container)
  if (!(resolved instanceof Element)) {
    return {
      top: clamp(coordinate(resolved.top, view.y, view.height), view.maxY),
      left: clamp(coordinate(resolved.left, view.x, view.width), view.maxX),
    }
  }
  const offset = resolveOffset(options.offset, container, resolved, view)
  const box = resolved.getBoundingClientRect()
  if (
    options.when === 'needed' &&
    box.top >= view.top + offset &&
    box.bottom <= view.top + view.height &&
    box.left >= view.left &&
    box.right <= view.left + view.width
  ) {
    return { top: clamp(view.y, view.maxY), left: clamp(view.x, view.maxX) }
  }
  const top = align(
    options.block ?? 'start',
    view.y,
    box.top,
    box.bottom,
    view.top + offset,
    view.top + view.height
  )
  const left = align(
    options.inline ?? 'nearest',
    view.x,
    box.left,
    box.right,
    view.left,
    view.left + view.width
  )
  return { top: clamp(top, view.maxY), left: clamp(left, view.maxX) }
}

const setScroll = (container: Element | Window, top: number, left: number) =>
  container.scrollTo({ top, left, behavior: 'instant' as ScrollBehavior })

const moveFocus = (target: Element | null) => {
  if (!(target instanceof HTMLElement || target instanceof SVGElement)) return
  if (!target.matches('a[href], button, input, select, textarea, [tabindex], [contenteditable]')) {
    target.setAttribute('tabindex', '-1')
  }
  target.focus({ preventScroll: true })
}

const writeHash = (target: Element | null, mode: ScrollToOptions['hash']) => {
  if (!mode) return
  const id = target instanceof Element ? target.id : ''
  if (target instanceof Element && !id) return
  const url = new URL(window.location.href)
  url.hash = id ? `#${encodeURIComponent(id)}` : ''
  if (url.href === window.location.href) return
  history[mode === 'push' ? 'pushState' : 'replaceState'](history.state, '', url)
}

const run = (
  target: ScrollTarget,
  options: ScrollToOptions,
  trigger: Element | null,
  owner?: AbortSignal
): Promise<boolean> => {
  if (!isBrowser()) return Promise.resolve(false)
  const container = resolveContainer(options.container)
  const resolved = resolveTarget(target)
  const element = resolved instanceof Element ? resolved : null
  const host = hostOf(container)
  // `when` decides once, at the start; frames measure the destination again without it.
  const frameOptions: ScrollToOptions = { ...options, when: 'always' }
  const signals = [options.signal, owner].filter((signal): signal is AbortSignal => !!signal)

  const detail = (): ScrollDetail => {
    const view = viewport(container)
    return { target: element, container, trigger, top: view.y, left: view.x }
  }
  const emit = (type: string, value: ScrollDetail) =>
    (element ?? host).dispatchEvent(new CustomEvent(type, { bubbles: true, detail: value }))
  const end = (reason: ScrollEndReason): boolean => {
    const result: ScrollResult = { ...detail(), arrived: reason === 'arrived', reason }
    options.onEnd?.(result)
    emit(EVENTS.end, result)
    return result.arrived
  }

  const first = scrollPosition(target, options)
  if (!first) return Promise.resolve(end('missing'))
  if (signals.some(signal => signal.aborted)) return Promise.resolve(end('cancelled'))

  running.get(container)?.cancel('replaced')

  const marked = trigger ? [host, trigger] : [host]
  const begin = () => {
    for (const node of marked) node.setAttribute(STATE_ATTRIBUTE, 'scrolling')
    const value = detail()
    options.onStart?.(value)
    emit(EVENTS.start, value)
  }
  const finish = (arrived: boolean) => {
    if (arrived) {
      if (options.focus) moveFocus(element)
      writeHash(element, options.hash)
    }
    for (const node of marked) node.removeAttribute(STATE_ATTRIBUTE)
  }

  const start = viewport(container)
  // Positions are fixed at the start, so relative ones (`'+=400'`) do not keep moving.
  const goalTarget: ScrollTarget = element ?? { top: first.top, left: first.left }
  const distance = Math.hypot(first.top - start.y, first.left - start.x)
  const duration = durationFor(distance, options)
  const instant =
    options.behavior === 'instant' || prefersReducedMotion() || duration === 0 || distance < 1

  if (instant) {
    begin()
    setScroll(container, first.top, first.left)
    options.onProgress?.({ ...detail(), progress: 1, eased: 1 })
    finish(true)
    return Promise.resolve(end('arrived'))
  }

  const easing = parseEasing(options.easing)
  const interruptible = options.interruptible ?? true

  return new Promise<boolean>(resolve => {
    let frame = 0
    let begun: number | null = null

    const stop = (reason: ScrollEndReason) => {
      cancelAnimationFrame(frame)
      if (running.get(container) === entry) running.delete(container)
      if (interruptible) {
        for (const type of INTERRUPTIONS) window.removeEventListener(type, interrupt)
      }
      for (const signal of signals) signal.removeEventListener('abort', abort)
      finish(reason === 'arrived')
      resolve(end(reason))
    }
    const interrupt = () => stop('interrupted')
    const abort = () => stop('cancelled')
    const entry: Running = { cancel: stop }
    running.set(container, entry)
    if (interruptible) {
      for (const type of INTERRUPTIONS) window.addEventListener(type, interrupt, { passive: true })
    }
    for (const signal of signals) signal.addEventListener('abort', abort, { once: true })
    begin()

    const step = (now: number) => {
      begun ??= now
      const progress = duration ? Math.min(1, (now - begun) / duration) : 1
      // Measure again: the target may have moved while content loaded.
      const goal = scrollPosition(goalTarget, frameOptions) ?? first
      const eased = easing(progress)
      setScroll(
        container,
        start.y + (goal.top - start.y) * eased,
        start.x + (goal.left - start.x) * eased
      )
      options.onProgress?.({ ...detail(), progress, eased })
      if (progress < 1) frame = requestAnimationFrame(step)
      else stop('arrived')
    }
    frame = requestAnimationFrame(step)
  })
}

/**
 * Smoothly scroll the page (or `container`) to `target`: an element, a
 * selector, an `#id`, `'top'` or a vertical position in pixels.
 *
 * The destination is measured again on every frame, so content that loads
 * on the way (images, fonts) does not make it land in the wrong place. A new
 * call on the same container replaces the running one. Resolves to `true`
 * when it arrives and `false` when it is interrupted, replaced, cancelled or
 * the target does not exist; `onEnd` and the `scroll-to:end` event say which.
 */
export const scrollTo = (target: ScrollTarget, options: ScrollToOptions = {}): Promise<boolean> =>
  run(target, options, null)

/** Stop the scroll running on `container` (the page by default). */
export const cancelScroll = (container?: ScrollToOptions['container']): void => {
  if (!isBrowser()) return
  running.get(resolveContainer(container))?.cancel('cancelled')
}

/** Whether a scroll is running on `container` (the page by default). */
export const isScrolling = (container?: ScrollToOptions['container']): boolean =>
  isBrowser() && running.has(resolveContainer(container))

/** The target of a trigger: its `data-scroll-to` value, or a same-page link's hash. */
const triggerTarget = (trigger: Element): string | null => {
  const value = trigger.getAttribute(ATTRIBUTE)
  if (value) return value
  if (!(trigger instanceof HTMLAnchorElement)) return null
  const href = trigger.getAttribute('href') ?? ''
  if (href.startsWith('#')) return href
  const here = window.location
  if (
    trigger.origin === here.origin &&
    trigger.pathname === here.pathname &&
    trigger.search === here.search &&
    trigger.hash
  )
    return trigger.hash
  return null
}

const triggerOptions = (trigger: Element, base: ScrollToOptions): ScrollToOptions => {
  const options: ScrollToOptions = { ...base }
  const offset = readString(trigger, 'data-scroll-to-offset', '')
  if (offset) options.offset = offset
  const container = readString(trigger, 'data-scroll-to-container', '')
  if (container) options.container = container
  // Unknown values are ignored, so a typo keeps the option instead of a wrong alignment.
  options.block = readEnum(trigger, 'data-scroll-to-block', ALIGNS, base.block ?? 'start')
  options.inline = readEnum(trigger, 'data-scroll-to-inline', ALIGNS, base.inline ?? 'nearest')
  const duration = readNumber(trigger, 'data-scroll-to-duration', NaN)
  if (Number.isFinite(duration)) options.duration = duration
  const speed = readNumber(trigger, 'data-scroll-to-speed', NaN)
  if (speed > 0) options.speed = speed
  const easing = readString(trigger, 'data-scroll-to-easing', '')
  if (easing) options.easing = easing as `cubic-bezier(${string})`
  options.when = readEnum(trigger, 'data-scroll-to-when', WHEN, base.when ?? 'always')
  return options
}

/**
 * Handle clicks on `[data-scroll-to]` elements and same-page `#id` links in
 * `scope`, with one delegated listener (so triggers added later work too).
 * Links keep their URL, history and focus behavior: the hash is pushed and
 * focus moves to the target. Clicks with a modifier key, or whose default
 * another script prevented, are left alone. Returns `{ destroy }`.
 */
export const autoScrollTo = ({
  selector = `[${ATTRIBUTE}], a[href^="#"]`,
  scope,
  initialHash = true,
  ...options
}: AutoScrollToOptions = {}): ScrollToController => {
  if (!isBrowser()) return { destroy: () => {} }
  const root = scope ?? document
  const base: ScrollToOptions = { focus: true, hash: 'push', ...options }

  const onClick = (event: Event) => {
    const mouse = event as MouseEvent
    if (event.defaultPrevented || mouse.button > 0) return
    if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) return
    const trigger = (event.target as Element | null)?.closest?.(selector)
    if (!trigger || !root.contains(trigger)) return
    const target = triggerTarget(trigger)
    if (!target || resolveTarget(target) === null) return
    event.preventDefault()
    void run(target, triggerOptions(trigger, base), trigger)
  }

  root.addEventListener('click', onClick)

  // The browser jumps to the URL's hash without the offset; align it once.
  const hash = window.location.hash
  const alignHash = () =>
    void scrollTo(hash, { ...options, behavior: 'instant', focus: false, hash: false })
  const fixHash = initialHash && options.offset !== undefined && hash.length > 1
  if (fixHash) {
    if (document.readyState === 'complete') alignHash()
    else window.addEventListener('load', alignHash, { once: true })
  }

  return {
    destroy: () => {
      root.removeEventListener('click', onClick)
      window.removeEventListener('load', alignHash)
    },
  }
}

/**
 * A scroller with shared defaults, so options such as `offset` or
 * `container` are written once. Options passed to each call replace the
 * defaults key by key. `destroy()` stops the scrolls this instance started
 * and every controller made with `auto()`; afterwards its calls do nothing.
 */
export const createScrollTo = (defaults: ScrollToOptions = {}): ScrollToInstance => {
  const owner = isBrowser() ? new AbortController() : null
  const controllers = new Set<ScrollToController>()
  const merge = <T extends ScrollToOptions>(options?: T): T => ({ ...defaults, ...options }) as T
  const alive = () => !!owner && !owner.signal.aborted

  return {
    to: (target, options) =>
      alive() ? run(target, merge(options), null, owner!.signal) : Promise.resolve(false),
    position: (target, options) => (alive() ? scrollPosition(target, merge(options)) : null),
    cancel: () => cancelScroll(defaults.container),
    isScrolling: () => isScrolling(defaults.container),
    auto: options => {
      if (!alive()) return { destroy: () => {} }
      const controller = autoScrollTo(merge(options))
      controllers.add(controller)
      return {
        destroy: () => {
          controllers.delete(controller)
          controller.destroy()
        },
      }
    },
    destroy: () => {
      if (!alive()) return
      owner!.abort()
      for (const controller of controllers) controller.destroy()
      controllers.clear()
    },
  }
}
