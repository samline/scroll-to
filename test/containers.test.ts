import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { cancelScroll, isScrolling, scrollPosition, scrollTo } from '../src/index.js'
import { installMotion, page } from './helpers.js'

beforeEach(() => {
  installMotion(false)
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'],
  })
})

afterEach(() => {
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('style')
  document.body.removeAttribute('style')
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/**
 * A 300px tall box at document position 1000 that scrolls 1500px of content,
 * with `#deep` 900px down inside it, on a page that scrolls too.
 */
const nested = () => {
  const { state } = page([['intro', 0]])
  const box = document.createElement('div')
  box.style.overflowY = 'auto'
  let inner = 0
  Object.defineProperty(box, 'clientHeight', { configurable: true, value: 300 })
  Object.defineProperty(box, 'clientWidth', { configurable: true, value: 500 })
  Object.defineProperty(box, 'scrollHeight', { configurable: true, value: 1500 })
  Object.defineProperty(box, 'scrollWidth', { configurable: true, value: 500 })
  Object.defineProperty(box, 'scrollTop', { configurable: true, get: () => inner })
  Object.defineProperty(box, 'scrollLeft', { configurable: true, value: 0 })
  box.getBoundingClientRect = () => {
    const top = 1000 - state.y
    return { top, bottom: top + 300, height: 300, left: 0, right: 500, width: 500 } as DOMRect
  }
  box.scrollTo = vi.fn((options: ScrollToOptions) => {
    inner = options.top ?? inner
  }) as typeof box.scrollTo
  const deep = document.createElement('p')
  deep.id = 'deep'
  deep.getBoundingClientRect = () => {
    const top = 1000 - state.y + 900 - inner
    return { top, bottom: top + 100, height: 100, left: 0, right: 500, width: 500 } as DOMRect
  }
  box.appendChild(deep)
  document.body.appendChild(box)
  return { state, box, deep, inner: () => inner }
}

describe("container: 'auto'", () => {
  it('scrolls the box and then the page, like scrollIntoView', async () => {
    const { state, inner } = nested()
    await expect(scrollTo('#deep', { container: 'auto', behavior: 'instant' })).resolves.toBe(true)
    expect(inner()).toBe(900)
    expect(state.y).toBe(1000)
  })

  it('keeps the offset for the page, the outermost container', async () => {
    const { state, inner } = nested()
    await scrollTo('#deep', { container: 'auto', behavior: 'instant', offset: 64 })
    expect(inner()).toBe(900)
    expect(state.y).toBe(936)
  })

  it('animates both together and lands exactly', async () => {
    const { state, inner, box } = nested()
    const onEnd = vi.fn()
    const done = scrollTo('#deep', { container: 'auto', duration: 400, easing: 'linear', onEnd })
    vi.advanceTimersByTime(200)
    expect(inner()).toBeGreaterThan(0)
    expect(inner()).toBeLessThan(900)
    expect(state.y).toBeGreaterThan(0)
    expect(isScrolling(box)).toBe(true)
    expect(isScrolling()).toBe(true)
    vi.advanceTimersByTime(300)
    await expect(done).resolves.toBe(true)
    expect([inner(), state.y]).toEqual([900, 1000])
    expect(onEnd.mock.lastCall![0].container).toBe(box)
    expect(isScrolling(box)).toBe(false)
  })

  it('stops for both when either container is cancelled', async () => {
    const { box } = nested()
    const done = scrollTo('#deep', { container: 'auto', duration: 400 })
    vi.advanceTimersByTime(100)
    cancelScroll()
    await expect(done).resolves.toBe(false)
    expect(isScrolling(box)).toBe(false)
  })

  it('leaves a container the target is already visible in alone with when: needed', async () => {
    const { state, inner, box } = nested()
    ;(box.scrollTo as unknown as (options: ScrollToOptions) => void)({ top: 800 })
    await scrollTo('#deep', { container: 'auto', behavior: 'instant', when: 'needed' })
    expect(inner()).toBe(800)
    // The page still has to bring the box, and the target in it, into view.
    expect(state.y).toBe(1100)
  })

  it('measures with the nearest container in scrollPosition', () => {
    nested()
    expect(scrollPosition('#deep', { container: 'auto' })).toEqual({ top: 900, left: 0 })
  })

  it('uses the page for positions and for targets outside any box', async () => {
    const { state } = nested()
    await scrollTo(400, { container: 'auto', behavior: 'instant' })
    expect(state.y).toBe(400)
    await scrollTo('#intro', { container: 'auto', behavior: 'instant' })
    expect(state.y).toBe(0)
  })

  it('skips ancestors that do not scroll and a page that cannot', async () => {
    const { box, inner } = nested()
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 800,
    })
    const plain = document.createElement('div')
    box.replaceWith(plain)
    plain.appendChild(box)
    plain.style.overflowY = 'hidden'
    await scrollTo('#deep', { container: 'auto', behavior: 'instant' })
    expect(inner()).toBe(900)
  })
})

