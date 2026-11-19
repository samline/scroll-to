---
title: 'Aim and timing'
titleAccent: 'timing'
description: 'Aim @samline/scroll-to with offsets, CSS scroll padding, stacked sticky bars, relative targets and points, and time it with speed and easing.'
locale: en
sidebar:
  group: guides
  order: 3
---

A scroll has two parts: **where** it stops and **how** it gets there. This guide covers both: offsets, targets and `when` for the first, then `duration`, `speed`, `maxDuration` and `easing` for the second.

## Offsets

`offset` is the space kept above the target, usually for whatever covers the top of the page. It takes one value, or an array of values that are added up.

| Value                               | Space kept                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `80` or `'80px'`                    | 80 pixels                                                                  |
| `'10%'`                             | 10% of the container height                                                |
| `'#header'` or an element           | That element's height, measured on every frame                             |
| `'auto'`                            | Fixed and sticky elements stuck at the top, stacked ones included          |
| `'css'`                             | The container's `scroll-padding-top` plus the target's `scroll-margin-top` |
| `({ container, target }) => number` | Whatever the function returns, on every frame                              |
| `['#header', 16]`                   | The sum: the header plus 16 pixels                                         |

Every offset is measured again on every frame, so a header that shrinks, wraps or appears on the way still clears.

### Let it find the header: `'auto'`

```js
autoScrollTo({ offset: 'auto' })
```

`'auto'` keeps space for everything that will cover the top of the container once the target arrives:

- **Fixed** elements at the top edge, and anything stuck right below them, such as a second bar under the header. Stacked elements are added up.
- **Sticky** elements with a `top` that come before the target in the page: siblings of the target or of one of its ancestors. They stick at their `top` by the time the target arrives, so they count even when they are not stuck yet, like a notice bar that sits above a section until you scroll past it.

It ignores:

- elements taller than half of the container, such as overlays, backdrops and full-screen menus;
- elements that are not stuck at the top, such as a sticky sidebar or a fixed button at the bottom;
- for a container, anything outside it.

Use `'auto'` when the header changes between pages or breakpoints and you would rather not name it. Name it (`'#header'`) when you know it: that is cheaper and never guesses.

### Keep one source of truth: `'css'`

The browser's own jumps (a link from another page, find in page, a jump without JavaScript) ignore the script's offset, but they respect CSS. Write the offset once in CSS, and let the script read it:

```css
html {
  scroll-padding-top: 5rem; /* the page */
}

.faq h3 {
  scroll-margin-top: 1rem; /* extra space for these targets */
}
```

```js
autoScrollTo({ offset: 'css' })
```

`'css'` reads `scroll-padding-top` from the container (`<html>` for the page) and `scroll-margin-top` from the target, and adds them up. Percentages are read against the container height; `auto` counts as `0`.

Combine it with anything else in an array:

```js
autoScrollTo({ offset: ['css', '#cookie-bar'] })
```

Before 1.2.0, the layouts guide suggested setting `scroll-padding-top` **and** `offset: '#header'`. That still works exactly the same: `offset` never reads CSS unless you pass `'css'`. Switching to `offset: 'css'` removes the duplicate.

### Compute it: a function

```js
scrollTo('#pricing', {
  offset: ({ container, target }) => (target.matches('.wide') ? 0 : header.offsetHeight + 12),
})
```

It is called on every frame with the container (`window` for the page) and the target element. Return pixels; anything that is not a number counts as `0`.

Offsets only apply to elements. Positions such as `400`, `'top'` and `'+=400'` are where the container scrolls to, whatever covers it.

## Targets

| Target                          | Scrolls to                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| An element, `'#id'`, a selector | That element, aligned with `block`, `inline` and `offset`                              |
| `'top'` (or `'#top'`, `'#'`)    | The top                                                                                |
| `'bottom'`                      | The bottom                                                                             |
| `400`                           | 400 pixels from the top                                                                |
| `'+=400'`, `'-=400'`            | 400 pixels below or above where it is now                                              |
| `'+=50%'`, `'-=100%'`           | Half a screen down, or a full screen up (of the container height)                      |
| `{ top, left }`                 | A point on both axes; each takes the same values as above, and a missing one stays put |

Everything is clamped to what the container can scroll, so `'-=9000'` stops at the top.

