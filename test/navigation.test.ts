import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { autoScrollTo, scrollPosition, scrollTo, type ScrollResult } from '../src/index.js'
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

const run = (ms = 3000) => vi.advanceTimersByTime(ms)

const sections: Array<[string, number, number?]> = [
  ['intro', 0],
  ['install', 1200],
  ['usage', 2400, 200],
  ['end', 4700, 300],
]

describe("'next' and 'prev'", () => {
  it('find the next and previous section from where the page is', () => {
    const { state } = page(sections)
    expect(scrollPosition('next')!.top).toBe(1200)
    expect(scrollPosition('prev')).toBeNull()
    state.y = 1200
    expect(scrollPosition('next')!.top).toBe(2400)
    expect(scrollPosition('prev')!.top).toBe(0)
    state.y = 600
    expect(scrollPosition('next')!.top).toBe(1200)
    expect(scrollPosition('prev')!.top).toBe(0)
  })

  it('skip sections they cannot move to, at the end of the page', async () => {
    const { state } = page(sections)
    state.y = 4200
    // #end cannot reach the top: the page stops at 4200.
    expect(scrollPosition('next')).toBeNull()
    expect(scrollPosition('prev')!.top).toBe(2400)
    const onEnd = vi.fn()
    await expect(scrollTo('next', { onEnd })).resolves.toBe(false)
    expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ reason: 'missing' }))
  })

  it('respect the offset and the sections selector, and skip hidden ones', () => {
    const { state, nodes } = page(sections)
    nodes[1]!.classList.add('step')
    nodes[3]!.classList.add('step')
    const hidden = document.createElement('section')
    hidden.className = 'step'
    hidden.getBoundingClientRect = () => ({ top: 0, height: 0, width: 0 }) as DOMRect
    nodes[1]!.before(hidden)
    state.y = 1120
    // With an 80px offset, #install is where the page already is.
    expect(scrollPosition('next', { offset: 80 })!.top).toBe(2320)
    expect(scrollPosition('next', { offset: 80, sections: '.step' })!.top).toBe(4200)
    expect(scrollPosition('prev', { offset: 80, sections: '.step' })).toBeNull()
    expect(scrollPosition('next', { sections: '[[bad' })).toBeNull()
  })

  it('step sideways through a strip', () => {
    const { box, items } = strip(6)
    const options = { container: box, sections: 'button', inline: 'start' as const }
    expect(scrollPosition('next', options)).toEqual({ top: 0, left: 200 })
    box.scrollTo({ left: 600 })
    expect(scrollPosition('prev', options)).toEqual({ top: 0, left: 400 })
    expect(items).toHaveLength(6)
  })

  it('step on from a scroll that is still on its way, so quick presses add up', async () => {
    const { state } = page(sections)
    const first = scrollTo('next', { duration: 400 })
    vi.advanceTimersByTime(50)
    const second = scrollTo('next', { duration: 400 })
    await expect(first).resolves.toBe(false)
    run()
    await expect(second).resolves.toBe(true)
    expect(state.y).toBe(2400)

    void scrollTo('prev', { duration: 400 })
    vi.advanceTimersByTime(50)
    const back = scrollTo('prev', { duration: 400 })
    run()
    await back
    expect(state.y).toBe(0)

    void scrollTo('next', { duration: 400 })
    void scrollTo('next', { duration: 400 })
    void scrollTo('next', { duration: 400 })
    // Past the last section: nothing more to step to.
    await expect(scrollTo('next', { duration: 400 })).resolves.toBe(false)
    run()
  })
})

describe('reveal', () => {
  const nested = () => {
    page(sections)
    document.body.insertAdjacentHTML(
      'beforeend',
      `<details id="outer"><summary><span id="label">Label</span></summary>
         <div hidden="until-found" id="found"><details id="inner"><summary>Inner</summary>
           <p id="answer">Answer</p>
         </details></div>
       </details>`
    )
    for (const id of ['answer', 'label']) {
      document.getElementById(id)!.getBoundingClientRect = () =>
        ({ top: 900, bottom: 950, left: 0, right: 100, width: 100, height: 50 }) as DOMRect
    }
  }

  it('opens closed details and hidden="until-found" content around the target', async () => {
    installMotion(true)
    nested()
    const matched = vi.fn()
    document.getElementById('found')!.addEventListener('beforematch', matched)
    await expect(scrollTo('#answer')).resolves.toBe(true)
    expect((document.getElementById('inner') as HTMLDetailsElement).open).toBe(true)
    expect((document.getElementById('outer') as HTMLDetailsElement).open).toBe(true)
    expect(document.getElementById('found')!.hasAttribute('hidden')).toBe(false)
    expect(matched).toHaveBeenCalledTimes(1)
  })

  it('leaves a details closed when the target is in its summary, or with reveal: false', async () => {
    installMotion(true)
    nested()
    await scrollTo('#label')
    expect((document.getElementById('outer') as HTMLDetailsElement).open).toBe(false)
    await scrollTo('#answer', { reveal: false })
    expect((document.getElementById('inner') as HTMLDetailsElement).open).toBe(false)
    expect(document.getElementById('found')!.getAttribute('hidden')).toBe('until-found')
    // Measuring never opens anything.
    scrollPosition('#answer')
    expect((document.getElementById('inner') as HTMLDetailsElement).open).toBe(false)
  })
})

