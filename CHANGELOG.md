# Changelog

All notable changes to this package. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [semver](https://semver.org/).

## [1.1.0] - 2026-11-18

### Added

- `onStart`, `onProgress` and `onEnd` options follow a scroll from its first frame to its end. `onProgress` receives `progress` (time) and `eased` (distance), and `onEnd` receives `arrived` and a `reason`: `'arrived'`, `'interrupted'`, `'replaced'`, `'cancelled'` or `'missing'`. Every detail carries `target`, `container`, `trigger` (the clicked element, with `autoScrollTo`) and the current `top` and `left`.
- `signal` option: an `AbortSignal` that stops the scroll. An already aborted signal does not start one, nor replace the running scroll.
- Bubbling `scroll-to:start` and `scroll-to:end` events on the target (or the scrolling element for positions and missing targets), with the same details as the callbacks.
- `data-scroll-to-state="scrolling"` on the scrolling element (`<html>` for the page) and on the clicked trigger while a scroll runs.
- `isScrolling(container?)` tells a scroll started by the package from the visitor's own.
- `createScrollTo(defaults)` returns a scroller with shared options: `{ to, position, cancel, isScrolling, auto, destroy }`. `destroy()` stops only the scrolls it started and its `auto()` controllers.
- `ScrollTo.isScrolling` and `ScrollTo.createScrollTo` on the browser global; `EVENTS`, `END_REASONS` and `STATE_ATTRIBUTE` constants, and the `ScrollDetail`, `ScrollProgress`, `ScrollResult`, `ScrollEndReason` and `ScrollToInstance` types.
- Documentation: a Lifecycle and events guide, and two examples, Follow the scroll and Events and state.

### Changed

- Size budgets: 3.2 KB gzip for the package and 3.3 KB for the browser bundle (from 2.5 and 2.6 KB).

## [1.0.1] - 2026-11-17

### Fixed

- `data-scroll-to-block` and `data-scroll-to-inline` ignore unknown values (a typo such as `"centre"`) and keep the option or default alignment, instead of falling back to `nearest`.

### Changed

- Internal: the DOM controller moved from `src/core` to `src/vanilla`; `src/core` keeps the DOM-free types, constants and helpers. Public entries are unchanged.
- The package moved from the `samline/utils` monorepo to its own repository, [samline/scroll-to](https://github.com/samline/scroll-to). Homepage, repository and documentation links point to the package's own site.

## [1.0.0] - 2026-11-13

### Added

- First release: `scrollTo` animates the page or any container to an element, `#id`, selector, `'top'` or position, with `offset` (pixels, percentages or a live element such as a fixed header), `block` and `inline` alignment, `duration` and `easing`, a destination measured on every frame, interruption by the visitor, reduced motion, focus and URL hash handling, and a promise that tells whether it arrived. `scrollPosition` measures without moving, `cancelScroll` stops a scroll, and `autoScrollTo` handles same-page links and `[data-scroll-to]` triggers with one delegated listener, aligning the URL hash on load. ESM, CommonJS and a browser global (`window.ScrollTo`) that starts on its own.
