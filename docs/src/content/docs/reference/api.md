---
title: 'API reference'
titleAccent: 'reference'
description: 'Every @samline/scroll-to export: functions, createScrollTo, the scroll-to events, the types and the window.ScrollTo global.'
locale: en
sidebar:
  group: reference
  order: 1
---

## scrollTo(target, options?)

```ts
scrollTo(target: Element | string | number, options?: ScrollToOptions): Promise<boolean>
```

Scrolls the page (or `options.container`) to `target`. See [Options](../configuration/) for targets and options.

```js
import { scrollTo } from '@samline/scroll-to'

const arrived = await scrollTo('#faq', { offset: '#header', duration: 600 })
if (arrived) document.querySelector('#faq').classList.add('flash')
```

Resolves to `true` when it arrives, and `false` when the visitor interrupts it, another scroll on the same container replaces it, it is cancelled, or the target does not exist. Focus and hash changes only happen on arrival. To know which of those happened, read `reason` in `onEnd` or in the `scroll-to:end` event:

```js
scrollTo('#faq', {
  signal: controller.signal,
  onProgress: ({ eased }) => bar.style.setProperty('--progress', eased),
  onEnd: ({ arrived, reason }) => console.log(arrived, reason),
})
```

See [Lifecycle and events](../../guides/lifecycle/) for every callback, end reason and recipe.

## scrollPosition(target, options?)

```ts
scrollPosition(target, options?): { top: number; left: number } | null
```

Where the container would scroll to, clamped to what it can scroll, without moving. `null` when the target does not exist or there is no DOM. It takes the same targets and options as `scrollTo`: with `when: 'needed'` and a visible target, it returns the current position.

## cancelScroll(container?)

Stops the scroll running on `container` (the page by default). Its promise resolves to `false` and its end reason is `'cancelled'`.

## isScrolling(container?)

```ts
isScrolling(container?: Element | Window | string | null): boolean
```

Whether a scroll started by this package is running on `container` (the page by default). The visitor's own scrolling does not count, so a scroll listener can tell the two apart. `false` without a DOM.

## autoScrollTo(options?)

```ts
autoScrollTo(options?: AutoScrollToOptions): { destroy(): void }
```

Handles clicks on same-page `#id` links and `[data-scroll-to]` triggers in `scope` with one delegated listener, with `focus: true` and `hash: 'push'` unless you change them. `destroy()` removes the listener. The callbacks receive the clicked element as `trigger`, and the trigger carries `data-scroll-to-state="scrolling"` while its scroll runs.

## createScrollTo(defaults?)

```ts
createScrollTo(defaults?: ScrollToOptions): ScrollToInstance
```

A scroller that applies `defaults` to every call. Options passed to a call replace the defaults key by key.

| Member                       | Returns                   | Description                                                         |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------- |
| `to(target, options?)`       | `Promise<boolean>`        | `scrollTo` with the defaults                                        |
| `position(target, options?)` | `{ top, left }` or `null` | `scrollPosition` with the defaults                                  |
| `cancel()`                   | `void`                    | `cancelScroll` on the default container                             |
| `isScrolling()`              | `boolean`                 | `isScrolling` on the default container                              |
| `auto(options?)`             | `{ destroy }`             | `autoScrollTo` with the defaults, destroyed with the instance       |
| `destroy()`                  | `void`                    | Stop the scrolls this instance started and its `auto()` controllers |

```js
import { createScrollTo } from '@samline/scroll-to'

const scroller = createScrollTo({ offset: '#header', duration: 600 })
scroller.auto()
await scroller.to('#pricing')
scroller.destroy()
```

`destroy()` is idempotent. Afterwards `to()` resolves to `false`, `position()` returns `null` and `auto()` returns a controller that does nothing.

## Events

| Event             | Dispatched                                 | `event.detail` |
| ----------------- | ------------------------------------------ | -------------- |
| `scroll-to:start` | When a scroll starts                       | `ScrollDetail` |
| `scroll-to:end`   | When it ends, for any reason, exactly once | `ScrollResult` |

Both bubble. They are dispatched on the target element, or on the scrolling element (`document.documentElement` for the page) when the target is a position, `'top'` or does not exist. A missing target only dispatches `scroll-to:end`, with `reason: 'missing'`.

```js
document.addEventListener('scroll-to:end', event => {
  if (event.detail.reason === 'arrived') console.log('Reached', event.detail.target)
})
```

## Callback details

```ts
interface ScrollDetail {
  target: Element | null // null for positions and 'top'
  container: Element | Window
  trigger: Element | null // the clicked element, with autoScrollTo
  top: number // current scroll position, px
  left: number
}

interface ScrollProgress extends ScrollDetail {
  progress: number // time elapsed, 0–1
  eased: number // distance covered after easing, 0–1
}

interface ScrollResult extends ScrollDetail {
  arrived: boolean // true only for 'arrived'
  reason: 'arrived' | 'interrupted' | 'replaced' | 'cancelled' | 'missing'
}
```

## EASINGS

The named easing functions: `linear`, `ease-in`, `ease-out`, `ease-in-out`, `ease-out-quint` and `ease-out-back`. Pass a `'cubic-bezier(x1, y1, x2, y2)'` string or your own function as `easing` for anything else.

## cubicBezier(x1, y1, x2, y2)

```ts
cubicBezier(x1: number, y1: number, x2: number, y2: number): (progress: number) => number
```

The easing function of a CSS `cubic-bezier()` curve, the same one the `'cubic-bezier(…)'` string builds. `x1` and `x2` must be within 0–1; `y1` and `y2` can overshoot.

```js
import { cubicBezier, scrollTo } from '@samline/scroll-to'

const brand = cubicBezier(0.2, 0.8, 0.2, 1)
scrollTo('#faq', { easing: brand })
```

## Types and constants

`ScrollToOptions`, `AutoScrollToOptions`, `ScrollToController`, `ScrollToInstance`, `ScrollTarget`, `ScrollPoint`, `ScrollCoordinate`, `OffsetValue`, `OffsetContext`, `EasingValue`, `ScrollDetail`, `ScrollProgress`, `ScrollResult`, `ScrollEndReason`, `Align` and `Easing`.

| Constant                                                                             | Value                                                            |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `ATTRIBUTE`                                                                          | `'data-scroll-to'`                                               |
| `STATE_ATTRIBUTE`                                                                    | `'data-scroll-to-state'`                                         |
| `EVENTS`                                                                             | `{ start: 'scroll-to:start', end: 'scroll-to:end' }`             |
| `END_REASONS`                                                                        | `['arrived', 'interrupted', 'replaced', 'cancelled', 'missing']` |
| The default export is `scrollTo`; `@samline/scroll-to/vanilla` exports the same API. |

## window.ScrollTo

The browser bundle (`dist/browser/scroll-to.global.js`) defines:

| Member                                                                                                                                              | Description                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `ScrollTo.scrollTo`, `ScrollTo.scrollPosition`, `ScrollTo.cancelScroll`, `ScrollTo.isScrolling`, `ScrollTo.autoScrollTo`, `ScrollTo.createScrollTo` | Same as the package exports                                             |
| `ScrollTo.auto(options?)`                                                                                                                           | Start (or restart) handling clicks with options; returns the controller |
| `ScrollTo.controller`                                                                                                                               | The controller of the automatic run, or `null`                          |

It starts on its own when the DOM is ready. With `data-manual` on the script tag it waits for `ScrollTo.auto()`; a call made before the DOM is ready also replaces the automatic start.
