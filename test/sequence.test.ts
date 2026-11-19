import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { autoScrollTo, cancelScroll, isScrolling, scrollTo } from '../src/index.js'
import { scrollSequence, type SequenceState } from '../src/sequence/index.js'
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
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const sections: Array<[string, number, number?]> = [
  ['one', 0],
  ['two', 1000],
  ['three', 2000],
  ['four', 3000],
]

/** Advance time and let promise callbacks run between frames. */
const tick = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms)
}

describe('queue', () => {
  it('waits for the running scroll instead of replacing it', async () => {
    const { state } = page(sections)
    const ends: Array<[string, number]> = []
    const onEnd = ({ reason }: { reason: string }) => ends.push([reason, state.y])
    const first = scrollTo('#two', { duration: 400, onEnd })
    const second = scrollTo('#three', { duration: 400, queue: true, onEnd })
    const third = scrollTo('#four', { duration: 400, queue: true, onEnd })
    await tick(1500)
    expect(await Promise.all([first, second, third])).toEqual([true, true, true])
    expect(ends).toEqual([
      ['arrived', 1000],
      ['arrived', 2000],
      ['arrived', 3000],
    ])
  })

  it('starts at once when nothing runs', async () => {
    const { state } = page(sections)
    await expect(scrollTo('#two', { behavior: 'instant', queue: true })).resolves.toBe(true)
    expect(state.y).toBe(1000)
  })

  it('a scroll without queue replaces the running one and the waiting ones', async () => {
    const { state } = page(sections)
    const onEnd = vi.fn()
    const first = scrollTo('#two', { duration: 400 })
    const waiting = scrollTo('#three', { duration: 400, queue: true, onEnd })
    await tick(100)
    const direct = scrollTo('#four', { duration: 400 })
    await tick(500)
    expect(await Promise.all([first, waiting, direct])).toEqual([false, false, true])
    expect(onEnd.mock.lastCall![0].reason).toBe('replaced')
    expect(state.y).toBe(3000)
  })

  it('an interruption or cancelScroll() ends the waiting ones unstarted', async () => {
    const { state } = page(sections)
    const onEnd = vi.fn()
    void scrollTo('#two', { duration: 400 })
    const waiting = scrollTo('#three', { duration: 400, queue: true, onEnd })
    await tick(100)
    window.dispatchEvent(new Event('wheel'))
    await expect(waiting).resolves.toBe(false)
    expect(onEnd.mock.lastCall![0].reason).toBe('interrupted')
    const moved = state.y
    await tick(500)
    expect(state.y).toBe(moved)

    void scrollTo('#one', { duration: 400 })
    const later = scrollTo('#four', { duration: 400, queue: true, onEnd })
    cancelScroll()
    await expect(later).resolves.toBe(false)
    expect(onEnd.mock.lastCall![0].reason).toBe('cancelled')
    expect(isScrolling()).toBe(false)
  })

  it('reads data-scroll-to-queue on triggers', async () => {
    const { state } = page(sections)
    document.body.insertAdjacentHTML(
      'beforeend',
      `<button id="a" data-scroll-to="#two">Two</button>
       <button id="b" data-scroll-to="#three" data-scroll-to-queue>Three</button>`
    )
    const controller = autoScrollTo({ duration: 400, hash: false, focus: false })
    cleanups.push(controller.destroy)
    const arrivals: number[] = []
    document.addEventListener('scroll-to:end', () => arrivals.push(state.y))
    document.getElementById('a')!.click()
    document.getElementById('b')!.click()
    await tick(1000)
    expect(arrivals).toEqual([1000, 2000])
  })
})

