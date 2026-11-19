import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  EASINGS,
  autoScrollTo,
  cubicBezier,
  scrollPosition,
  scrollTo,
  type OffsetContext,
} from '../src/index.js'
import { durationFor, parseEasing, relativeTo } from '../src/core/scroll-to.js'
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
  Reflect.deleteProperty(document, 'elementsFromPoint')
})

const run = (ms = 3000) => vi.advanceTimersByTime(ms)

const sections: Array<[string, number, number?]> = [
  ['intro', 0],
  ['install', 1200],
  ['usage', 2400, 200],
]

/** An element with a fixed box, appended to `parent`. */
const box = (rect: Partial<DOMRect>, parent: Element = document.body) => {
  const element = document.createElement('div')
  const { top = 0, height = 0, left = 0, width = 1000 } = rect
  element.getBoundingClientRect = () =>
    ({ top, height, bottom: top + height, left, width, right: left + width }) as DOMRect
  parent.appendChild(element)
  return element
}

/** Computed styles keyed by element; anything else reads as empty. */
const styles = (map: Map<Element, Record<string, string>>) =>
  vi.stubGlobal('getComputedStyle', (element: Element) => {
    const values = map.get(element) ?? {}
    return {
      position: values.position ?? 'static',
      top: values.top,
      getPropertyValue: (name: string) => values[name] ?? '',
    }
  })

describe('easing', () => {
  it('solves cubic-bezier curves like CSS', () => {
    const linear = cubicBezier(0, 0, 1, 1)
    expect(linear(0.3)).toBeCloseTo(0.3, 3)
    const ease = cubicBezier(0.25, 0.1, 0.25, 1)
    expect(ease(0.5)).toBeCloseTo(0.8024, 3)
    expect(ease(0)).toBe(0)
    expect(ease(1)).toBe(1)
    expect(ease(-1)).toBe(0)
    expect(ease(2)).toBe(1)
    // y can leave 0–1: the curve overshoots.
    expect(cubicBezier(0.3, 1.6, 0.6, 1)(0.5)).toBeGreaterThan(1)
  })

  it('reads names, cubic-bezier strings and functions, and falls back for the rest', () => {
    const own = (t: number) => t
    expect(parseEasing(own)).toBe(own)
    expect(parseEasing('ease-out-quint')).toBe(EASINGS['ease-out-quint'])
    expect(parseEasing(' cubic-bezier(0.25, 0.1, 0.25, 1) ' as 'linear')(0.5)).toBeCloseTo(
      0.8024,
      3
    )
    const fallback = EASINGS['ease-in-out']
    expect(parseEasing(undefined)).toBe(fallback)
    expect(parseEasing('bouncy' as 'linear')).toBe(fallback)
    expect(parseEasing('constructor' as 'linear')).toBe(fallback)
    expect(parseEasing('cubic-bezier(1.5, 0, 0.5, 1)')).toBe(fallback)
    expect(parseEasing('cubic-bezier(0.5, 0, -0.1, 1)')).toBe(fallback)
    expect(parseEasing('cubic-bezier(0.5, 0, 1)')).toBe(fallback)
    expect(parseEasing('cubic-bezier(0.5, , 0.5, 1)')).toBe(fallback)
    expect(parseEasing('cubic-bezier(a, 0, 0.5, 1)')).toBe(fallback)
  })

  it('has the new named curves', () => {
    expect(EASINGS['ease-in'](0.5)).toBeCloseTo(0.125)
    expect(EASINGS['ease-out-quint'](0.5)).toBeCloseTo(0.96875)
    expect(EASINGS['ease-out-back'](0)).toBeCloseTo(0)
    expect(EASINGS['ease-out-back'](1)).toBeCloseTo(1)
    expect(Math.max(...[0.6, 0.7, 0.8].map(EASINGS['ease-out-back']))).toBeGreaterThan(1)
  })

  it('animates with a cubic-bezier string', async () => {
    const { state } = page(sections)
    const seen: number[] = []
    const done = scrollTo('#install', {
      duration: 400,
      easing: 'cubic-bezier(0, 0, 1, 1)',
      onProgress: ({ progress, eased }) => seen.push(eased - progress),
    })
    run()
    await expect(done).resolves.toBe(true)
    expect(state.y).toBe(1200)
    for (const difference of seen) expect(Math.abs(difference)).toBeLessThan(0.001)
  })
})

