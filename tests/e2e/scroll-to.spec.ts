import { fileURLToPath } from 'node:url'

import { expect, test } from './fixtures'

const layout = `
  <style>
    html { scroll-behavior: smooth }
    header { position: fixed; inset: 0 0 auto; height: 64px; background: #fff; z-index: 1 }
    section { height: 900px; border-top: 1px solid }
    #tabs { display: flex; width: 400px; overflow-x: auto; margin-top: 80px }
    #tabs button { flex: 0 0 150px }
  </style>
  <header id="header">
    <a id="to-two" href="#two">Two</a>
    <button id="to-tab" data-scroll-to="#tab-8" data-scroll-to-container="#tabs" data-scroll-to-inline="center">Tab 8</button>
  </header>
  <div id="tabs">${Array.from({ length: 10 }, (_, i) => `<button id="tab-${i + 1}">Tab ${i + 1}</button>`).join('')}</div>
  <section id="one">One</section>
  <section id="two">Two</section>
  <section id="three">Three</section>
`

type Page = import('@playwright/test').Page

const top = (page: Page, id: string) =>
  page.evaluate(id => Math.round(document.getElementById(id)!.getBoundingClientRect().top), id)

test('a link scrolls smoothly below the fixed header, focuses and pushes the hash', async ({
  page,
}) => {
  // A real URL: WebKit keeps no history entries on about:blank.
  await page.route('http://scroll-to.test/', route =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><body style="margin:0">${layout}</body></html>`,
    })
  )
  await page.goto('http://scroll-to.test/')
  await page.addScriptTag({
    path: fileURLToPath(new URL('../../dist/browser/scroll-to.global.js', import.meta.url)),
  })
  await page.evaluate(() => (window as any).ScrollTo.auto({ offset: '#header', duration: 400 }))

  await page.locator('#to-two').click()
  // Mid-way it is still on its way.
  await page.waitForTimeout(120)
  const midway = await page.evaluate(() => scrollY)
  expect(midway).toBeGreaterThan(0)

  await expect.poll(() => top(page, 'two')).toBe(64)
  await expect(page.locator('#two')).toBeFocused()
  expect(await page.evaluate(() => location.hash)).toBe('#two')
  // A new history entry: going back removes the hash.
  const back = await page.evaluate(
    () =>
      new Promise<string>(resolve => {
        addEventListener('popstate', () => resolve(location.hash), { once: true })
        history.back()
      })
  )
  expect(back).toBe('')
})

test('wheel input interrupts the scroll', async ({ load, page }) => {
  await load(layout, 'scroll-to')
  const result = page.evaluate(() =>
    (window as any).ScrollTo.scrollTo('#three', { duration: 1500 })
  )
  await page.waitForTimeout(150)
  await page.mouse.move(200, 300)
  await page.mouse.wheel(0, 10)
  expect(await result).toBe(false)
  const y = await page.evaluate(() => scrollY)
  await page.waitForTimeout(300)
  expect(Math.abs((await page.evaluate(() => scrollY)) - y)).toBeLessThan(40)
})

test('a trigger centers an item inside a horizontal container', async ({ load, page }) => {
  await load(layout, 'scroll-to')
  await page.locator('#to-tab').click()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const box = document.getElementById('tabs')!.getBoundingClientRect()
        const tab = document.getElementById('tab-8')!.getBoundingClientRect()
        return Math.round(tab.left + tab.width / 2 - (box.left + box.width / 2))
      })
    )
    .toBe(0)
  expect(await page.evaluate(() => scrollY)).toBe(0)
})

test('reduced motion jumps at once', async ({ load, page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await load(layout, 'scroll-to')
  const arrived = await page.evaluate(() => (window as any).ScrollTo.scrollTo('#three'))
  expect(arrived).toBe(true)
  expect(await top(page, 'three')).toBe(0)
})

test('callbacks, events and the state attribute follow a real scroll', async ({ load, page }) => {
  await load(layout, 'scroll-to')
  const report = await page.evaluate(async () => {
    const { ScrollTo } = window as any
    const log: string[] = []
    let frames = 0
    let lastProgress = 0
    let duringState: string | null = null
    document.addEventListener('scroll-to:start', () => log.push('event:start'))
    document.addEventListener('scroll-to:end', (event: any) =>
      log.push(`event:end:${event.detail.reason}`)
    )
    const arrived = await ScrollTo.scrollTo('#three', {
      duration: 400,
      onStart: () => log.push('start'),
      onProgress: ({ progress }: { progress: number }) => {
        frames++
        lastProgress = progress
        duringState ??= document.documentElement.getAttribute('data-scroll-to-state')
      },
      onEnd: ({ reason }: { reason: string }) => log.push(`end:${reason}`),
    })
    return {
      arrived,
      log,
      frames,
      lastProgress,
      duringState,
      after: document.documentElement.getAttribute('data-scroll-to-state'),
      scrolling: ScrollTo.isScrolling(),
    }
  })
  expect(report).toMatchObject({
    arrived: true,
    log: ['start', 'event:start', 'end:arrived', 'event:end:arrived'],
    lastProgress: 1,
    duringState: 'scrolling',
    after: null,
    scrolling: false,
  })
  expect(report.frames).toBeGreaterThan(5)
  expect(await top(page, 'three')).toBe(0)
})

test('an AbortSignal stops the scroll', async ({ load, page }) => {
  await load(layout, 'scroll-to')
  const result = await page.evaluate(async () => {
    const abort = new AbortController()
    let reason = ''
    const done = (window as any).ScrollTo.scrollTo('#three', {
      duration: 1500,
      signal: abort.signal,
      onEnd: (end: { reason: string }) => (reason = end.reason),
    })
    setTimeout(() => abort.abort(), 150)
    return { arrived: await done, reason, y: scrollY }
  })
  expect(result.arrived).toBe(false)
  expect(result.reason).toBe('cancelled')
  expect(result.y).toBeGreaterThan(0)
  expect(result.y).toBeLessThan(1700)
})

const stacked = `
  <style>
    body { margin: 0 }
    header { position: fixed; inset: 0 0 auto; height: 64px; background: #fff; z-index: 2 }
    .notice { position: sticky; top: 64px; height: 36px; background: #ffe; z-index: 1 }
    .backdrop { position: fixed; inset: 0; pointer-events: none }
    section { height: 900px; border-top: 1px solid; scroll-margin-top: 12px }
    html.padded { scroll-padding-top: 80px }
  </style>
  <header></header>
  <div class="backdrop"></div>
  <div style="height: 200px"></div>
  <div class="notice">Notice</div>
  <section id="one">One</section>
  <section id="two">Two</section>
  <section id="three">Three</section>
  <p id="tail" style="height: 20px; margin: 0">Tail</p>
`

test("offset 'auto' clears a fixed header and a sticky bar once it sticks", async ({
  load,
  page,
}) => {
  await load(stacked, 'scroll-to')
  await page.evaluate(() =>
    (window as any).ScrollTo.scrollTo('#two', { offset: 'auto', duration: 300 })
  )
  // 64px header + 36px stuck notice; the full-screen backdrop is ignored.
  expect(await top(page, 'two')).toBe(100)
})

test("offset 'css' uses scroll-padding-top and scroll-margin-top", async ({ load, page }) => {
  await load(stacked, 'scroll-to')
  await page.evaluate(() => document.documentElement.classList.add('padded'))
  await page.evaluate(() =>
    (window as any).ScrollTo.scrollTo('#two', { offset: 'css', behavior: 'instant' })
  )
  expect(await top(page, 'two')).toBe(92)
})

test("'bottom', relative targets, when 'needed' and cubic-bezier easing", async ({
  load,
  page,
}) => {
  await load(stacked, 'scroll-to')
  const result = await page.evaluate(async () => {
    const { ScrollTo } = window as any
    await ScrollTo.scrollTo('bottom', { easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', duration: 300 })
    const bottom = scrollY
    const max = document.documentElement.scrollHeight - innerHeight
    // The tail is in view at the bottom: nothing to do.
    await ScrollTo.scrollTo('#tail', { when: 'needed', block: 'center' })
    const stayed = scrollY === bottom
    await ScrollTo.scrollTo('-=250', { duration: 200 })
    return { bottom, max, up: scrollY, stayed }
  })
  expect(Math.round(result.bottom)).toBe(result.max)
  expect(Math.round(result.up)).toBe(result.max - 250)
  expect(result.stayed).toBe(true)
})

test("offset 'auto' counts a sticky notice that only sticks on the way, inside a box", async ({
  load,
  page,
}) => {
  await load(
    `<style>
      #box { height: 400px; overflow-y: auto; margin-top: 50px }
      .bar { position: sticky; top: 0; height: 48px; background: #fff; z-index: 2 }
      .notice { position: sticky; top: 48px; height: 36px; background: #ffe; z-index: 1 }
      section { height: 300px; border-top: 1px solid }
    </style>
    <div id="box">
      <div class="bar">Bar</div>
      <section>Intro</section>
      <div class="notice">Notice</div>
      <section id="plans">Plans</section>
      <section id="faq">FAQ</section>
      <section>End</section>
    </div>`,
    'scroll-to'
  )
  const tops = await page.evaluate(async () => {
    const { ScrollTo } = window as any
    const box = document.getElementById('box')!
    const at = (id: string) =>
      Math.round(
        document.getElementById(id)!.getBoundingClientRect().top - box.getBoundingClientRect().top
      )
    const result: number[] = []
    for (const id of ['plans', 'faq']) {
      box.scrollTop = 0
      await ScrollTo.scrollTo('#' + id, { container: box, offset: 'auto', duration: 300 })
      result.push(at(id))
    }
    return result
  })
  // 48px bar + 36px notice (WebKit may round a pixel).
  for (const value of tops) expect(Math.abs(value - 84)).toBeLessThanOrEqual(1)
})

test("data-scroll-to='next' and 'prev' step through sections, quick presses add up", async ({
  load,
  page,
}) => {
  await load(
    `<style>
      header { position: fixed; inset: 0 0 auto; height: 50px; background: #fff; z-index: 1 }
      section { height: 600px; border-top: 1px solid }
    </style>
    <header><button id="prev" data-scroll-to="prev">Prev</button><button id="next" data-scroll-to="next">Next</button></header>
    ${['a', 'b', 'c', 'd', 'e'].map(id => `<section id="${id}">${id}</section>`).join('')}
    <div style="height: 800px"></div>`,
    'scroll-to'
  )
  await page.evaluate(() =>
    (window as any).ScrollTo.auto({ offset: 'auto', duration: 400, hash: false })
  )
  await page.locator('#next').click()
  await expect.poll(() => top(page, 'b')).toBe(50)
  await page.locator('#next').click()
  await page.locator('#next').click()
  await expect.poll(() => top(page, 'd')).toBe(50)
  await page.locator('#prev').click()
  await expect.poll(() => top(page, 'c')).toBe(50)
})

test('closed details and hidden="until-found" open before the scroll', async ({ load, page }) => {
  await load(
    `<div style="height: 1500px"></div>
    <details id="faq"><summary>Question</summary>
      <div id="found" hidden="until-found"><p id="answer" style="height: 200px">Answer</p></div>
    </details>
    <div style="height: 1500px"></div>`,
    'scroll-to'
  )
  const result = await page.evaluate(async () => {
    let matched = false
    document.getElementById('found')!.addEventListener('beforematch', () => (matched = true))
    const arrived = await (window as any).ScrollTo.scrollTo('#answer', { duration: 200 })
    return {
      arrived,
      matched,
      open: (document.getElementById('faq') as HTMLDetailsElement).open,
      hidden: document.getElementById('found')!.hasAttribute('hidden'),
      top: Math.round(document.getElementById('answer')!.getBoundingClientRect().top),
    }
  })
  expect(result).toEqual({ arrived: true, matched: true, open: true, hidden: false, top: 0 })
})

test('highlight marks the target on arrival and the progress property follows the scroll', async ({
  load,
  page,
}) => {
  await load(
    `<a id="go" href="#far" data-scroll-to-highlight="1500">Far</a>
    <div style="height: 2000px"></div>
    <section id="far" style="height: 400px">Far</section>
    <div style="height: 1000px"></div>`,
    'scroll-to'
  )
  await page.evaluate(() => {
    const seen: number[] = []
    ;(window as any).seen = seen
    new MutationObserver(() => {
      const value = document.documentElement.style.getPropertyValue('--scroll-to-progress')
      if (value) seen.push(Number(value))
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    ;(window as any).ScrollTo.auto({ duration: 400, hash: false })
  })
  await page.locator('#go').click()
  await expect(page.locator('#far')).toHaveAttribute('data-scroll-to-arrived', '')
  const seen = await page.evaluate(() => (window as any).seen as number[])
  expect(seen.some(value => value > 0 && value < 1)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.getAttribute('style') ?? '')).toBe('')
  await expect(page.locator('#far')).not.toHaveAttribute('data-scroll-to-arrived')
})

test('a back-to-top button shows past its threshold, scrolls up and moves focus', async ({
  load,
  page,
}) => {
  await load(
    `<main id="main" style="height: 4000px">Long page</main>
    <button id="top" data-scroll-to-back-to-top="600" style="position: fixed; bottom: 0">
      Back to top
    </button>`,
    'scroll-to'
  )
  const button = page.locator('#top')
  await expect(button).toHaveAttribute('data-scroll-to-visible', 'false')
  await page.evaluate(() => scrollTo(0, 1600))
  await expect(button).toHaveAttribute('data-scroll-to-visible', 'true')
  const scrolled = Number(
    await button.evaluate(node =>
      (node as HTMLElement).style.getPropertyValue('--scroll-to-scrolled')
    )
  )
  expect(scrolled).toBeGreaterThan(0.3)
  expect(scrolled).toBeLessThan(0.7)

  await button.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
  await expect(button).toHaveAttribute('data-scroll-to-visible', 'false')
  await expect(page.locator('body')).toBeFocused()
})

test("container 'auto' scrolls a snapping box and the smooth page together", async ({
  load,
  page,
}) => {
  await load(
    `<style>
      html { scroll-behavior: smooth; scroll-snap-type: y mandatory; scroll-padding-top: 50px }
      header { position: fixed; inset: 0 0 auto; height: 50px; background: #fff; z-index: 1 }
      .snap { scroll-snap-align: start }
      #box { height: 300px; overflow-y: auto; scroll-snap-type: y mandatory; scroll-behavior: smooth; scroll-snap-align: start }
      #box p { height: 280px; margin: 0; scroll-snap-align: start }
    </style>
    <header id="header">Header</header>
    <div class="snap" style="height: 1500px">Top</div>
    <div id="box">${Array.from({ length: 8 }, (_, i) => `<p id="p${i}">Item ${i}</p>`).join('')}</div>
    <div class="snap" style="height: 1500px">End</div>`,
    'scroll-to'
  )
  const result = await page.evaluate(async () => {
    const seen = new Set<string>()
    const box = document.getElementById('box')!
    const watch = setInterval(() => seen.add(getComputedStyle(box).scrollSnapType), 10)
    const arrived = await (window as any).ScrollTo.scrollTo('#p5', {
      container: 'auto',
      offset: '#header',
      duration: 500,
    })
    clearInterval(watch)
    await new Promise(resolve => setTimeout(resolve, 300))
    const target = document.getElementById('p5')!.getBoundingClientRect()
    return {
      arrived,
      suspended: seen.has('none'),
      restored: getComputedStyle(box).scrollSnapType,
      inBox: Math.round(target.top - box.getBoundingClientRect().top),
      boxTop: Math.round(box.getBoundingClientRect().top),
      style: box.getAttribute('style'),
    }
  })
  expect(result.arrived).toBe(true)
  expect(result.suspended).toBe(true)
  expect(result.restored).toMatch(/y mandatory/)
  expect(result.style).toBeNull()
  expect(result.inBox).toBe(0)
  // The page keeps the header's 50px above the target.
  expect(Math.abs(result.boxTop + result.inBox - 50)).toBeLessThanOrEqual(1)
})

test('right-to-left strips align to the right and step forward to the left', async ({
  load,
  page,
}) => {
  await load(
    `<div id="strip" dir="rtl" style="display: flex; width: 600px; overflow-x: auto">
      ${Array.from({ length: 10 }, (_, i) => `<div class="item" id="i${i}" style="flex: 0 0 200px; height: 80px">${i}</div>`).join('')}
    </div>`,
    'scroll-to'
  )
  const result = await page.evaluate(async () => {
    const strip = document.getElementById('strip')!
    const ScrollTo = (window as any).ScrollTo
    const options = {
      container: strip,
      sections: '.item',
      inline: 'start',
      block: 'nearest',
      duration: 200,
    }
    await ScrollTo.scrollTo('next', options)
    await ScrollTo.scrollTo('next', options)
    const afterNext = Math.round(strip.scrollLeft)
    await ScrollTo.scrollTo('#i9', options)
    const end = Math.round(strip.scrollLeft)
    const right = (id: string) =>
      Math.round(
        strip.getBoundingClientRect().right -
          document.getElementById(id)!.getBoundingClientRect().right
      )
    await ScrollTo.scrollTo('#i5', options)
    return { afterNext, end, max: strip.scrollWidth - strip.clientWidth, aligned: right('i5') }
  })
  expect(result.afterNext).toBe(-400)
  expect(result.end).toBe(-result.max)
  expect(Math.abs(result.aligned)).toBeLessThanOrEqual(1)
})
