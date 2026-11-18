---
name: scroll-to
description: Use @samline/scroll-to for smooth scrolling to anchors, elements and positions with fixed header offsets, alignment, easing, focus and history, in vanilla JS, any framework or plain HTML.
package-version: '1.1.0'
---

# @samline/scroll-to

Build against the installed version; this skill describes 1.1.0.

- **Install:** `npm install @samline/scroll-to`. Plain HTML: load `https://cdn.jsdelivr.net/npm/@samline/scroll-to@1.1.0/dist/browser/scroll-to.global.js`; it handles same-page `#id` links and `[data-scroll-to]` on its own (`data-manual` on the script tag, then `ScrollTo.auto(options)`, to pass options). No stylesheet.
- **Markup:** plain `<a href="#id">` links, or any element with `data-scroll-to="#id" | selector | top`. Per-trigger attributes: `data-scroll-to-offset`, `-container`, `-block`, `-inline`, `-duration`.
- **Script:** `autoScrollTo({ offset, container, block, inline, duration, easing, behavior, interruptible, focus, hash, signal, onStart, onProgress, onEnd, selector, scope, initialHash })` returns `{ destroy }`; `await scrollTo(target, options)` resolves `true` on arrival, `false` when interrupted or replaced; `scrollPosition(target, options)` measures only; `cancelScroll(container)`; `isScrolling(container)`.
- **Lifecycle:** `onStart(detail)`, `onProgress({ progress, eased, ...detail })`, `onEnd({ arrived, reason, ...detail })` with `detail = { target, container, trigger, top, left }`; `reason` is `arrived | interrupted | replaced | cancelled | missing`, and `onEnd` runs exactly once (after focus/hash). `signal: AbortSignal` stops it (`cancelled`). Bubbling `scroll-to:start` / `scroll-to:end` events on the target (or the scrolling element for positions/missing). `data-scroll-to-state="scrolling"` on `<html>`/the container and the clicked trigger while running; `isScrolling(container)` tells scripted scrolls from the visitor's.
- **Defaults:** `createScrollTo(defaults)` returns `{ to, position, cancel, isScrolling, auto, destroy }`; per-call options replace defaults key by key; `destroy()` (idempotent) stops only its own scrolls and `auto()` controllers.
- **Semantics:** `offset` takes px, `%` or an element/selector whose height is used; destination re-measured each frame; wheel/touch/key interrupts; reduced motion jumps. `autoScrollTo` defaults to `focus: true` and `hash: 'push'`; plain `scrollTo` changes neither unless asked.
- **Layouts:** pass `container` for scrolling boxes and `inline: 'center', block: 'nearest'` to center tabs in a strip; add `scroll-padding-top` in CSS for jumps the script does not handle.
- **Do not** poll `scrollY` to detect the end of a scroll (use `onEnd` or `scroll-to:end`), or wrap `scrollTo` in a timeout to cancel it (use `signal`). **Do not** add another click handler that calls `scrollIntoView` on the same links, compute offsets with `offsetTop` yourself, or use `<span>` click targets where a link works.
