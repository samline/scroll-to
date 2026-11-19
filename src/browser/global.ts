import {
  autoScrollTo,
  backToTop,
  cancelScroll,
  createScrollTo,
  isScrolling,
  scrollPosition,
  scrollTo,
} from '../vanilla/index.js'
import { scrollSequence } from '../sequence/index.js'
import type { BackToTopController, ScrollToController } from '../vanilla/index.js'

/**
 * Classic script for pages without a build step. It handles clicks on
 * `[data-scroll-to]` and same-page `#id` links as soon as the DOM is ready,
 * and turns `[data-scroll-to-back-to-top]` elements into `backToTop` buttons
 * (the attribute's value is the threshold).
 * Add `data-manual` to the script tag to start it yourself with
 * `ScrollTo.auto()`; calling `ScrollTo.auto()` before the DOM is ready also
 * replaces the automatic start.
 */
const script = typeof document !== 'undefined' ? document.currentScript : null
const manual = script?.hasAttribute('data-manual') ?? false

let controller: ScrollToController | null = null
let buttons: BackToTopController[] = []

const api = {
  scrollTo,
  scrollPosition,
  cancelScroll,
  isScrolling,
  autoScrollTo,
  createScrollTo,
  backToTop,
  scrollSequence,
  /** Start (or restart) handling clicks and back-to-top buttons. Returns the controller. */
  auto: (options?: Parameters<typeof autoScrollTo>[0]) => {
    controller?.destroy()
    for (const button of buttons) button.destroy()
    buttons = [...document.querySelectorAll('[data-scroll-to-back-to-top]')].map(button =>
      backToTop(button, {
        ...options,
        threshold: button.getAttribute('data-scroll-to-back-to-top') || '100%',
      })
    )
    const clicks = autoScrollTo(options)
    controller = {
      destroy: () => {
        clicks.destroy()
        for (const button of buttons) button.destroy()
        buttons = []
      },
    }
    return controller
  },
  /** The controller of the automatic run, or `null`. */
  get controller() {
    return controller
  },
}

export type ScrollToGlobal = typeof api

const scope = globalThis as typeof globalThis & { ScrollTo?: ScrollToGlobal }
scope.ScrollTo = api

if (!manual && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    // A page script may already have started it with its own options.
    document.addEventListener('DOMContentLoaded', () => controller ?? api.auto(), { once: true })
  } else {
    api.auto()
  }
}

export {
  autoScrollTo,
  backToTop,
  cancelScroll,
  createScrollTo,
  isScrolling,
  scrollPosition,
  scrollSequence,
  scrollTo,
}
