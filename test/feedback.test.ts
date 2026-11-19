import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ARRIVED_ATTRIBUTE,
  HIGHLIGHT_DURATION,
  PROPERTIES,
  VISIBLE_ATTRIBUTE,
  autoScrollTo,
  backToTop,
  scrollTo,
} from '../src/index.js'
import { installMotion, page } from './helpers.js'

const cleanups: Array<() => void> = []

beforeEach(() => {
  installMotion(false)
  vi.useFakeTimers({
    toFake: [
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
      'Date',
      'setTimeout',
      'clearTimeout',
    ],
  })
})

afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup())
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('style')
  history.replaceState(null, '', '/')
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const click = (element: Element) =>
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

const sections: Array<[string, number, number?]> = [
  ['intro', 0],
  ['install', 1200],
  ['usage', 2400, 200],
]

describe('highlight', () => {
  it('marks the target once it arrives, for 1500 ms by default', async () => {
    const { nodes } = page(sections)
    const done = scrollTo('#install', { duration: 400, highlight: true })
    vi.advanceTimersByTime(200)
    expect(nodes[1]!.hasAttribute(ARRIVED_ATTRIBUTE)).toBe(false)
    vi.advanceTimersByTime(300)
    await expect(done).resolves.toBe(true)
    expect(nodes[1]!.hasAttribute(ARRIVED_ATTRIBUTE)).toBe(true)
    vi.advanceTimersByTime(HIGHLIGHT_DURATION - 200)
    expect(nodes[1]!.hasAttribute(ARRIVED_ATTRIBUTE)).toBe(true)
    vi.advanceTimersByTime(200)
    expect(nodes[1]!.hasAttribute(ARRIVED_ATTRIBUTE)).toBe(false)
  })

  it('takes a number of milliseconds, and arriving again restarts it', async () => {
    const { nodes } = page(sections)
    await scrollTo('#install', { behavior: 'instant', highlight: 500 })
    vi.advanceTimersByTime(400)
    await scrollTo('#install', { behavior: 'instant', highlight: 500 })
    vi.advanceTimersByTime(400)
    expect(nodes[1]!.hasAttribute(ARRIVED_ATTRIBUTE)).toBe(true)
    vi.advanceTimersByTime(200)
    expect(nodes[1]!.hasAttribute(ARRIVED_ATTRIBUTE)).toBe(false)
  })

  it('stays off by default, for positions and for scrolls that do not arrive', async () => {
    const { nodes } = page(sections)
    await scrollTo('#install', { behavior: 'instant' })
    expect(nodes[1]!.hasAttribute(ARRIVED_ATTRIBUTE)).toBe(false)
    await scrollTo(600, { behavior: 'instant', highlight: true })
    expect(document.querySelector(`[${ARRIVED_ATTRIBUTE}]`)).toBeNull()
    const first = scrollTo('#usage', { duration: 400, highlight: true })
    vi.advanceTimersByTime(100)
    void scrollTo('#intro', { duration: 400 })
    await expect(first).resolves.toBe(false)
    expect(nodes[2]!.hasAttribute(ARRIVED_ATTRIBUTE)).toBe(false)
  })

  it('reads data-scroll-to-highlight on triggers', () => {
    const { nodes } = page(sections)
    document.body.insertAdjacentHTML(
      'beforeend',
      `<a id="on" href="#install" data-scroll-to-highlight>Install</a>
       <a id="time" href="#usage" data-scroll-to-highlight="300">Usage</a>
       <a id="off" href="#intro" data-scroll-to-highlight="false">Intro</a>
       <a id="typo" href="#intro" data-scroll-to-highlight="maybe">Intro</a>`
    )
    const controller = autoScrollTo({ behavior: 'instant', hash: false })
    cleanups.push(controller.destroy)
    click(document.getElementById('on')!)
    expect(nodes[1]!.hasAttribute(ARRIVED_ATTRIBUTE)).toBe(true)
    click(document.getElementById('time')!)
    vi.advanceTimersByTime(310)
    expect(nodes[2]!.hasAttribute(ARRIVED_ATTRIBUTE)).toBe(false)
    click(document.getElementById('off')!)
    click(document.getElementById('typo')!)
    expect(nodes[0]!.hasAttribute(ARRIVED_ATTRIBUTE)).toBe(false)

    controller.destroy()
    const highlighted = autoScrollTo({ behavior: 'instant', hash: false, highlight: 200 })
    cleanups.push(highlighted.destroy)
    click(document.getElementById('typo')!)
    expect(nodes[0]!.hasAttribute(ARRIVED_ATTRIBUTE)).toBe(true)
  })
})

describe('progress property', () => {
  it('follows the eased progress on the page and the trigger, then goes away', () => {
    page(sections)
    document.body.insertAdjacentHTML('beforeend', '<a id="go" href="#install">Install</a>')
    const controller = autoScrollTo({ duration: 400, easing: 'linear', hash: false })
    cleanups.push(controller.destroy)
    const trigger = document.getElementById('go')!
    const root = document.documentElement
    click(trigger)
    expect(root.style.getPropertyValue(PROPERTIES.progress)).toBe('0')
    vi.advanceTimersByTime(200)
    const value = Number(trigger.style.getPropertyValue(PROPERTIES.progress))
    expect(value).toBeGreaterThan(0.3)
    expect(value).toBeLessThan(0.7)
    expect(root.style.getPropertyValue(PROPERTIES.progress)).toBe(String(value))
    vi.advanceTimersByTime(300)
    expect(root.style.getPropertyValue(PROPERTIES.progress)).toBe('')
    expect(trigger.style.getPropertyValue(PROPERTIES.progress)).toBe('')
  })
})

