// The website shows each example twice: a live preview and copyable files
// (site/examples.ts) that load the browser bundle. These tests run the copyable
// files against the built bundle, so the code people copy keeps working.
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

import scrollToExamples from '../../site/examples'

const bundle = (pkg: string) =>
  fileURLToPath(new URL(`../../dist/browser/${pkg}.global.js`, import.meta.url))

type Example = { id: string; files: { html: string; css?: string; js: string } }

const open = async (page: import('@playwright/test').Page, pkg: string, example: Example) => {
  await page.setContent(
    `<!doctype html><html><head><style>${example.files.css ?? ''}</style></head><body><main>${example.files.html}</main></body></html>`
  )
  await page.addScriptTag({ path: bundle(pkg) })
  await page.addScriptTag({ content: example.files.js })
}

const find = <T extends Example>(list: readonly T[], id: string) =>
  list.find(item => item.id === id)!

test.describe('scroll-to copyable examples', () => {
  type Page = import('@playwright/test').Page
  const openDocument = async (page: Page, example: Example) => {
    const script = readFileSync(bundle('scroll-to'), 'utf8')
    await page.setViewportSize({ width: 1000, height: 700 })
    await page.setContent(
      `<!doctype html><html lang="en"><head><style>${example.files.css ?? ''}</style></head><body><main>${example.files.html}</main><script>${script}</script><script>${example.files.js}</script></body></html>`
    )
  }
  const top = (page: Page, selector: string) =>
    page.locator(selector).evaluate(el => Math.round(el.getBoundingClientRect().top))

  test('anchors land below the fixed header and focus their section', async ({ page }) => {
    await openDocument(page, find(scrollToExamples, 'header'))
    const header = await page.locator('#header').evaluate(el => el.offsetHeight)
    await page.getByRole('link', { name: 'Pricing' }).click()
    await expect.poll(() => top(page, '#pricing')).toBe(header)
    await expect(page.locator('#pricing')).toBeFocused()
    await page.getByRole('button', { name: 'Back to top' }).click()
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
  })

  test('the selected tab is centered in its strip', async ({ page }) => {
    await openDocument(page, find(scrollToExamples, 'tabs'))
    await page.getByRole('tab', { name: 'Topic 7' }).click()
    await expect(page.getByRole('tab', { name: 'Topic 7' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect
      .poll(() =>
        page.evaluate(() => {
          const strip = document.getElementById('tabs')!.getBoundingClientRect()
          const tab = document.getElementById('tab-7')!.getBoundingClientRect()
          return Math.abs(tab.left + tab.width / 2 - (strip.left + strip.width / 2)) < 2
        })
      )
      .toBe(true)
  })

  test('the answer is highlighted once the scroll arrives', async ({ page }) => {
    await openDocument(page, find(scrollToExamples, 'await'))
    await page.locator('#show').click()
    await expect(page.locator('#status')).toHaveText('Arrived')
    await expect(page.locator('#q4')).toHaveClass(/flash/)
    expect(await top(page, '#q4')).toBe(16)
  })

  test('the progress bar fills and the status says why the scroll ended', async ({ page }) => {
    await openDocument(page, find(scrollToExamples, 'progress'))
    await page.locator('#give-up').click()
    await expect(page.locator('#status')).toHaveText('Scrolling…')
    await expect(page.locator('#status')).toHaveText('Ended: cancelled')
    const stopped = await page.evaluate(() => scrollY)
    expect(stopped).toBeGreaterThan(0)
    expect(stopped).toBeLessThan(
      await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
    )

    await page.locator('#go').click()
    await expect(page.locator('#status')).toHaveText('Scrolling…')
    await page.locator('#stop').click()
    await expect(page.locator('#status')).toHaveText('Ended: cancelled')

    await page.locator('#go').click()
    await expect(page.locator('#status')).toHaveText('Ended: arrived', { timeout: 6000 })
    await expect(page.locator('#bar')).toHaveAttribute('style', /scaleX\(1\)/)
    // The last part cannot reach the top: the scroll stops at the end of the page.
    const end = await page.evaluate(() => [
      Math.round(scrollY),
      document.documentElement.scrollHeight - innerHeight,
    ])
    expect(end[0]).toBe(end[1])
  })

  test('links carry the state while they scroll and the log records each end', async ({ page }) => {
    await openDocument(page, find(scrollToExamples, 'events'))
    const plans = page.getByRole('link', { name: 'Plans' })
    await plans.click()
    await expect(plans).toHaveAttribute('data-scroll-to-state', 'scrolling')
    await expect(page.locator('html')).toHaveAttribute('data-scroll-to-state', 'scrolling')
    await expect(page.locator('#log li').first()).toHaveText('plans: arrived')
    await expect(plans).not.toHaveAttribute('data-scroll-to-state', /.*/)
    await expect(page.locator('html')).not.toHaveAttribute('data-scroll-to-state', /.*/)
    await expect(page.locator('#plans')).toBeFocused()
  })

  test("offset 'auto' clears the header and the stuck notice, and adapts when it hides", async ({
    page,
  }) => {
    await openDocument(page, find(scrollToExamples, 'stacked'))
    const header = await page.locator('#header').evaluate(el => el.offsetHeight)
    const notice = await page.locator('#notice').evaluate(el => el.offsetHeight)
    await page.getByRole('link', { name: 'FAQ' }).click()
    await expect.poll(() => top(page, '#faq')).toBe(header + notice)
    await expect(page.locator('#faq')).toBeFocused()

    await page.locator('#toggle').click()
    await expect(page.locator('#toggle')).toHaveAttribute('aria-pressed', 'false')
    await page.getByRole('link', { name: 'Contact' }).click()
    await expect.poll(() => top(page, '#contact')).toBe(header)
  })

  test('the strip moves one page per click with the chosen easing', async ({ page }) => {
    await openDocument(page, find(scrollToExamples, 'pages'))
    const strip = page.locator('#strip')
    const width = await strip.evaluate(el => el.clientWidth)
    await page.locator('#easing').selectOption('cubic-bezier(0.2, 0.8, 0.2, 1)')
    await page.locator('#next').click()
    await expect.poll(() => strip.evaluate(el => Math.round(el.scrollLeft))).toBe(width)
    await page.locator('#easing').selectOption('ease-out-back')
    await page.locator('#next').click()
    await expect.poll(() => strip.evaluate(el => Math.round(el.scrollLeft))).toBe(width * 2)
    await page.locator('#prev').click()
    await expect.poll(() => strip.evaluate(el => Math.round(el.scrollLeft))).toBe(width)
  })

  test('next and previous step through chapters, and quick presses add up', async ({ page }) => {
    await openDocument(page, find(scrollToExamples, 'steps'))
    const header = await page.locator('#header').evaluate(el => el.offsetHeight)
    const next = page.getByRole('button', { name: 'Next chapter' })
    await next.click()
    await expect.poll(() => top(page, '#chapter-2')).toBe(header)
    // Focus stays off the section, so the keyboard can keep pressing Next.
    await expect(page.locator('#chapter-2')).not.toBeFocused()
    await next.click()
    await next.click()
    await expect.poll(() => top(page, '#chapter-4')).toBe(header)
    // The keyboard keeps working from the button.
    await next.focus()
    await page.keyboard.press('Enter')
    // The last chapter cannot reach the header: the page ends first.
    await expect
      .poll(() =>
        page.evaluate(
          () => Math.round(scrollY) === document.documentElement.scrollHeight - innerHeight
        )
      )
      .toBe(true)
    await page.getByRole('button', { name: 'Previous chapter' }).click()
    await expect.poll(() => top(page, '#chapter-4')).toBe(header)
  })

  test('links open the closed answer, scroll to it and focus it', async ({ page }) => {
    await openDocument(page, find(scrollToExamples, 'faq'))
    await page.getByRole('link', { name: 'How do refunds work?' }).click()
    // WebKit may round a pixel.
    await expect.poll(async () => Math.abs((await top(page, '#refunds')) - 16) <= 1).toBe(true)
    await expect(page.locator('details').first()).toHaveAttribute('open', '')
    await expect(page.locator('#refunds')).toBeFocused()

    await page.getByRole('link', { name: 'Is there a warranty?' }).click()
    await expect(page.locator('#log')).toHaveText('The warranty panel opened')
    await expect(page.locator('#warranty-panel')).not.toHaveAttribute('hidden', /.*/)
    // WebKit may round a pixel.
    await expect.poll(async () => Math.abs((await top(page, '#warranty')) - 16) <= 1).toBe(true)
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#warranty')
    await expect(page.locator('#warranty')).toBeFocused()
  })

  test('a term link centers its definition and highlights it for a moment', async ({ page }) => {
    await openDocument(page, find(scrollToExamples, 'highlight'))
    await page.getByRole('link', { name: 'Latency' }).click()
    const term = page.locator('#latency')
    await expect(term).toHaveAttribute('data-scroll-to-arrived', '')
    await expect(term).toBeFocused()
    const middle = await term.evaluate(el => {
      const box = el.getBoundingClientRect()
      return Math.abs(box.top + box.height / 2 - innerHeight / 2) <= 2
    })
    expect(middle).toBe(true)
    await expect(term).not.toHaveAttribute('data-scroll-to-arrived', { timeout: 3000 })
  })

  test('the back-to-top button appears after one screen and brings focus up', async ({ page }) => {
    await openDocument(page, find(scrollToExamples, 'back-to-top'))
    const button = page.locator('.back-to-top')
    await expect(button).toHaveAttribute('data-scroll-to-visible', 'false')
    await expect(button).toBeHidden()
    await page.evaluate(() => scrollTo(0, innerHeight * 1.5))
    await expect(button).toHaveAttribute('data-scroll-to-visible', 'true')
    await expect(button).toBeVisible()
    await button.focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
    await expect(page.locator('body')).toBeFocused()
    await expect(button).toHaveAttribute('data-scroll-to-visible', 'false')
  })
})
