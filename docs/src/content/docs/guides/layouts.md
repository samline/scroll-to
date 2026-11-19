---
title: 'Layouts and focus'
titleAccent: 'focus'
description: 'Use @samline/scroll-to with fixed headers, skip links, nested scroll containers, scroll snap, right-to-left strips, history and reduced motion.'
locale: en
sidebar:
  group: guides
  order: 2
---

## Fixed headers

Pass the header as the offset. Its height is measured on every scroll, so a header that shrinks or wraps still clears:

```js
autoScrollTo({ offset: '#header' })
```

With an offset, links from other pages that land on `#section` are aligned once the page loads (`initialHash`). For jumps the script does not handle, such as the browser's find-in-page or `:target` navigation without JavaScript, also set CSS, and let the script read the same value with `offset: 'css'`:

```css
html {
  scroll-padding-top: 5rem;
}
```

```js
autoScrollTo({ offset: 'css' })
```

When the header changes between pages or breakpoints, or a sticky bar sits below it, `offset: 'auto'` measures every fixed and sticky element stuck at the top. Offsets also add up in an array, such as `['#header', 16]`. [Aim and timing](../aim-and-timing/) covers every kind of offset.

## Skip links and focus

Links move focus to their target on arrival, so keyboard and screen reader users continue from there. A skip link needs nothing else:

```html
<a class="skip" href="#main">Skip to content</a>
<main id="main">…</main>
```

Targets that cannot take focus get `tabindex="-1"`. To hide the focus ring on them, style `[tabindex='-1']:focus { outline: none; }`.

## Scroll containers

When a panel scrolls instead of the page, pass it as `container`, in code or on the trigger:

```html
<button type="button" data-scroll-to="#step-3" data-scroll-to-container="#wizard">Step 3</button>
```

The offset and the alignment are measured inside the container.

### Boxes inside boxes

When the target sits in a box that scrolls, inside a page that scrolls too, pass `container: 'auto'` (or `data-scroll-to-container="auto"`). Like `scrollIntoView`, it scrolls every ancestor of the target that can scroll, then the page, but with your offset, easing, focus and hash:

```js
autoScrollTo({ container: 'auto', offset: '#header' })
```

- Ancestors that do not scroll, or have nothing left to scroll, are skipped, and so is a page that cannot scroll.
- They all move together, in one animation. Each outer container measures the target where it is once the inner ones have moved, so it lands in place in all of them.
- The `offset` applies to the outermost container, usually the page with its fixed header. Inner boxes align the target with `block` and `inline` only.
- `when: 'needed'` is decided for each container: one that already shows the target stays still.
- Positions such as `'top'`, `400` or `{ left }` have no element to follow, so `'auto'` scrolls the page for them.
- Callbacks and events report the innermost container as `container`. `cancelScroll()` on any of the containers, the page included, stops the scroll, and `isScrolling()` is `true` for each of them while it runs.
- `scrollPosition(target, { container: 'auto' })` returns the position for the innermost container.

## Horizontal strips

Center the selected tab, chip or slide without moving the page:

```js
scrollTo(tab, { container: tabs, inline: 'center', block: 'nearest' })
```

`block: 'nearest'` keeps the vertical position unless the strip is cut off.

### Scroll snap

Strips and pages with `scroll-snap-type` would pull every frame of an animation back to the last snap point, so the scroll stutters or never leaves. While a scroll runs, `scroll-snap-type` is turned off on every container it moves, with an inline `none !important`. When it ends, your own value comes back, or the inline style is removed, and the browser snaps from there.

Align the target where a snap point is, and nothing moves after the end. With `scroll-snap-align: start`, use `inline: 'start'` (or `block: 'start'`); if the container has `scroll-padding`, pass the same space as `offset: 'css'` for the vertical axis.

### Right to left

In a right-to-left page or strip (`dir="rtl"`), the inline axis starts on the right:

- `inline: 'start'` aligns the target with the right edge and `inline: 'end'` with the left edge. `center` and `nearest` work the same way in both directions.
- `'next'` moves forward in reading order, to the left, and `'prev'` back to the right.
- Horizontal positions follow the browser: `scrollLeft` is `0` at the right and goes negative to the left, and `{ left }` positions and the `left` in callbacks use the same values. Relative moves are physical too: `{ left: '-=100%' }` pages forward, to the left.

The direction is read from the container, and for the page from `<body>`, when the scroll starts.

### CSS scroll-behavior

`html { scroll-behavior: smooth }` (or on a container) keeps the browser's own jumps smooth for visitors without JavaScript. It does not slow down this package: every frame is set with `behavior: 'instant'`, which overrides the CSS, so the easing and duration you pass are the ones you see. Keep it in your stylesheet, and add `@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto } }` for visitors who ask for less motion.

## History

Links push their `#id` like a native jump, so Back returns to the previous section. Use `hash: 'replace'` to update the address without history entries, or `hash: false` to leave it alone.

## Reduced motion

When the visitor prefers reduced motion, every scroll jumps at once. The promise still resolves to `true`, and focus and the hash still change.
