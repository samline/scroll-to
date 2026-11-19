import {
  isBrowser,
  prefersReducedMotion,
  readEnum,
  readBoolean,
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
  type BackToTopOptions,
  type BackToTopController,
  type ScrollDetail,
  type ScrollEndReason,
  type ScrollResult,
  type ScrollPoint,
  type OffsetValue,
  ARRIVED_ATTRIBUTE,
  ATTRIBUTE,
  EVENTS,
  HIGHLIGHT_DURATION,
  INTERRUPTIONS,
  PROPERTIES,
  STATE_ATTRIBUTE,
  VISIBLE_ATTRIBUTE,
  align,
  clamp,
  durationFor,
  parseEasing,
  relativeTo,
} from '../core/scroll-to.js'

interface Running {
  cancel: (reason: ScrollEndReason) => void
  /** Where it is going, so `'next'` pressed again steps on from there. */
  target: Element | null
}
const running = new WeakMap<object, Running>()
const WHEN = ['always', 'needed'] as const
const HASH = ['push', 'replace', 'false'] as const

const resolveContainer = (container: ScrollToOptions['container']): Element | Window => {
  if (!container || container === window) return window
  if (typeof container === 'string') return document.querySelector(container) ?? window
  return container as Element
}

/**
 * A target as an element, or as a point on both axes (positions, `'top'`,
 * `'bottom'`, `'+=400'`). `'next'` and `'prev'` find a section.
 */