Relative targets are fixed when the scroll starts: `'+=400'` moves 400 pixels from where it was, even if the content moves on the way. A new scroll replaces the running one, so a "Next screen" button pressed twice goes one screen from wherever the first scroll stopped.

```html
<button type="button" data-scroll-to="+=100%">Next screen</button>
<button type="button" data-scroll-to="bottom">Skip to the end</button>
```

### Page through a strip

For carousels and horizontal strips, move by the width of the strip:

```js
const strip = document.querySelector('.strip')

next.addEventListener('click', () => scrollTo({ left: '+=100%' }, { container: strip }))
prev.addEventListener('click', () => scrollTo({ left: '-=100%' }, { container: strip }))
```

Percentages on `left` are of the container width. Combine it with CSS `scroll-snap-type` on the strip if you want it to settle on items: snapping is paused while the scroll runs. In a right-to-left strip, `'-=100%'` is forward ([Layouts](../layouts/#right-to-left)).

## Only when needed

`when: 'needed'` does nothing when the target element is already fully visible below the offset. Otherwise it scrolls as usual, with your `block` and `inline` alignment:

```js
// Center the field with the error, unless the visitor can already see it.
scrollTo(field, { when: 'needed', block: 'center', focus: true })
```

It still resolves to `true`, calls `onEnd` with `reason: 'arrived'`, moves focus and writes the hash, so code that waits for the scroll keeps working. It is decided once, at the start: a target that comes into view on the way does not stop the scroll early.

`block: 'nearest'` is different: it always moves the target fully into view, by the shortest distance. `when: 'needed'` keeps your alignment and only skips the scroll.

## Timing

| Option        | Default                    | Effect                                                                |
| ------------- | -------------------------- | --------------------------------------------------------------------- |
| `duration`    | `'auto'`                   | Milliseconds. A number always wins.                                   |
| `speed`       | none                       | Pixels per second, for an `'auto'` duration: the farther, the longer. |
| `maxDuration` | `1000` (none with `speed`) | The longest an `'auto'` duration can last                             |

Without `speed`, `'auto'` uses half a millisecond per pixel, between 300 and 1000 milliseconds. `maxDuration` changes that ceiling:

```js
// A long page: let far jumps take up to 2 seconds.
autoScrollTo({ maxDuration: 2000 })
```

With `speed`, every scroll moves at the same pace, so short hops are quick and long ones take their time. Add `maxDuration` so a very long page does not take forever:

```js
autoScrollTo({ speed: 2500, maxDuration: 1500 })
```

A number `duration` ignores both. `duration: 0`, `behavior: 'instant'` and reduced motion always jump.

## Easing

| `easing`                         | Feel                                                    |
| -------------------------------- | ------------------------------------------------------- |
| `'ease-in-out'` (default)        | Starts and ends gently                                  |
| `'ease-out'`                     | Starts fast, ends gently                                |
| `'ease-out-quint'`               | Starts very fast, glides into place                     |
| `'ease-in'`                      | Starts gently, ends fast                                |
| `'ease-out-back'`                | Overshoots a little and settles back                    |
| `'linear'`                       | Constant speed                                          |
| `'cubic-bezier(x1, y1, x2, y2)'` | Any CSS curve, such as the ones from your design tokens |
| `t => …`                         | Your own function from `0`–`1` to `0`–`1`               |

```js
autoScrollTo({ easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
```

The `cubic-bezier()` string is read like CSS: `x1` and `x2` must be between 0 and 1, while `y1` and `y2` can go beyond to overshoot. An invalid string uses `'ease-in-out'`. `cubicBezier(x1, y1, x2, y2)` is exported too, if you want the function itself.

`onProgress` reports `progress` (time) and `eased` (distance after easing). With an overshooting curve, `eased` goes a little past `1` before it settles.

## In HTML

Every option above that has a value works on a trigger too:

```html
<a
  href="#faq"
  data-scroll-to-offset="auto"
  data-scroll-to-speed="2000"
  data-scroll-to-easing="cubic-bezier(0.2, 0.8, 0.2, 1)"
  data-scroll-to-when="needed"
  >FAQ</a
>
```

`data-scroll-to-offset` takes one value: pixels, a percentage, a selector, `auto` or `css`. Arrays and functions are for JavaScript.
