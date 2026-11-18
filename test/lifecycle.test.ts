import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  END_REASONS,
  EVENTS,
  STATE_ATTRIBUTE,
  autoScrollTo,
  cancelScroll,
  createScrollTo,
  isScrolling,
  scrollTo,
  type ScrollResult,
} from '../src/index.js'
import { installMotion, page, strip } from './helpers.js'

const cleanups: Array<() => void> = []

beforeEach(() => {
  installMotion(false)
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'],
  })
})

afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup())
  document.body.innerHTML = ''
  history.replaceState(null, '', '/')
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const run = (ms = 2000) => vi.advanceTimersByTime(ms)

const sections: Array<[string, number, number?]> = [
  ['intro', 0],
  ['install', 1200],
  ['usage', 2400, 200],
]

/** Collect the `scroll-to:*` events that bubble to the document. */
const listen = () => {
  const seen: Array<{ type: string; detail: ScrollResult; on: EventTarget | null }> = []
  const record = (event: Event) =>
    seen.push({
      type: event.type,
      detail: (event as CustomEvent<ScrollResult>).detail,
      on: event.target,
    })
  document.addEventListener(EVENTS.start, record)
  document.addEventListener(EVENTS.end, record)
  cleanups.push(() => {
    document.removeEventListener(EVENTS.start, record)
    document.removeEventListener(EVENTS.end, record)
  })
  return seen
}

describe('callbacks', () => {
  it('report start, every frame and the end of an animated scroll', async () => {
    const { nodes } = page(sections)
    const onStart = vi.fn()
    const onProgress = vi.fn()
    const onEnd = vi.fn()
    const done = scrollTo('#install', {
      duration: 400,
      easing: 'linear',
      onStart,
      onProgress,
      onEnd,
    })
    expect(onStart).toHaveBeenCalledWith({
      target: nodes[1],
      container: window,
      trigger: null,
      top: 0,
      left: 0,
    })
    expect(onEnd).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    const middle = onProgress.mock.lastCall![0]
    expect(middle.progress).toBeGreaterThan(0)
    expect(middle.progress).toBeLessThan(1)
    expect(middle.eased).toBeCloseTo(middle.progress)
    expect(middle.top).toBeCloseTo(1200 * middle.eased)
    run()
    await expect(done).resolves.toBe(true)
    expect(onProgress.mock.lastCall![0]).toMatchObject({ progress: 1, eased: 1, top: 1200 })
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith(
      expect.objectContaining({ arrived: true, reason: 'arrived', top: 1200, target: nodes[1] })
    )
  })

  it('run once each for a jump', async () => {
    installMotion(true)
    page(sections)
    const onStart = vi.fn()
    const onProgress = vi.fn()
    const onEnd = vi.fn()
    await expect(scrollTo(1000, { onStart, onProgress, onEnd })).resolves.toBe(true)
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ target: null, top: 0 }))
    expect(onProgress).toHaveBeenCalledTimes(1)
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ progress: 1, top: 1000 }))
    expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ arrived: true, top: 1000 }))
  })

  it('tell why a scroll ended', async () => {
    page(sections)
    const reasons: string[] = []
    const onEnd = (result: ScrollResult) => reasons.push(result.reason)

    await scrollTo('#nope', { onEnd })

    const interrupted = scrollTo('#install', { duration: 400, onEnd })
    vi.advanceTimersByTime(50)
    window.dispatchEvent(new Event('touchstart'))
    await interrupted

    const replaced = scrollTo('#install', { duration: 400, onEnd })
    const cancelled = scrollTo('#usage', { duration: 400, onEnd })
    await replaced
    cancelScroll()
    await cancelled

    expect(reasons).toEqual(['missing', 'interrupted', 'replaced', 'cancelled'])
    expect(END_REASONS).toEqual(['arrived', 'interrupted', 'replaced', 'cancelled', 'missing'])
  })
})

describe('signal', () => {
  it('stops the scroll when it aborts', async () => {
    const { state } = page(sections)
    const abort = new AbortController()
    const onEnd = vi.fn()
    const done = scrollTo('#install', { duration: 400, signal: abort.signal, onEnd })
    vi.advanceTimersByTime(100)
    abort.abort()
    await expect(done).resolves.toBe(false)
    const stopped = state.y
    run()
    expect(state.y).toBe(stopped)
    expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ reason: 'cancelled' }))
  })

  it('does not start, nor replace the running scroll, when already aborted', async () => {
    const { state } = page(sections)
    const running = scrollTo('#install', { duration: 400 })
    const onStart = vi.fn()
    const skipped = scrollTo('#usage', { signal: AbortSignal.abort(), onStart })
    await expect(skipped).resolves.toBe(false)
    expect(onStart).not.toHaveBeenCalled()
    run()
    await expect(running).resolves.toBe(true)
    expect(state.y).toBe(1200)
  })

  it('stops listening once the scroll ends', async () => {
    page(sections)
    const abort = new AbortController()
    const onEnd = vi.fn()
    const done = scrollTo('#install', { duration: 100, signal: abort.signal, onEnd })
    run()
    await done
    abort.abort()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })
})