describe('trigger attributes', () => {
  it('step with data-scroll-to="next" through their own sections', () => {
    installMotion(true)
    const { state, nodes } = page(sections)
    nodes[2]!.classList.add('chapter')
    document.body.insertAdjacentHTML(
      'beforeend',
      `<button id="next" data-scroll-to="next">Next</button>
       <button id="chapter" data-scroll-to="next" data-scroll-to-sections=".chapter">Chapter</button>
       <button id="prev" data-scroll-to="prev">Prev</button>`
    )
    const controller = autoScrollTo({ hash: false, focus: false })
    cleanups.push(controller.destroy)
    document.getElementById('next')!.click()
    expect(state.y).toBe(1200)
    document.getElementById('prev')!.click()
    expect(state.y).toBe(0)
    document.getElementById('chapter')!.click()
    expect(state.y).toBe(2400)
    // No previous section from the top: the click is left alone.
    state.y = 0
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    document.getElementById('prev')!.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
  })

  it('read focus, hash and reveal', async () => {
    installMotion(true)
    page(sections)
    document.body.insertAdjacentHTML(
      'beforeend',
      `<a id="quiet" href="#install" data-scroll-to-focus="false" data-scroll-to-hash="false">Install</a>
       <a id="replace" href="#usage" data-scroll-to-hash="replace">Usage</a>
       <a id="typo" href="#intro" data-scroll-to-hash="pushh">Intro</a>
       <details id="box"><summary>More</summary><p id="more">More</p></details>
       <a id="closed" href="#more" data-scroll-to-reveal="false">More</a>`
    )
    const ends: ScrollResult[] = []
    const controller = autoScrollTo({ onEnd: result => ends.push(result) })
    cleanups.push(controller.destroy)
    const length = history.length
    document.getElementById('quiet')!.click()
    expect(location.hash).toBe('')
    expect(document.activeElement?.id).not.toBe('install')
    document.getElementById('replace')!.click()
    expect(location.hash).toBe('#usage')
    expect(history.length).toBe(length)
    expect(document.activeElement?.id).toBe('usage')
    // An unknown value keeps the option: autoScrollTo pushes.
    document.getElementById('typo')!.click()
    expect(location.hash).toBe('#intro')
    expect(history.length).toBe(length + 1)
    document.getElementById('closed')!.click()
    expect((document.getElementById('box') as HTMLDetailsElement).open).toBe(false)
    expect(ends.every(end => end.arrived)).toBe(true)
  })
})

describe('interruptions', () => {
  it('come from the wheel, touch, scrolling keys and presses outside controls', async () => {
    const { state } = page(sections)
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button id="go">Go</button><p id="text">Text</p><a id="link" href="#usage"><span id="inner">Usage</span></a>'
    )
    const reasons: string[] = []
    const onEnd = ({ reason }: ScrollResult) => reasons.push(reason)
    const keep = async (fire: () => void) => {
      const done = scrollTo(state.y > 600 ? 'top' : '#install', { duration: 400, onEnd })
      vi.advanceTimersByTime(50)
      fire()
      run()
      await done
    }
    const key = (key: string) => () => window.dispatchEvent(new KeyboardEvent('keydown', { key }))
    const press = (id: string) => () =>
      document.getElementById(id)!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))

    for (const fire of [key('Tab'), key('Enter'), key('Shift'), press('go'), press('inner')]) {
      await keep(fire)
    }
    expect(reasons).toEqual(['arrived', 'arrived', 'arrived', 'arrived', 'arrived'])
    reasons.length = 0
    for (const fire of [key('ArrowDown'), key('PageUp'), key(' '), key('End'), press('text')]) {
      await keep(fire)
    }
    expect(reasons).toEqual([
      'interrupted',
      'interrupted',
      'interrupted',
      'interrupted',
      'interrupted',
    ])
    reasons.length = 0
    await keep(() => window.dispatchEvent(new Event('keydown')))
    await keep(() => window.dispatchEvent(new Event('mousedown')))
    expect(reasons).toEqual(['arrived', 'interrupted'])
  })
})
