---
title: 'Lifecycle and events'
titleAccent: 'events'
description: 'Follow a scroll with onStart, onProgress and onEnd, read why it ended, use events, the state attribute, AbortSignal and createScrollTo.'
locale: en
sidebar:
  group: api
  order: 1
---

Every scroll goes through the same steps: it **starts**, moves **frame by frame**, and **ends** exactly once. You can follow those steps three ways. Use whichever fits the code you have:

| Way                    | Where it fits                                         |
| ---------------------- | ----------------------------------------------------- |
| Callbacks              | Code that starts the scroll itself                    |
| `scroll-to:*` events   | Code that only listens, such as analytics or a widget |
| `data-scroll-to-state` | CSS, with no JavaScript of your own                   |

## Callbacks

Pass `onStart`, `onProgress` and `onEnd` to `scrollTo`, `autoScrollTo` or `createScrollTo`:

```js
import { scrollTo } from '@samline/scroll-to'

scrollTo('#pricing', {
  offset: '#header',
  onStart: ({ target, top }) => console.log('leaving', top, 'for', target),
  onProgress: ({ progress, eased, top }) => console.log(progress, eased, top),
  onEnd: ({ arrived, reason, top }) => console.log(arrived, reason, top),
})
```

| Callback     | When                                      | Receives                                                    |
| ------------ | ----------------------------------------- | ----------------------------------------------------------- |
| `onStart`    | Once, before the first frame              | `{ target, container, trigger, top, left }`                 |
| `onProgress` | On every animation frame                  | The same, plus `progress` and `eased`, both from `0` to `1` |
| `onEnd`      | Once, when the scroll ends for any reason | The same as `onStart`, plus `arrived` and `reason`          |

- `target` is the element scrolled to, or `null` for positions and `'top'`.
- `container` is `window` for the page, or the scrolling element.
- `trigger` is the link or `[data-scroll-to]` element that was clicked when `autoScrollTo` started the scroll, and `null` otherwise.
- `top` and `left` are where the container is at that moment, in pixels.
- `progress` is the time elapsed. `eased` is the distance covered, after easing. A progress bar that follows the page uses `eased`.

A jump (`behavior: 'instant'`, reduced motion, or a target already in place) still calls all three: `onStart`, a single `onProgress` with `progress: 1`, then `onEnd`.

When `onEnd` runs, focus and the URL hash have already changed, and the state attribute is already gone.

## Why it ended

`onEnd` and the `scroll-to:end` event say why the scroll ended. `arrived` is `true` only when `reason` is `'arrived'`, and it matches what the promise resolves to.

| `reason`        | What happened                                                                              |
| --------------- | ------------------------------------------------------------------------------------------ |
| `'arrived'`     | It reached the target                                                                      |
| `'interrupted'` | The visitor took over: the wheel, a touch, a key that scrolls, or a press on the scrollbar |
| `'replaced'`    | Another scroll started on the same container                                               |
| `'cancelled'`   | `cancelScroll()`, an aborted `signal`, or `destroy()` on a `createScrollTo` instance       |
| `'missing'`     | The target does not exist (`onStart` is not called)                                        |

Treat them differently when it matters. For example, highlight only on arrival, and do nothing if the visitor took over:

```js
scrollTo('#faq-4', {
  onEnd: ({ reason, target }) => {
    if (reason === 'arrived') target.classList.add('flash')
    if (reason === 'missing') console.warn('No #faq-4 on this page')
  },
})
```

`END_REASONS` lists the five values, for validation or for TypeScript (`ScrollEndReason`).

## Events

Every scroll dispatches two bubbling `CustomEvent`s, with the same details as the callbacks in `event.detail`:

| Event             | Detail                         |
| ----------------- | ------------------------------ |
| `scroll-to:start` | Same as `onStart`              |
| `scroll-to:end`   | Same as `onEnd`, with `reason` |

They are dispatched on the target element. For positions, `'top'` and missing targets, they are dispatched on the scrolling element: `document.documentElement` for the page, or the container. Because they bubble, one listener on `document` hears every scroll on the page, including the ones the CDN script starts on its own:

```js
document.addEventListener('scroll-to:end', event => {
  const { reason, target, trigger } = event.detail
  if (reason !== 'arrived' || !target?.id) return
  analytics.track('section_reached', { id: target.id, from: trigger?.textContent })
})
```

Listen on one section to react only to scrolls that go there:

```js
document.querySelector('#signup').addEventListener('scroll-to:end', event => {
  if (event.detail.arrived) document.querySelector('#email').focus()
})
```

