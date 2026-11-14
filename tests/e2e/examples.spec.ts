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
})
