---
title: 'Highlight and back to top'
titleAccent: 'back to top'
description: 'Highlight the target on arrival, style a scroll in progress with --scroll-to-progress, and add a back-to-top button with a progress ring.'
locale: en
sidebar:
  group: api
  order: 2
---

Three CSS hooks show the visitor what is happening: where they landed, how far a scroll has gone, and how far down the page they are. They are attributes and custom properties, so the look stays in your stylesheet.

## Highlight on arrival

When a scroll stops in the middle of the screen, or the page is long and similar, the eye needs a moment to find the target. With `highlight`, the target gets `data-scroll-to-arrived` once it arrives, and loses it again after a while:

```js
import { autoScrollTo } from '@samline/scroll-to'

autoScrollTo({ highlight: true }) // 1500 ms
autoScrollTo({ highlight: 3000 }) // or any number of milliseconds
```

```css
:target,
[data-scroll-to-arrived] {
  background: #fde68a;
}

@media (prefers-reduced-motion: no-preference) {
  [data-scroll-to-arrived] {
    animation: pulse 0.6s 2;
  }
}

@keyframes pulse {
  50% {
    scale: 1.04;
  }
}
```

- It is set only when the scroll **arrives**, never when it is interrupted, replaced or cancelled, and only on elements: `'top'` and positions have nothing to mark.
- Arriving again at the same target restarts the time.
- A target that is already in place (with `when: 'needed'`, or a second click) still gets it, so the visitor sees which one it was.
- Reduced motion jumps instead of scrolling, and the attribute is still set. Keep a calm style, such as a color, for that case, as in the example above.

Set it per link with `data-scroll-to-highlight`: empty or `true` for the default time, a number of milliseconds, or `false` to turn it off for that link.

```html
<a href="#latency" data-scroll-to-highlight="2500">Latency</a>
```

In code, wait for the promise instead when you need more than a style:

```js
if (await scrollTo('#faq')) celebrate()
```

The highlight is decoration. If arriving changes something the visitor must know, say it in text too, for example in an `aria-live` region.

## Progress while it scrolls

While a scroll runs, the scrolling element (`<html>` for the page) and the clicked trigger carry `--scroll-to-progress`, an inline custom property from `0` to `1` that follows the eased distance. It is removed when the scroll ends. Use it for a bar, a fill on the link, or anything else that should move with the scroll, without JavaScript:

```css
nav a {
  background: linear-gradient(#fde68a, #fde68a) no-repeat left /
    calc(var(--scroll-to-progress, 0) * 100%) 100%;
}

.scroll-bar {
  transform: scaleX(var(--scroll-to-progress, 0));
  transform-origin: left;
}
```

Pair it with `[data-scroll-to-state="scrolling"]`, which marks the same elements, to show the bar only while it runs. For more than CSS can do, `onProgress` gets the same value as `eased` ([Lifecycle and events](../lifecycle/)).

## Back to top

`backToTop` turns a button or a link into a "Back to top" control:

```html
<a class="back-to-top" href="#top" aria-label="Back to top">
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2" />
  </svg>
</a>
```

```js
import { backToTop } from '@samline/scroll-to'

const button = backToTop('.back-to-top', { threshold: 600 })
// Later, when the page goes away:
button.destroy()
```

With the browser bundle no code is needed: `data-scroll-to-back-to-top` on the element does the same, and its value is the threshold.

```html
<a class="back-to-top" href="#top" data-scroll-to-back-to-top="600">Back to top</a>
<script src="https://cdn.jsdelivr.net/npm/@samline/scroll-to@1.6.0/dist/browser/scroll-to.global.js"></script>
```

### Show it once it helps

The button gets `data-scroll-to-visible="false"` until the container is scrolled past `threshold` (by default `'100%'`, one screen; pixels or any percentage of the container height), then `"true"`. Hide it with CSS:

```css
.back-to-top[data-scroll-to-visible='false'] {
  visibility: hidden;
  opacity: 0;
}

@media (prefers-reduced-motion: no-preference) {
  .back-to-top {
    transition:
      opacity 0.3s,
      visibility 0.3s;
  }
}
```

Hide it with `visibility`, not only `opacity`: a button that is merely transparent still takes focus and clicks. The attribute is never set before the script runs, so without JavaScript the link stays visible and still goes to the top.

### A progress ring

`--scroll-to-scrolled` on the button goes from `0` at the top to `1` at the end of the container, as the visitor scrolls. A `conic-gradient` turns it into a ring:

```css
.back-to-top {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background:
    radial-gradient(closest-side, #fff 85%, transparent 86%),
    conic-gradient(#78350f calc(var(--scroll-to-scrolled, 0) * 1turn), #e5e5e5 0);
}
```

On the page, browsers with scroll-driven animations can draw the same ring with `animation-timeline: scroll()` and no script at all. `--scroll-to-scrolled` works in every browser and for any container.

### Where focus goes

A click scrolls to `target` (`'top'` by default) with your scroll options. Once it arrives, and only when the button had focus, focus moves there, so a keyboard user does not stay on a button that just hid itself:

- to the `target` element, when there is one (`target: '#main'`, a heading, a skip-link target);
- otherwise to the container, or `<body>` for the page, with a `tabindex="-1"` that is removed as soon as focus moves on.

Pass a `target` element for the best result: the next Tab then starts from the top of your content. Pass `focus: false` to leave focus alone.

### In a box

Give the container, and the button watches its scroll instead of the page's:

```js
backToTop(box.querySelector('.back-to-top'), { container: box, target: box.firstElementChild })
```

If the content changes size without a scroll, such as after loading more items, call `update()` to measure again.

### With autoScrollTo

The button handles its own click and prevents the default, so an `autoScrollTo` on the same page leaves it alone, even when it is a `#top` link or has `data-scroll-to`.
