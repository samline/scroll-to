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
  ATTRIBUTE,
  EASINGS,
  EVENTS,
  INTERRUPTIONS,
  STATE_ATTRIBUTE,
  align,
  clamp,
} from '../core/scroll-to.js'

interface Running {
  cancel: (reason: ScrollEndReason) => void
}
const running = new WeakMap<object, Running>()

const resolveContainer = (container: ScrollToOptions['container']): Element | Window => {
  if (!container || container === window) return window
  if (typeof container === 'string') return document.querySelector(container) ?? window
  return container as Element
}

const resolveTarget = (target: ScrollTarget): Element | number | null => {
  if (typeof target === 'number') return target
  if (typeof target !== 'string') return target
  const value = target.trim()
  if (value === '#' || value === '#top' || value === 'top') return 0
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

const resolveOffset = (offset: ScrollToOptions['offset'], height: number): number => {
  if (offset === undefined) return 0
  if (typeof offset === 'number') return offset
  if (typeof offset !== 'string') return offset.getBoundingClientRect().height
  const value = offset.trim()
  if (/^-?\d*\.?\d+%$/.test(value)) return (height * parseFloat(value)) / 100
  if (/^-?\d*\.?\d+(px)?$/.test(value)) return parseFloat(value)
  const element = document.querySelector(value)
  return element ? element.getBoundingClientRect().height : 0
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
  if (typeof resolved === 'number') return { top: clamp(resolved, view.maxY), left: view.x }
  const offset = resolveOffset(options.offset, view.height)
  const box = resolved.getBoundingClientRect()
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

const moveFocus = (target: Element | number | null) => {
  if (!(target instanceof HTMLElement || target instanceof SVGElement)) return
  if (!target.matches('a[href], button, input, select, textarea, [tabindex], [contenteditable]')) {
    target.setAttribute('tabindex', '-1')
  }
  target.focus({ preventScroll: true })
}

const writeHash = (target: Element | number | null, mode: ScrollToOptions['hash']) => {
  if (!mode) return
  const id = target instanceof Element ? target.id : ''
  if (target instanceof Element && !id) return
  const url = new URL(window.location.href)
  url.hash = id ? `#${encodeURIComponent(id)}` : ''
  if (url.href === window.location.href) return
  history[mode === 'push' ? 'pushState' : 'replaceState'](history.state, '', url)
}

/** The element that represents the container in the DOM: the root for the page. */
const hostOf = (container: Element | Window): Element =>
  container === window ? document.documentElement : (container as Element)

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
      if (options.focus) moveFocus(resolved)
      writeHash(resolved, options.hash)
    }
    for (const node of marked) node.removeAttribute(STATE_ATTRIBUTE)
  }

  const start = viewport(container)
  const distance = Math.hypot(first.top - start.y, first.left - start.x)
  const duration =
    options.duration === undefined || options.duration === 'auto'
      ? Math.min(1000, Math.max(300, distance / 2))
      : Math.max(0, options.duration)
  const instant =
    options.behavior === 'instant' || prefersReducedMotion() || duration === 0 || distance < 1

  if (instant) {
    begin()
    setScroll(container, first.top, first.left)
    options.onProgress?.({ ...detail(), progress: 1, eased: 1 })
    finish(true)
    return Promise.resolve(end('arrived'))
  }

  const easing =
    typeof options.easing === 'function'
      ? options.easing
      : (EASINGS[options.easing ?? 'ease-in-out'] ?? EASINGS['ease-in-out'])
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
      const goal = scrollPosition(target, options) ?? first
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