describe('duration', () => {
  it('comes from the duration, the speed or the distance', () => {
    expect(durationFor(1200, { duration: 250 })).toBe(250)
    expect(durationFor(1200, { duration: -5 })).toBe(0)
    expect(durationFor(1200, { speed: 2000 })).toBe(600)
    expect(durationFor(1200, { duration: 'auto', speed: 400 })).toBe(3000)
    expect(durationFor(1200, { speed: 400, maxDuration: 1500 })).toBe(1500)
    expect(durationFor(100, {})).toBe(300)
    expect(durationFor(1200, {})).toBe(600)
    expect(durationFor(5000, {})).toBe(1000)
    expect(durationFor(5000, { maxDuration: 2000 })).toBe(2000)
    expect(durationFor(1200, { maxDuration: 200 })).toBe(200)
    expect(durationFor(1200, { speed: 0 })).toBe(600)
  })

  it('makes a scroll at a given speed last as long as its distance needs', async () => {
    const { state } = page(sections)
    let progress = 0
    const done = scrollTo('#install', {
      speed: 1000,
      onProgress: detail => (progress = detail.progress),
    })
    vi.advanceTimersByTime(600)
    expect(progress).toBeGreaterThan(0.4)
    expect(progress).toBeLessThan(0.6)
    run()
    await expect(done).resolves.toBe(true)
    expect(state.y).toBe(1200)
  })
})

describe('targets', () => {
  it('scroll to the bottom, relative positions and points', () => {
    const { state } = page(sections)
    state.y = 1000
    expect(scrollPosition('bottom')).toEqual({ top: 4200, left: 0 })
    expect(scrollPosition('+=400')).toEqual({ top: 1400, left: 0 })
    expect(scrollPosition('-= 200px')).toEqual({ top: 800, left: 0 })
    // Percentages of the container height (800px).
    expect(scrollPosition('+=50%')).toEqual({ top: 1400, left: 0 })
    expect(scrollPosition('-=100%')).toEqual({ top: 200, left: 0 })
    expect(scrollPosition('-=9000')).toEqual({ top: 0, left: 0 })
    expect(scrollPosition({ top: 300 })).toEqual({ top: 300, left: 0 })
    expect(scrollPosition({})).toEqual({ top: 1000, left: 0 })
    expect(scrollPosition({ top: NaN })).toEqual({ top: 1000, left: 0 })
    expect(relativeTo('=400', 0, 0)).toBeNull()
    expect(scrollPosition({ top: '+=abc' as '+=1' })).toEqual({ top: 1000, left: 0 })
  })

  it('move a strip sideways by a page', () => {
    const { box: container } = strip(10)
    expect(scrollPosition({ left: '+=100%' }, { container })).toEqual({ top: 0, left: 600 })
    expect(scrollPosition({ left: 1e6 }, { container })).toEqual({ top: 0, left: 1400 })
  })

  it('fix relative positions at the start, so they do not keep moving', async () => {
    const { state } = page(sections)
    state.y = 500
    const done = scrollTo('+=400', { duration: 400 })
    run()
    await expect(done).resolves.toBe(true)
    expect(state.y).toBe(900)
  })
})

