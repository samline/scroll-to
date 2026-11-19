# Changelog

All notable changes to this package. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [semver](https://semver.org/).

## [1.6.0] - 2026-11-19

### Added

- `queue: true` (and `data-scroll-to-queue`) waits for the running scroll on the container, and the ones already waiting, instead of replacing it. A scroll without `queue` ends the waiting ones as `replaced`, an interruption as `interrupted`, and `cancelScroll()` or an aborted `signal` as `cancelled`, all without moving.
- `scrollSequence(steps, options?)` in a new entry, `@samline/scroll-to/sequence` (and `ScrollTo.scrollSequence` in the browser bundle): guided tours through a list of targets or `{ target, pause, ...options }` steps, with `play`, `pause`, `toggle`, `next`, `prev`, `goTo`, `loop`, `autoplay`, a pause per step, `onChange({ index, playing, step })` and an idempotent `destroy()`. It pauses itself when the visitor takes over or another scroll replaces its own.
- Types `SequenceStep`, `ScrollSequenceOptions`, `SequenceState` and `ScrollSequence`.
- Documentation: a Queues and guided tours guide, and a Guided tour example.

### Changed

- Size budgets: 6.4 KB gzip for the package, 5.3 KB for `@samline/scroll-to/sequence` and 7 KB for the browser bundle, which now includes `scrollSequence` (from 6.2 and 6.3 KB).

## [1.5.0] - 2026-11-18

### Added

- `container: 'auto'` (and `data-scroll-to-container="auto"`) scrolls every ancestor of the target that scrolls, then the page, in one animation, like `scrollIntoView` with this package's offset, easing, focus and hash. The `offset` applies to the outermost container, `when: 'needed'` is decided for each one, callbacks report the innermost container, and `cancelScroll()` or `isScrolling()` on any of them sees the scroll.
- Right-to-left containers and pages: `inline: 'start'` and `'end'` follow the reading direction, `'next'` and `'prev'` step in reading order, and horizontal positions are clamped to the negative range browsers use.
- Documentation: nested boxes, scroll snap, right to left and CSS `scroll-behavior` in the Layouts guide, and a Nested boxes example.

### Changed

- `scroll-snap-type` is turned off on the containers a scroll moves while it runs, and restored when it ends, so snapping strips and pages no longer stutter or pull the scroll back.
- A target that is already in place arrives without calling `scrollTo()` on its container.
- Inline styles the package added and removed (`--scroll-to-progress`, the paused snap) no longer leave an empty `style` attribute behind.
- Size budgets: 6.2 KB gzip for the package and 6.3 KB for the browser bundle (from 5.6 and 5.7 KB).

## [1.4.0] - 2026-11-18

### Added

- `highlight` (`true` for 1500 ms, or a number of milliseconds) sets `data-scroll-to-arrived` on the target once it arrives, so CSS can show where the visitor landed. Arriving again restarts the time; scrolls that do not arrive leave it alone. `data-scroll-to-highlight` sets it per trigger.
- `--scroll-to-progress`: while a scroll runs, the scrolling element and the trigger carry the eased progress from `0` to `1` as an inline custom property, removed when it ends, for bars and fills without JavaScript.
- `backToTop(button, options?)` returns `{ update, destroy }`: the button gets `data-scroll-to-visible` (`'true'` past `threshold`, by default one screen) and `--scroll-to-scrolled` (how far down the container is, from `0` to `1`) for a progress ring; a click scrolls to `target` (the top by default) and moves focus there when the button had it. The browser bundle turns `[data-scroll-to-back-to-top]` elements into these buttons, with the attribute's value as the threshold, and `ScrollTo.backToTop` is exposed.
- Constants `ARRIVED_ATTRIBUTE`, `VISIBLE_ATTRIBUTE`, `PROPERTIES` and `HIGHLIGHT_DURATION`, and the types `BackToTopOptions` and `BackToTopController`.
- Documentation: a Highlight and back to top guide, and two examples, Highlight and Back to top.

### Changed

- Size budgets: 5.6 KB gzip for the package and 5.7 KB for the browser bundle (from 4.8 and 4.9 KB).

## [1.3.0] - 2026-11-18

### Added

- `'next'` and `'prev'` targets step to the next or previous section, in HTML (`data-scroll-to="next"`) and in code. `sections` (and `data-scroll-to-sections`) chooses what counts as a section; the default is `'section'`. Sections are compared by where the container would scroll to, with the offset and alignment, so sections it cannot move to are skipped, and a press while a scroll heads to a section steps on from that section.
- `reveal` (default `true`): before scrolling, closed `<details>` around the target open (unless the target is in their summary), and `hidden="until-found"` ancestors receive a `beforematch` event and are shown, like the browser does for fragment links. `data-scroll-to-reveal="false"` and `reveal: false` turn it off.
- Trigger attributes `data-scroll-to-focus` and `data-scroll-to-hash` (`push`, `replace`, `false`) set focus and history per link.
- Documentation: a Sections and hidden content guide, a Stop button in the Follow the scroll example, and two examples, Next and previous, and Hidden answers.

### Changed

- Interruptions: only input that takes over the scroll stops it. The wheel and touch still do; keys only when they scroll (arrows, Page Up, Page Down, Home, End, Space), and mouse presses only outside links, buttons and form controls. Tab, Enter and pressing a trigger again no longer stop a scroll, so a Stop button now ends it as `cancelled` through `cancelScroll()` or a `signal`.
- Targets inside closed `<details>` and `hidden="until-found"` content are revealed before the scroll (see `reveal`).
- Size budgets: 4.8 KB gzip for the package and 4.9 KB for the browser bundle (from 4.2 and 4.3 KB).

## [1.2.0] - 2026-11-18

### Added

- `offset: 'auto'` keeps space for what will cover the top of the container once the target arrives: fixed elements at the top edge and anything stuck below them, and sticky elements with a `top` that come before the target, even when they are not stuck yet. Measured on every frame. Elements taller than half of the container (overlays, backdrops) are ignored.
- `offset: 'css'` reads the container's `scroll-padding-top` and the target's `scroll-margin-top`, so the CSS that aligns the browser's own jumps also aligns the script's.
- `offset` takes a function, `({ container, target }) => number`, and an array of offsets that are added up, such as `['#header', 16]`.
- Targets: `'bottom'`, relative positions (`'+=400'`, `'-=50%'`, a percentage of the container height) fixed when the scroll starts, and points on both axes (`{ top, left }`, with `{ left: '+=100%' }` to page through a strip).
- `when: 'needed'` does not move when the target element is already fully visible below the offset; it still resolves to `true`, moves focus and writes the hash.
- `speed` (pixels per second) and `maxDuration` for `'auto'` durations.
- Easing: `'cubic-bezier(x1, y1, x2, y2)'` strings, the `cubicBezier()` function, and the `ease-in`, `ease-out-quint` and `ease-out-back` curves.
- Trigger attributes `data-scroll-to-speed`, `data-scroll-to-easing` and `data-scroll-to-when`; `data-scroll-to-offset` accepts `auto` and `css`, and `data-scroll-to` accepts `bottom` and relative positions.
- Types: `ScrollPoint`, `ScrollCoordinate`, `OffsetValue`, `OffsetContext` and `EasingValue`.
- Documentation: an Aim and timing guide, and two examples, Stacked bars and Page a strip.

### Changed

- An invalid selector as `offset` counts as `0` instead of throwing.
- Size budgets: 4.2 KB gzip for the package and 4.3 KB for the browser bundle (from 3.2 and 3.3 KB).

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
