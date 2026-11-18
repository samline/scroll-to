# Changelog

All notable changes to this package. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [semver](https://semver.org/).

## [1.0.1] - 2026-11-17

### Fixed

- `data-scroll-to-block` and `data-scroll-to-inline` ignore unknown values (a typo such as `"centre"`) and keep the option or default alignment, instead of falling back to `nearest`.

### Changed

- The package moved from the `samline/utils` monorepo to its own repository, [samline/scroll-to](https://github.com/samline/scroll-to). Homepage, repository and documentation links point to the package's own site.

## [1.0.0] - 2026-11-13

### Added

- First release: `scrollTo` animates the page or any container to an element, `#id`, selector, `'top'` or position, with `offset` (pixels, percentages or a live element such as a fixed header), `block` and `inline` alignment, `duration` and `easing`, a destination measured on every frame, interruption by the visitor, reduced motion, focus and URL hash handling, and a promise that tells whether it arrived. `scrollPosition` measures without moving, `cancelScroll` stops a scroll, and `autoScrollTo` handles same-page links and `[data-scroll-to]` triggers with one delegated listener, aligning the URL hash on load. ESM, CommonJS and a browser global (`window.ScrollTo`) that starts on its own.