describe('scrollSequence', () => {
  it('steps by hand, with next, prev and goTo', async () => {
    const { state } = page(sections)
    const changes: SequenceState[] = []
    const tour = scrollSequence(['#one', '#two', { target: '#three', offset: 100 }], {
      behavior: 'instant',
      onChange: change => changes.push(change),
    })
    cleanups.push(tour.destroy)
    expect([tour.index, tour.length, tour.playing]).toEqual([-1, 3, false])
    await expect(tour.prev()).resolves.toBe(false)
    await expect(tour.next()).resolves.toBe(true)
    await tour.next()
    expect(state.y).toBe(1000)
    await tour.next()
    expect(state.y).toBe(1900)
    await expect(tour.next()).resolves.toBe(false)
    await tour.prev()
    expect([tour.index, state.y]).toEqual([1, 1000])
    await tour.goTo(99)
    expect(tour.index).toBe(2)
    expect(changes.map(change => change.index)).toEqual([0, 1, 2, 1, 2])
    expect(changes[2]!.step).toEqual({ target: '#three', offset: 100 })
  })

  it('plays through the steps with a pause on each, then stops', async () => {
    const { state } = page(sections)
    const changes: SequenceState[] = []
    const tour = scrollSequence(['#two', { target: '#three', pause: 300 }, '#four'], {
      duration: 400,
      pause: 1000,
      onChange: change => changes.push(change),
    })
    cleanups.push(tour.destroy)
    tour.play()
    tour.play()
    expect(tour.playing).toBe(true)
    await tick(450)
    expect([tour.index, state.y]).toEqual([0, 1000])
    await tick(900)
    expect(state.y).toBe(1000)
    await tick(550)
    expect([tour.index, state.y]).toEqual([1, 2000])
    await tick(350 + 450)
    expect([tour.index, state.y]).toEqual([2, 3000])
    expect(tour.playing).toBe(false)
    expect(changes[changes.length - 1]).toMatchObject({ index: 2, playing: false })

    // Played again from the end, it starts over.
    tour.toggle()
    await tick(450)
    expect([tour.index, state.y]).toEqual([0, 1000])
    tour.toggle()
    expect(tour.playing).toBe(false)
    await tick(3000)
    expect(tour.index).toBe(0)
  })

  it('loops, and autoplay starts it at once', async () => {
    const { state } = page(sections)
    const tour = scrollSequence(['#two', '#three'], {
      behavior: 'instant',
      pause: 500,
      loop: true,
      autoplay: true,
    })
    cleanups.push(tour.destroy)
    await tick(0)
    expect(state.y).toBe(1000)
    await tick(500)
    expect(state.y).toBe(2000)
    await tick(500)
    expect([tour.index, state.y, tour.playing]).toEqual([0, 1000, true])
    tour.pause()
    await tour.prev()
    expect(tour.index).toBe(1)
  })

  it('pauses when the visitor takes over or another scroll replaces it', async () => {
    page(sections)
    const tour = scrollSequence(['#two', '#three', '#four'], { duration: 400, pause: 100 })
    cleanups.push(tour.destroy)
    tour.play()
    await tick(100)
    window.dispatchEvent(new Event('wheel'))
    await tick(0)
    expect(tour.playing).toBe(false)

    tour.play()
    await tick(100)
    void scrollTo('#one', { duration: 100 })
    await tick(200)
    expect(tour.playing).toBe(false)
  })

  it('destroy() stops its scroll and every later call does nothing', async () => {
    const { state } = page(sections)
    const onEnd = vi.fn()
    const tour = scrollSequence(['#two', '#three'], { duration: 400, onEnd })
    tour.play()
    await tick(100)
    tour.destroy()
    tour.destroy()
    await tick(0)
    expect(onEnd.mock.lastCall![0].reason).toBe('cancelled')
    const moved = state.y
    await tick(3000)
    expect(state.y).toBe(moved)
    expect(tour.playing).toBe(false)
    tour.play()
    await expect(tour.next()).resolves.toBe(false)
    expect(tour.playing).toBe(false)
  })

  it('does nothing with no steps', async () => {
    page(sections)
    const tour = scrollSequence([])
    tour.play()
    expect(tour.playing).toBe(false)
    await expect(tour.goTo(0)).resolves.toBe(false)
  })
})