const resolveTarget = (
  target: ScrollTarget,
  options: ScrollToOptions = {}
): Element | ScrollPoint | null => {
  if (typeof target === 'number') return { top: target }
  if (typeof target !== 'string') return target
  const value = target.trim()
  if (value === 'next' || value === 'prev') return step(value, options)
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
      // The page takes its direction from the body (or the root).
      rtl: getComputedStyle(document.body ?? root).direction === 'rtl',
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
    rtl: getComputedStyle(element).direction === 'rtl',
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

/**
 * A horizontal position clamped to what can scroll. Right to left, the
 * position starts at `0` on the right and goes negative to the left.
 */
const clampLeft = (left: number, view: View) =>
  view.rtl ? -clamp(-left, view.maxX) || 0 : clamp(left, view.maxX)

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

/**
 * The first of `sections` the container would scroll forward to (`'next'`),
 * or the last it would scroll back to (`'prev'`). Sections it cannot move to,
 * such as the last ones at the end of the page, are skipped.
 */
const step = (direction: 'next' | 'prev', options: ScrollToOptions): Element | null => {
  const container = resolveContainer(options.container)
  const view = viewport(container)
  let sections: NodeListOf<Element>
  try {
    sections = (container === window ? document : (container as Element)).querySelectorAll(
      options.sections ?? 'section'
    )
  } catch {
    return null
  }
  // A scroll already on its way to one of the sections: step on from it.
  const list = [...sections]
  const heading = running.get(container)?.target
  const index = heading ? list.indexOf(heading) : -1
  if (index >= 0) return list[index + (direction === 'next' ? 1 : -1)] ?? null
  let found: Element | null = null
  for (const section of list) {
    const box = section.getBoundingClientRect()
    if (!box.width && !box.height) continue
    const goal = scrollPosition(section, { ...options, when: 'always' })!
    // Along the axis that moves: vertical first, then horizontal, forward in
    // the reading direction.
    const moved =
      Math.abs(goal.top - view.y) > 1
        ? goal.top - view.y
        : (goal.left - view.x) * (view.rtl ? -1 : 1)
    if (direction === 'next' && moved > 1) return section
    if (direction === 'prev' && moved < -1) found = section
  }
  return found
}

/**
 * Open what hides `target`, the way the browser does for fragment links:
 * closed `<details>` around it (unless it is in their summary) and
 * `hidden="until-found"` ancestors, which get a `beforematch` event first.
 */
const reveal = (target: Element) => {
  for (let node = target.parentElement; node; node = node.parentElement) {
    if (node instanceof HTMLDetailsElement && !node.open) {
      const summary = node.querySelector(':scope > summary')
      if (!summary?.contains(target)) node.open = true
    }
    if (node.getAttribute('hidden') === 'until-found') {
      node.dispatchEvent(new Event('beforematch', { bubbles: true }))
      node.removeAttribute('hidden')
    }
  }
}

/** Where the container must scroll to show `target` as asked. */
export const scrollPosition = (
  target: ScrollTarget,
  options: Omit<ScrollToOptions, 'duration' | 'easing' | 'behavior'> = {}
): { top: number; left: number } | null => {
  if (!isBrowser()) return null
  const resolved = resolveTarget(target, options)
  if (resolved === null) return null
  // With 'auto', the nearest container that scrolls.
  const container = containersFor(
    options.container,
    resolved instanceof Element ? resolved : null
  )[0]!
  const view = viewport(container)
  if (!(resolved instanceof Element)) {
    return {
      top: clamp(coordinate(resolved.top, view.y, view.height), view.maxY),
      left: clampLeft(coordinate(resolved.left, view.x, view.width), view),
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
    return { top: clamp(view.y, view.maxY), left: clampLeft(view.x, view) }
  }
  const top = align(
    options.block ?? 'start',
    view.y,
    box.top,
    box.bottom,
    view.top + offset,
    view.top + view.height
  )
  // Right to left, the inline start is the right edge.
  const inline = options.inline ?? 'nearest'
  const left = align(
    view.rtl && inline !== 'center' && inline !== 'nearest'
      ? inline === 'start'
        ? 'end'
        : 'start'
      : inline,
    view.x,
    box.left,
    box.right,
    view.left,
    view.left + view.width
  )
  return { top: clamp(top, view.maxY), left: clampLeft(left, view) }
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

const highlights = new WeakMap<Element, ReturnType<typeof setTimeout>>()

/** Mark `target` as arrived for `time` ms; arriving again restarts the time. */
const highlight = (target: Element, time: number) => {
  clearTimeout(highlights.get(target))
  target.setAttribute(ARRIVED_ATTRIBUTE, '')
  highlights.set(
    target,
    setTimeout(() => {
      highlights.delete(target)
      target.removeAttribute(ARRIVED_ATTRIBUTE)
    }, time)
  )
}

/** Drop a `style` attribute left empty, so the markup is as it was. */
const tidy = (node: Element) => {
  if (node.getAttribute('style') === '') node.removeAttribute('style')
}

/** Set (or with `null`, remove) a custom property on elements that have a style. */
const setProperty = (nodes: Element[], name: string, value: number | null) => {
  for (const node of nodes) {
    const style = (node as HTMLElement).style
    if (!style) continue
    if (value === null) {
      style.removeProperty(name)
      tidy(node)
    } else style.setProperty(name, String(Math.round(value * 1000) / 1000))
  }
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

/** Whether `node` scrolls its overflow, and has some to scroll. */
const scrolls = (node: Element) => {
  const style = getComputedStyle(node)
  const can = (overflow: string) => /^(auto|scroll|overlay)$/.test(overflow)
  return (
    (can(style.overflowY) && node.scrollHeight > node.clientHeight) ||
    (can(style.overflowX) && node.scrollWidth > node.clientWidth)
  )
}

/**
 * What scrolls, innermost first. `container: 'auto'` is every ancestor of the
 * target that scrolls, then the page, like `scrollIntoView`; anything else is
 * one container.
 */
const containersFor = (
  container: ScrollToOptions['container'],
  element: Element | null
): Array<Element | Window> => {
  if (container !== 'auto') return [resolveContainer(container)]
  const list: Array<Element | Window> = []
  for (let node = element?.parentElement; node; node = node.parentElement) {
    if (node === document.body || node === document.documentElement) break
    if (scrolls(node)) list.push(node)
  }
  const view = viewport(window)
  if (!list.length || view.maxY > 0 || view.maxX > 0) list.push(window)
  return list
}

/** Turn off `scroll-snap-type` on `hosts` until the returned function restores it. */
const suspendSnap = (hosts: Element[]) => {
  const saved: Array<[Element, CSSStyleDeclaration, string, string]> = []
  for (const host of hosts) {
    const style = (host as HTMLElement).style
    const type = getComputedStyle(host).getPropertyValue('scroll-snap-type')
    if (!style || !type || type === 'none') continue
    saved.push([
      host,
      style,
      style.getPropertyValue('scroll-snap-type'),
      style.getPropertyPriority('scroll-snap-type'),
    ])
    // Snapping after every frame would pull the scroll back to the last snap point.
    style.setProperty('scroll-snap-type', 'none', 'important')
  }
  return () => {
    for (const [host, style, value, priority] of saved) {
      if (value) style.setProperty('scroll-snap-type', value, priority)
      else style.removeProperty('scroll-snap-type')
      tidy(host)
    }
  }
}

const run = (
  target: ScrollTarget,
  options: ScrollToOptions,
  trigger: Element | null,
  owner?: AbortSignal
): Promise<boolean> => {
  if (!isBrowser()) return Promise.resolve(false)
  const resolved = resolveTarget(target, options)
  const element = resolved instanceof Element ? resolved : null
  if (element && options.reveal !== false) reveal(element)
  const containers = containersFor(options.container, element)
  const container = containers[0]!
  const hosts = containers.map(hostOf)
  // The offset belongs to the outermost container, usually the page with its header.
  const { offset, ...rest } = options
  const each = containers.map((one, index): ScrollToOptions => {
    const own: ScrollToOptions = { ...rest, container: one }
    if (offset !== undefined && index === containers.length - 1) own.offset = offset
    return own
  })
  const signals = [options.signal, owner].filter((signal): signal is AbortSignal => !!signal)

  const detail = (): ScrollDetail => {
    const view = viewport(container)
    return { target: element, container, trigger, top: view.y, left: view.x }
  }
  const emit = (type: string, value: ScrollDetail) =>
    (element ?? hosts[0]!).dispatchEvent(new CustomEvent(type, { bubbles: true, detail: value }))
  const end = (reason: ScrollEndReason): boolean => {
    const result: ScrollResult = { ...detail(), arrived: reason === 'arrived', reason }
    options.onEnd?.(result)
    emit(EVENTS.end, result)
    return result.arrived
  }

  const firsts = resolved ? each.map(own => scrollPosition(resolved, own)) : []
  if (!firsts[0]) return Promise.resolve(end('missing'))
  if (signals.some(signal => signal.aborted)) return Promise.resolve(end('cancelled'))

  for (const one of containers) running.get(one)?.cancel('replaced')

  const marked = trigger ? [...hosts, trigger] : hosts
  let restoreSnap = () => {}
  const begin = () => {
    for (const node of marked) node.setAttribute(STATE_ATTRIBUTE, 'scrolling')
    setProperty(marked, PROPERTIES.progress, 0)
    restoreSnap = suspendSnap(hosts)
    const value = detail()
    options.onStart?.(value)
    emit(EVENTS.start, value)
  }
  const finish = (arrived: boolean) => {
    restoreSnap()
    if (arrived) {
      if (options.focus) moveFocus(element)
      writeHash(element, options.hash)
      const time = options.highlight === true ? HIGHLIGHT_DURATION : options.highlight
      if (element && typeof time === 'number' && time > 0) highlight(element, time)
    }
    for (const node of marked) node.removeAttribute(STATE_ATTRIBUTE)
    setProperty(marked, PROPERTIES.progress, null)
  }

  const starts = containers.map(viewport)
  const plans = containers.map((one, index) => {
    const first = firsts[index] ?? { top: starts[index]!.y, left: starts[index]!.x }
    const start = starts[index]!
    return {
      one,
      start,
      first,
      // `when` decides once, at the start: a container it keeps still stays still.
      still: Math.hypot(first.top - start.y, first.left - start.x) < 1,
      // Positions are fixed at the start, so relative ones (`'+=400'`) do not keep moving.
      goal: (element ?? { top: first.top, left: first.left }) as ScrollTarget,
      own: { ...each[index]!, when: 'always' } as ScrollToOptions,
    }
  })
  const moving = plans.filter(plan => !plan.still)
  const distance = Math.max(
    0,
    ...moving.map(({ first, start }) => Math.hypot(first.top - start.y, first.left - start.x))
  )
  const duration = durationFor(distance, options)
  // Innermost first, so each outer container measures the target where it now is.
  const move = (eased: number) => {
    for (const { one, start, first, goal, own } of moving) {
      const to = scrollPosition(goal, own) ?? first
      setScroll(one, start.y + (to.top - start.y) * eased, start.x + (to.left - start.x) * eased)
    }
  }

  if (
    options.behavior === 'instant' ||
    prefersReducedMotion() ||
    duration === 0 ||
    !moving.length
  ) {
    begin()
    move(1)
    options.onProgress?.({ ...detail(), progress: 1, eased: 1 })
    finish(true)
    return Promise.resolve(end('arrived'))
  }

  const easing = parseEasing(options.easing)
  const interruptible = options.interruptible ?? true

  return new Promise<boolean>(resolve => {
    let frame = 0
    let begun: number | null = null
    let done = false

    const stop = (reason: ScrollEndReason) => {
      if (done) return
      done = true
      cancelAnimationFrame(frame)
      for (const one of containers) if (running.get(one) === entry) running.delete(one)
      if (interruptible) {
        for (const type of INTERRUPTIONS) window.removeEventListener(type, interrupt)
      }
      for (const signal of signals) signal.removeEventListener('abort', abort)
      finish(reason === 'arrived')
      resolve(end(reason))
    }
    const interrupt = (event: Event) => {
      if (takesOver(event)) stop('interrupted')
    }
    const abort = () => stop('cancelled')
    const entry: Running = { cancel: stop, target: element }
    for (const one of containers) running.set(one, entry)
    if (interruptible) {
      for (const type of INTERRUPTIONS) window.addEventListener(type, interrupt, { passive: true })
    }
    for (const signal of signals) signal.addEventListener('abort', abort, { once: true })
    begin()

    const step = (now: number) => {
      begun ??= now
      const progress = duration ? Math.min(1, (now - begun) / duration) : 1
      const eased = easing(progress)
      // Measure again on every frame: the target may have moved while content loaded.
      move(eased)
      setProperty(marked, PROPERTIES.progress, eased)
      options.onProgress?.({ ...detail(), progress, eased })
      if (progress < 1) frame = requestAnimationFrame(step)
      else stop('arrived')
    }
    frame = requestAnimationFrame(step)
  })
}

/** Keys that scroll the page themselves. */
const SCROLL_KEYS = /^(Arrow(Up|Down|Left|Right)|Page(Up|Down)|Home|End| )$/
/** Controls a press on which is a click, not a grab of the scroll. */
const CONTROLS = 'a[href], button, input, select, textarea, label, summary, [role="button"]'

/**
 * Whether the visitor takes over the scroll: the wheel and touch always do; a
 * key only when it scrolls, and a mouse press only outside links and buttons
 * (on the scrollbar, or to drag), so pressing Next again is not a stop.
 */
const takesOver = (event: Event) => {
  if (event.type === 'keydown') return SCROLL_KEYS.test((event as KeyboardEvent).key ?? '')
  if (event.type === 'mousedown') {
    return !(event.target instanceof Element && event.target.closest(CONTROLS))
  }
  return true
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
  const sections = readString(trigger, 'data-scroll-to-sections', '')
  if (sections) options.sections = sections
  options.focus = readBoolean(trigger, 'data-scroll-to-focus', base.focus ?? false)
  options.reveal = readBoolean(trigger, 'data-scroll-to-reveal', base.reveal ?? true)
  const hash = readEnum(trigger, 'data-scroll-to-hash', HASH, base.hash || 'false')
  options.hash = hash === 'false' ? false : hash
  // A number of milliseconds, or true and false; anything else keeps the option.
  const time = readNumber(trigger, 'data-scroll-to-highlight', NaN)
  const on = readBoolean(trigger, 'data-scroll-to-highlight', true)
  if (Number.isFinite(time)) options.highlight = time
  else if (on === readBoolean(trigger, 'data-scroll-to-highlight', false)) options.highlight = on
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
    if (!target) return
    const options = triggerOptions(trigger, base)
    if (resolveTarget(target, options) === null) return
    event.preventDefault()
    void run(target, options, trigger)
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

/**
 * A "Back to top" button: `data-scroll-to-visible` is `'true'` once the
 * container is scrolled past `threshold` and `'false'` before, and
 * `--scroll-to-scrolled` (0–1) says how far down it is, for a progress ring.
 * A click scrolls to `target` (the top by default) and moves focus there, so
 * keyboard users do not stay on a button that hides. Returns
 * `{ update, destroy }`.
 */
export const backToTop = (
  button: Element | string | null,
  { target = 'top', threshold = '100%', ...options }: BackToTopOptions = {}
): BackToTopController => {
  const none = { update: () => {}, destroy: () => {} }
  if (!isBrowser()) return none
  let element: Element | null = null
  try {
    element = typeof button === 'string' ? document.querySelector(button) : button
  } catch {
    // An invalid selector finds nothing.
  }
  if (!element) return none
  const node = element
  const container = resolveContainer(options.container)
  // Scroll events of the page fire on the window, of an element on itself.
  const events: Element | Window = container
  let frame = 0
  let alive = true

  const update = () => {
    frame = 0
    if (!alive) return
    const view = viewport(container)
    const limit = typeof threshold === 'number' ? threshold : cssLength(threshold, view.height)
    node.setAttribute(VISIBLE_ATTRIBUTE, String(view.y > 0 && view.y >= limit))
    setProperty([node], PROPERTIES.scrolled, view.maxY > 0 ? Math.min(1, view.y / view.maxY) : 0)
  }
  const schedule = () => {
    frame ||= requestAnimationFrame(update)
  }

  /** Focus lands where the visitor now is: the target, or the top of the container. */
  const land = () => {
    const resolved = resolveTarget(target, options)
    let focus: Element | null = resolved instanceof Element ? resolved : null
    if (!focus) focus = container === window ? document.body : (container as Element)
    if (
      !focus.hasAttribute('tabindex') &&
      !focus.matches('a[href], button, input, select, textarea')
    ) {
      // Focusable for now only: removed again when focus moves on.
      focus.setAttribute('tabindex', '-1')
      focus.addEventListener('blur', () => focus!.removeAttribute('tabindex'), { once: true })
    }
    ;(focus as HTMLElement).focus?.({ preventScroll: true })
  }

  const onClick = (event: Event) => {
    const mouse = event as MouseEvent
    if (event.defaultPrevented || mouse.button > 0) return
    if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) return
    // Handled here, so an `autoScrollTo` on the page leaves it alone.
    event.preventDefault()
    const { focus = true, ...rest } = options
    void run(target, { ...rest, focus: false }, node).then(arrived => {
      if (arrived && alive && focus && document.activeElement === node) land()
    })
  }

  events.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule, { passive: true })
  node.addEventListener('click', onClick)
  update()

  return {
    update: () => {
      if (alive) update()
    },
    destroy: () => {
      if (!alive) return
      alive = false
      cancelAnimationFrame(frame)
      events.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      node.removeEventListener('click', onClick)
      node.removeAttribute(VISIBLE_ATTRIBUTE)
      setProperty([node], PROPERTIES.scrolled, null)
    },
  }
}