`EVENTS` holds the names: `EVENTS.start` is `'scroll-to:start'` and `EVENTS.end` is `'scroll-to:end'`.

## The state attribute

While a scroll runs, `data-scroll-to-state="scrolling"` is set on the scrolling element (`<html>` for the page, or the container) and, when `autoScrollTo` started it, on the trigger that was clicked. It is removed when the scroll ends, whatever the reason.

Use it from CSS. For example, keep a header that hides on scroll down visible during a scripted scroll, and show which link is on its way:

```css
html[data-scroll-to-state='scrolling'] .header {
  transform: none;
}

a[data-scroll-to-state='scrolling'] {
  opacity: 0.6;
}
```

From JavaScript, ask with `isScrolling(container?)`:

```js
import { isScrolling } from '@samline/scroll-to'

window.addEventListener('scroll', () => {
  if (isScrolling()) return // our own scroll, not the visitor's
  hideHeaderOnScrollDown()
})
```

## Stop it with an AbortSignal

Pass a `signal` to stop the scroll from anywhere. The promise resolves to `false` and `reason` is `'cancelled'`. A signal that is already aborted does not start a scroll and leaves the running one alone.

```js
const controller = new AbortController()

scrollTo('#results', { signal: controller.signal })

// Later: a new search started, the modal closed, the route changed…
controller.abort()
```

One signal can stop several scrolls, and it works with `AbortSignal.timeout(ms)`:

```js
// Give up after 2 seconds, wherever it is.
scrollTo('#footer', { duration: 5000, signal: AbortSignal.timeout(2000) })
```

`cancelScroll(container?)` does the same for whatever is running on a container, without a signal.

The wheel, a touch, a key that scrolls or a press on the scrollbar interrupts a scroll on its own (`reason: 'interrupted'`), unless you pass `interruptible: false`. Clicks on buttons and links do not, so a "Stop" button calls `cancelScroll()` or `abort()` and the scroll ends as `'cancelled'`. Use `signal` for stops that do not come from the visitor too: a timeout, a new request, a route change or a component that unmounts.

## Share defaults with createScrollTo

When every scroll on a page uses the same options, write them once:

```js
import { createScrollTo } from '@samline/scroll-to'

const scroller = createScrollTo({ offset: '#header', duration: 600, easing: 'ease-out' })

scroller.auto() // same-page links and [data-scroll-to], with the defaults
await scroller.to('#pricing') // a scroll from code, with the defaults
scroller.position('#faq') // { top, left }, without moving
```

| Member                       | Does                                                                 |
| ---------------------------- | -------------------------------------------------------------------- |
| `to(target, options?)`       | `scrollTo` with the defaults                                         |
| `position(target, options?)` | `scrollPosition` with the defaults                                   |
| `cancel()`                   | Stop the scroll running on the default container                     |
| `isScrolling()`              | Whether the default container is scrolling                           |
| `auto(options?)`             | `autoScrollTo` with the defaults; returns its own `{ destroy }`      |
| `destroy()`                  | Stop the scrolls this instance started and every `auto()` controller |

Options passed to a call replace the defaults key by key, callbacks included:

```js
scroller.to('#top-banner', { offset: 0 }) // no header offset for this one
```

`destroy()` is safe to call more than once. It stops only the scrolls this instance started, never another script's, and afterwards `to()` resolves to `false`, `position()` returns `null` and `auto()` does nothing. That makes one instance per component or page easy to clean up:

```js
// A scroll box in a component.
const panel = createScrollTo({ container: '#panel', block: 'nearest' })
panel.auto({ scope: document.querySelector('#panel-nav') })

// On unmount:
panel.destroy()
```

## In the browser global

The CDN script exposes the same API on `window.ScrollTo`: `ScrollTo.isScrolling()`, `ScrollTo.createScrollTo(defaults)`, and every callback and `signal` option. Events work with no extra code, since the automatic start dispatches them too.

```html
<script
  src="https://cdn.jsdelivr.net/npm/@samline/scroll-to@1.3.0/dist/browser/scroll-to.global.js"
  defer
></script>
<script>
  document.addEventListener('scroll-to:end', event => {
    if (event.detail.arrived) event.detail.target?.classList.add('flash')
  })
</script>
```

## Without a DOM

On the server every function stays inert: `scrollTo` resolves to `false` without calling any callback, `isScrolling()` returns `false`, and a `createScrollTo` instance does nothing.