describe('offset', () => {
  it('adds up arrays and calls functions with the context', () => {
    page(sections)
    const header = box({ height: 64 })
    header.id = 'header'
    const seen: OffsetContext[] = []
    const offset = (context: OffsetContext) => {
      seen.push(context)
      return 10
    }
    expect(scrollPosition('#install', { offset: ['#header', 16, '1%', offset] })!.top).toBe(1102)
    expect(seen[0]).toEqual({ container: window, target: document.getElementById('install') })
    expect(scrollPosition('#install', { offset: () => NaN })!.top).toBe(1200)
    expect(scrollPosition('#install', { offset: '[[bad' })!.top).toBe(1200)
    expect(scrollPosition('#install', { offset: [] })!.top).toBe(1200)
  })

  it("'css' reads scroll-padding-top and scroll-margin-top", () => {
    const { nodes } = page(sections)
    const map = new Map<Element, Record<string, string>>([
      [document.documentElement, { 'scroll-padding-top': '72px' }],
      [nodes[1]!, { 'scroll-margin-top': '8px' }],
    ])
    styles(map)
    expect(scrollPosition('#install', { offset: 'css' })!.top).toBe(1120)
    map.set(document.documentElement, { 'scroll-padding-top': '10%' })
    expect(scrollPosition('#install', { offset: 'css' })!.top).toBe(1112)
    map.set(document.documentElement, { 'scroll-padding-top': 'auto' })
    expect(scrollPosition('#install', { offset: ['css', 2] })!.top).toBe(1190)
  })

  it("'auto' measures fixed and sticky elements stuck at the top", () => {
    page(sections)
    const header = box({ top: 0, height: 64 })
    const banner = box({ top: 64, height: 40 })
    const below = box({ top: 300, height: 50 })
    const overlay = box({ top: 0, height: 800 })
    const plain = box({ top: 0, height: 120 })
    const hidden = box({ top: -80, height: 64 })
    const map = new Map<Element, Record<string, string>>([
      [header, { position: 'fixed' }],
      [banner, { position: 'sticky' }],
      [below, { position: 'fixed' }],
      [overlay, { position: 'fixed' }],
      [hidden, { position: 'fixed' }],
    ])
    styles(map)
    const at = vi.fn(() => [
      header,
      header,
      document.documentElement,
      overlay,
      plain,
      below,
      hidden,
    ])
    Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: at })
    expect(scrollPosition('#install', { offset: 'auto' })!.top).toBe(1136)
    expect(at).toHaveBeenCalledWith(100, 1)
    // A sticky banner that reaches the top too.
    at.mockReturnValue([banner, header] as never)
    banner.getBoundingClientRect = () =>
      ({ top: 0, bottom: 104, height: 104, left: 0, right: 1000, width: 1000 }) as DOMRect
    expect(scrollPosition('#install', { offset: 'auto' })!.top).toBe(1096)
  })

  it("'auto' stacks a bar stuck below the header", () => {
    page(sections)
    const header = box({ top: 0, height: 64 })
    const notice = box({ top: 64, height: 36 })
    styles(
      new Map<Element, Record<string, string>>([
        [header, { position: 'fixed' }],
        [notice, { position: 'sticky' }],
      ])
    )
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: (_x: number, y: number) => (y < 64 ? [header] : y < 100 ? [notice] : []),
    })
    expect(scrollPosition('#install', { offset: 'auto' })!.top).toBe(1100)
  })

  it("'auto' counts sticky elements before the target that are not stuck yet", () => {
    const { nodes } = page(sections)
    // A 40px sticky bar right before #install, sticking 64px from the top, far down the page.
    const bar = document.createElement('div')
    bar.getBoundingClientRect = () => ({ top: 1160, height: 40, bottom: 1200 }) as DOMRect
    nodes[1]!.before(bar)
    const wrapper = document.createElement('div')
    const nested = document.createElement('p')
    wrapper.append(nested)
    document.body.prepend(wrapper)
    const tall = document.createElement('div')
    tall.getBoundingClientRect = () => ({ top: 0, height: 600, bottom: 600 }) as DOMRect
    nodes[0]!.before(tall)
    const loose = document.createElement('div')
    nodes[0]!.before(loose)
    styles(
      new Map<Element, Record<string, string>>([
        [bar, { position: 'sticky', top: '64px' }],
        [tall, { position: 'sticky', top: '0px' }],
        [loose, { position: 'sticky', top: 'auto' }],
        [nested, { position: 'sticky', top: '0px' }],
      ])
    )
    // 64px + 40px; the tall one, the one without top and the nested one do not count.
    expect(scrollPosition('#install', { offset: 'auto' })!.top).toBe(1096)
    // #intro has nothing sticky before it.
    expect(scrollPosition('#intro', { offset: 'auto' })!.top).toBe(0)
  })

  it("'auto' only counts elements inside a container", () => {
    const { box: container, items } = strip(4)
    const inside = box({ top: 0, height: 30 }, container)
    const outside = box({ top: 0, height: 60 })
    styles(
      new Map<Element, Record<string, string>>([
        [inside, { position: 'sticky' }],
        [outside, { position: 'fixed' }],
      ])
    )
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: () => [outside, inside, container],
    })
    // The strip is 100px tall: a 30px sticky bar is less than half of it.
    items[0]!.getBoundingClientRect = () =>
      ({ top: 200, bottom: 300, left: 100, right: 300, width: 200, height: 100 }) as DOMRect
    expect(scrollPosition(items[0]!, { container, offset: 'auto' })!.top).toBe(0)
  })

  it("'auto' is 0 without elementsFromPoint", () => {
    page(sections)
    expect(scrollPosition('#install', { offset: 'auto' })!.top).toBe(1200)
  })
})

