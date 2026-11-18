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