describe('backToTop', () => {
  const scrollPage = (state: { y: number }, y: number) => {
    state.y = y
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(20)
  }

  it('shows past the threshold and reports how far down the page is', () => {
    const { state } = page(sections, { height: 4800 })
    document.body.insertAdjacentHTML('beforeend', '<a id="top" href="#">Back to top</a>')
    const button = document.getElementById('top')!
    const controller = backToTop(button)
    cleanups.push(controller.destroy)
    expect(button.getAttribute(VISIBLE_ATTRIBUTE)).toBe('false')
    expect(button.style.getPropertyValue(PROPERTIES.scrolled)).toBe('0')

    scrollPage(state, 400)
    expect(button.getAttribute(VISIBLE_ATTRIBUTE)).toBe('false')
    scrollPage(state, 2000)
    expect(button.getAttribute(VISIBLE_ATTRIBUTE)).toBe('true')
    expect(button.style.getPropertyValue(PROPERTIES.scrolled)).toBe('0.5')

    controller.destroy()
    controller.destroy()
    expect(button.hasAttribute(VISIBLE_ATTRIBUTE)).toBe(false)
    expect(button.style.getPropertyValue(PROPERTIES.scrolled)).toBe('')
    scrollPage(state, 0)
    expect(button.hasAttribute(VISIBLE_ATTRIBUTE)).toBe(false)
  })

  it('takes pixels or a percentage as the threshold, and update() measures again', () => {
    const { state } = page(sections)
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button id="px">Top</button><button id="pct">Top</button>'
    )
    const px = backToTop('#px', { threshold: 100 })
    const pct = backToTop(document.getElementById('pct'), { threshold: '50%' })
    cleanups.push(px.destroy, pct.destroy)
    state.y = 300
    px.update()
    pct.update()
    expect(document.getElementById('px')!.getAttribute(VISIBLE_ATTRIBUTE)).toBe('true')
    expect(document.getElementById('pct')!.getAttribute(VISIBLE_ATTRIBUTE)).toBe('false')
    scrollPage(state, 400)
    expect(document.getElementById('pct')!.getAttribute(VISIBLE_ATTRIBUTE)).toBe('true')
  })

  it('scrolls to the top on click and moves focus there', async () => {
    const { state } = page(sections)
    document.body.insertAdjacentHTML('beforeend', '<button id="top">Back to top</button>')
    const button = document.getElementById('top')!
    const controller = backToTop(button, { duration: 400 })
    cleanups.push(controller.destroy)
    state.y = 2000
    button.focus()
    click(button)
    vi.advanceTimersByTime(500)
    expect(state.y).toBe(0)
    await vi.waitFor(() => expect(document.activeElement).toBe(document.body))
    expect(document.body.getAttribute('tabindex')).toBe('-1')
    button.focus()
    expect(document.body.hasAttribute('tabindex')).toBe(false)
  })

  it('goes to its own target, and leaves focus alone with focus: false', async () => {
    const { state, nodes } = page(sections)
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button id="a">To intro</button><button id="b">Top</button>'
    )
    const a = document.getElementById('a')!
    const b = document.getElementById('b')!
    const one = backToTop(a, { target: '#install', behavior: 'instant' })
    const two = backToTop(b, { behavior: 'instant', focus: false })
    cleanups.push(one.destroy, two.destroy)
    a.focus()
    click(a)
    expect(state.y).toBe(1200)
    await vi.waitFor(() => expect(document.activeElement).toBe(nodes[1]))
    b.focus()
    click(b)
    expect(state.y).toBe(0)
    await Promise.resolve()
    expect(document.activeElement).toBe(b)
  })

  it('leaves modified clicks and clicks another script handled alone', () => {
    const { state } = page(sections)
    document.body.insertAdjacentHTML('beforeend', '<a id="top" href="#">Top</a>')
    const button = document.getElementById('top')!
    const controller = backToTop(button, { behavior: 'instant' })
    cleanups.push(controller.destroy)
    state.y = 2000
    button.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true })
    )
    expect(state.y).toBe(2000)
    const stop = (event: Event) => event.preventDefault()
    button.addEventListener('click', stop, { capture: true })
    click(button)
    expect(state.y).toBe(2000)
    button.removeEventListener('click', stop, { capture: true })
    click(button)
    expect(state.y).toBe(0)
  })

  it('does nothing for a missing button or an invalid selector', () => {
    expect(() => backToTop(null).destroy()).not.toThrow()
    expect(() => backToTop('#nope').update()).not.toThrow()
    expect(() => backToTop('[').destroy()).not.toThrow()
  })

  it('watches a scrolling element', () => {
    const box = document.createElement('div')
    let top = 0
    Object.defineProperty(box, 'clientHeight', { configurable: true, value: 200 })
    Object.defineProperty(box, 'clientWidth', { configurable: true, value: 300 })
    Object.defineProperty(box, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(box, 'scrollWidth', { configurable: true, value: 300 })
    Object.defineProperty(box, 'scrollTop', { configurable: true, get: () => top })
    Object.defineProperty(box, 'scrollLeft', { configurable: true, value: 0 })
    box.scrollTo = vi.fn((options: ScrollToOptions) => {
      top = options.top ?? top
    }) as typeof box.scrollTo
    const button = document.createElement('button')
    box.appendChild(button)
    document.body.appendChild(box)
    const controller = backToTop(button, { container: box, behavior: 'instant' })
    cleanups.push(controller.destroy)
    top = 400
    box.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(20)
    expect(button.getAttribute(VISIBLE_ATTRIBUTE)).toBe('true')
    expect(button.style.getPropertyValue(PROPERTIES.scrolled)).toBe('0.5')
    button.focus()
    click(button)
    expect(top).toBe(0)
  })
})