describe("when: 'needed'", () => {
  it('stays when the target is fully visible below the offset', async () => {
    const { state, scrollTo: native } = page(sections)
    state.y = 1000
    // #install spans 200–600 in the 800px view.
    expect(scrollPosition('#install', { when: 'needed' })).toEqual({ top: 1000, left: 0 })
    expect(scrollPosition('#install', { when: 'needed', offset: 250 })).toEqual({
      top: 950,
      left: 0,
    })
    native.mockClear()
    await expect(scrollTo('#install', { when: 'needed', focus: true })).resolves.toBe(true)
    expect(state.y).toBe(1000)
    expect(document.activeElement?.id).toBe('install')
  })

  it('scrolls when it is partly hidden, and does not stop once it comes into view', async () => {
    const { state } = page(sections)
    state.y = 1500
    expect(scrollPosition('#install', { when: 'needed' })!.top).toBe(1200)
    state.y = 0
    const done = scrollTo('#install', { when: 'needed', duration: 400, block: 'start' })
    run()
    await expect(done).resolves.toBe(true)
    expect(state.y).toBe(1200)
  })
})

describe('trigger attributes', () => {
  it('read the speed, easing, when and relative targets', async () => {
    installMotion(true)
    const { state } = page(sections)
    document.body.insertAdjacentHTML(
      'beforeend',
      `<button id="down" data-scroll-to="+=300">Down</button>
       <button id="bottom" data-scroll-to="bottom">Bottom</button>
       <button id="install-link" data-scroll-to="#install" data-scroll-to-when="needed">Install</button>`
    )
    const controller = autoScrollTo({ focus: false, hash: false })
    cleanups.push(controller.destroy)
    document.getElementById('down')!.click()
    expect(state.y).toBe(300)
    document.getElementById('bottom')!.click()
    expect(state.y).toBe(4200)
    state.y = 1000
    document.getElementById('install-link')!.click()
    expect(state.y).toBe(1000)
  })

  it('pass speed and easing to the scroll', () => {
    page(sections)
    document.body.insertAdjacentHTML(
      'beforeend',
      `<button id="go" data-scroll-to="#install" data-scroll-to-speed="600" data-scroll-to-easing="cubic-bezier(0, 0, 1, 1)">Go</button>
       <button id="bad" data-scroll-to="#install" data-scroll-to-speed="-3" data-scroll-to-when="maybe">Bad</button>`
    )
    const seen: Array<{ progress: number; eased: number }> = []
    const controller = autoScrollTo({
      focus: false,
      hash: false,
      onProgress: ({ progress, eased }) => seen.push({ progress, eased }),
    })
    cleanups.push(controller.destroy)
    document.getElementById('go')!.click()
    vi.advanceTimersByTime(1000)
    // 1200px at 600px/s: half-way after a second, on a linear curve.
    expect(seen[seen.length - 1]!.progress).toBeCloseTo(0.5, 1)
    expect(seen[seen.length - 1]!.eased).toBeCloseTo(seen[seen.length - 1]!.progress, 2)
    run()
    seen.length = 0
    document.getElementById('bad')!.click()
    run()
    expect(seen.length).toBeGreaterThan(0)
  })
})