describe('events and state', () => {
  it('dispatch bubbling start and end events on the target', async () => {
    const { nodes } = page(sections)
    const seen = listen()
    const done = scrollTo('#install', { duration: 100 })
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ type: EVENTS.start, on: nodes[1] })
    run()
    await done
    expect(seen[1]).toMatchObject({
      type: EVENTS.end,
      on: nodes[1],
      detail: { arrived: true, reason: 'arrived' },
    })
  })

  it('dispatch them on the scrolling element for positions and missing targets', async () => {
    installMotion(true)
    page(sections)
    const seen = listen()
    await scrollTo('top')
    await scrollTo('#nope')
    expect(seen.map(event => [event.type, event.on])).toEqual([
      [EVENTS.start, document.documentElement],
      [EVENTS.end, document.documentElement],
      [EVENTS.end, document.documentElement],
    ])
    expect(seen[2]!.detail.reason).toBe('missing')

    const { box } = strip()
    await scrollTo(400, { container: box })
    expect(seen[seen.length - 1]!.on).toBe(box)
  })

  it('mark the scrolling element while it runs, and report isScrolling', async () => {
    page(sections)
    const root = document.documentElement
    const { box, items } = strip()
    expect(isScrolling()).toBe(false)
    const done = scrollTo('#install', { duration: 400 })
    const side = scrollTo(items[6]!, { container: box, duration: 400 })
    expect(root.getAttribute(STATE_ATTRIBUTE)).toBe('scrolling')
    expect(box.getAttribute(STATE_ATTRIBUTE)).toBe('scrolling')
    expect(isScrolling()).toBe(true)
    expect(isScrolling(window)).toBe(true)
    expect(isScrolling(box)).toBe(true)
    run()
    await Promise.all([done, side])
    expect(root.hasAttribute(STATE_ATTRIBUTE)).toBe(false)
    expect(box.hasAttribute(STATE_ATTRIBUTE)).toBe(false)
    expect(isScrolling()).toBe(false)
  })

  it('keep the mark when one scroll replaces another', async () => {
    page(sections)
    const root = document.documentElement
    void scrollTo('#install', { duration: 400 })
    const next = scrollTo('#usage', { duration: 400 })
    expect(root.getAttribute(STATE_ATTRIBUTE)).toBe('scrolling')
    run()
    await next
    expect(root.hasAttribute(STATE_ATTRIBUTE)).toBe(false)
  })

  it('mark the trigger and pass it to callbacks with autoScrollTo', async () => {
    page(sections)
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button id="go" data-scroll-to="#usage">Go</button>'
    )
    const go = document.getElementById('go')!
    const onStart = vi.fn()
    const onEnd = vi.fn()
    const controller = autoScrollTo({ duration: 400, focus: false, hash: false, onStart, onEnd })
    cleanups.push(controller.destroy)
    go.click()
    expect(go.getAttribute(STATE_ATTRIBUTE)).toBe('scrolling')
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ trigger: go }))
    run()
    await Promise.resolve()
    expect(go.hasAttribute(STATE_ATTRIBUTE)).toBe(false)
    expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ trigger: go, arrived: true }))
  })

  it('do nothing without a DOM', () => {
    vi.stubGlobal('window', undefined)
    expect(isScrolling()).toBe(false)
  })
})

describe('createScrollTo', () => {
  it('applies its defaults, and per-call options replace them', async () => {
    installMotion(true)
    const { state } = page(sections)
    const scroller = createScrollTo({ offset: 100 })
    cleanups.push(scroller.destroy)
    expect(scroller.position('#install')).toEqual({ top: 1100, left: 0 })
    expect(scroller.position('#install', { offset: 0 })).toEqual({ top: 1200, left: 0 })
    await expect(scroller.to('#install')).resolves.toBe(true)
    expect(state.y).toBe(1100)
    await scroller.to('#usage', { offset: 0 })
    expect(state.y).toBe(2400)
  })

  it('cancels and reports on its default container', async () => {
    page(sections)
    const { box, items } = strip()
    const scroller = createScrollTo({ container: box, inline: 'center', duration: 400 })
    cleanups.push(scroller.destroy)
    const done = scroller.to(items[6]!)
    expect(scroller.isScrolling()).toBe(true)
    expect(isScrolling()).toBe(false)
    scroller.cancel()
    await expect(done).resolves.toBe(false)
    expect(scroller.isScrolling()).toBe(false)
  })

  it('handles triggers with auto() and destroys them with itself', async () => {
    installMotion(true)
    const { state } = page(sections)
    document.body.insertAdjacentHTML(
      'beforeend',
      '<a id="one" href="#install">Install</a><a id="two" href="#usage">Usage</a>'
    )
    const scroller = createScrollTo({ offset: 50 })
    const first = scroller.auto({ hash: false })
    scroller.auto({ hash: false, selector: '#two' })
    document.getElementById('one')!.click()
    expect(state.y).toBe(1150)
    first.destroy()
    first.destroy()
    state.y = 0
    document.getElementById('one')!.click()
    expect(state.y).toBe(0)
    document.getElementById('two')!.click()
    expect(state.y).toBe(2350)
    scroller.destroy()
    state.y = 0
    document.getElementById('two')!.click()
    expect(state.y).toBe(0)
  })

  it('destroy stops only its own scrolls, and later calls do nothing', async () => {
    page(sections)
    const scroller = createScrollTo({ duration: 400 })
    const own = scroller.to('#install')
    scroller.destroy()
    await expect(own).resolves.toBe(false)

    const other = scrollTo('#usage', { duration: 400 })
    scroller.destroy()
    expect(isScrolling()).toBe(true)
    await expect(scroller.to('#install')).resolves.toBe(false)
    expect(scroller.position('#install')).toBeNull()
    scroller.auto().destroy()
    run()
    await expect(other).resolves.toBe(true)
  })

  it('is inert without a DOM', async () => {
    vi.stubGlobal('window', undefined)
    const scroller = createScrollTo()
    await expect(scroller.to('#install')).resolves.toBe(false)
    expect(scroller.position('#install')).toBeNull()
    expect(scroller.isScrolling()).toBe(false)
    scroller.auto().destroy()
    scroller.cancel()
    scroller.destroy()
  })
})