describe('scroll-snap', () => {
  it('is turned off while the scroll runs and restored after', async () => {
    page([
      ['intro', 0],
      ['install', 1200],
    ])
    const root = document.documentElement
    root.style.setProperty('scroll-snap-type', 'y mandatory')
    const done = scrollTo('#install', { duration: 400 })
    vi.advanceTimersByTime(200)
    expect(root.style.getPropertyValue('scroll-snap-type')).toBe('none')
    vi.advanceTimersByTime(300)
    await done
    expect(root.style.getPropertyValue('scroll-snap-type')).toBe('y mandatory')
  })

  it('removes its own value when the snap came from a stylesheet', async () => {
    page([
      ['intro', 0],
      ['install', 1200],
    ])
    const style = document.createElement('style')
    style.textContent = 'html { scroll-snap-type: y proximity }'
    document.head.appendChild(style)
    const root = document.documentElement
    const done = scrollTo('#install', { duration: 400 })
    vi.advanceTimersByTime(200)
    expect(root.style.getPropertyValue('scroll-snap-type')).toBe('none')
    vi.advanceTimersByTime(300)
    await done
    expect(root.style.getPropertyValue('scroll-snap-type')).toBe('')
    style.remove()
  })
})

describe('right to left', () => {
  /** A right-to-left strip: scrollLeft goes from 0 (right) to -1400 (left). */
  const rtl = () => {
    const box = document.createElement('div')
    box.style.direction = 'rtl'
    let left = 0
    Object.defineProperty(box, 'clientWidth', { configurable: true, value: 600 })
    Object.defineProperty(box, 'clientHeight', { configurable: true, value: 100 })
    Object.defineProperty(box, 'scrollWidth', { configurable: true, value: 2000 })
    Object.defineProperty(box, 'scrollHeight', { configurable: true, value: 100 })
    Object.defineProperty(box, 'scrollLeft', { configurable: true, get: () => left })
    Object.defineProperty(box, 'scrollTop', { configurable: true, value: 0 })
    box.getBoundingClientRect = () => ({ top: 0, left: 100, width: 600, height: 100 }) as DOMRect
    box.scrollTo = vi.fn((options: ScrollToOptions) => {
      left = options.left ?? left
    }) as typeof box.scrollTo
    const items = Array.from({ length: 10 }, (_, index) => {
      const item = document.createElement('button')
      item.getBoundingClientRect = () => {
        const x = 700 - (index + 1) * 200 - left
        return { top: 0, bottom: 100, left: x, right: x + 200, width: 200, height: 100 } as DOMRect
      }
      box.appendChild(item)
      return item
    })
    document.body.appendChild(box)
    return { box, items, scrollLeft: () => left }
  }

  it("aligns inline 'start' to the right edge and clamps to negative positions", async () => {
    const { box, items, scrollLeft } = rtl()
    const options = { container: box, behavior: 'instant' as const, block: 'nearest' as const }
    await scrollTo(items[5]!, { ...options, inline: 'start' })
    expect(scrollLeft()).toBe(-1000)
    await scrollTo(items[4]!, { ...options, inline: 'end' })
    expect(scrollLeft()).toBe(-400)
    await scrollTo(items[9]!, { ...options, inline: 'start' })
    expect(scrollLeft()).toBe(-1400)
    await scrollTo({ left: -300 }, options)
    expect(scrollLeft()).toBe(-300)
    await scrollTo({ left: 50 }, options)
    expect(scrollLeft()).toBe(0)
  })

  it("steps forward to the left with 'next'", async () => {
    const { box, scrollLeft } = rtl()
    const options = {
      container: box,
      behavior: 'instant' as const,
      sections: 'button',
      inline: 'start' as const,
      block: 'nearest' as const,
    }
    await scrollTo('next', options)
    expect(scrollLeft()).toBe(-200)
    await scrollTo('next', options)
    expect(scrollLeft()).toBe(-400)
    await scrollTo('prev', options)
    expect(scrollLeft()).toBe(-200)
  })

  it('reads the direction of the page from the body', () => {
    page([['intro', 0]])
    document.body.style.direction = 'rtl'
    Object.defineProperty(document.documentElement, 'scrollWidth', {
      configurable: true,
      value: 1500,
    })
    expect(scrollPosition({ left: -200 })).toEqual({ top: 0, left: -200 })
    expect(scrollPosition({ left: 200 })).toEqual({ top: 0, left: 0 })
  })
})
