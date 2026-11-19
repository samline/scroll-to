# @samline/scroll-to

Smooth scrolling to anchors, elements and positions that lands where it should: below fixed headers, centered in strips or at the nearest edge, with easing, interruption, focus, history and a promise for when it arrives. For vanilla JavaScript, any framework and plain HTML.

[Demo](https://samline.github.io/scroll-to/) · [Examples](https://samline.github.io/scroll-to/examples/) · [Documentation](https://samline.github.io/scroll-to/docs/) · [Changelog](CHANGELOG.md)

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [HTML / CDN](#html--cdn)
- [Capabilities](#capabilities)
- [API at a glance](#api-at-a-glance)
- [Documentation](#documentation)
- [Changelog](#changelog)
- [AI agent skill](#ai-agent-skill)
- [License](#license)

## Installation

```sh
npm install @samline/scroll-to
```

```sh
pnpm add @samline/scroll-to
```

```sh
bun add @samline/scroll-to
```

Any modern browser; without JavaScript, links still jump to their sections. On the server, every function is inert. No runtime dependencies.

## Quick start

```js
import { autoScrollTo } from '@samline/scroll-to'

autoScrollTo({ offset: '#header' })
```

```html
<header id="header">
  <a href="#pricing">Pricing</a>
</header>

<section id="pricing">…</section>
<button type="button" data-scroll-to="top">Back to top</button>
```

From your own code:

```js
import { scrollTo } from '@samline/scroll-to'

const arrived = await scrollTo('#faq', { offset: '#header', duration: 600 })
```

Follow it while it runs:

```js
scrollTo('#faq', {
  offset: '#header',
  onProgress: ({ eased }) => bar.style.setProperty('--progress', eased),
  onEnd: ({ reason }) => console.log(reason), // 'arrived', 'interrupted', …
})
```

## HTML / CDN

For Shopify, WordPress or plain HTML pages without a build step, load the browser bundle. It handles same-page `#id` links and `[data-scroll-to]` as soon as the DOM is ready. Pin the version in production.

```html
<script
  src="https://cdn.jsdelivr.net/npm/@samline/scroll-to@1.2.0/dist/browser/scroll-to.global.js"
  defer
></script>
```

The bundle defines `window.ScrollTo`. Add `data-manual` to the script tag and call `ScrollTo.auto(options)` to start it with your own options.

## Capabilities

### Lands where it should

Keep space for a fixed header with `offset`: pixels, a percentage, the header element measured live, `'auto'` to find every fixed and sticky bar stuck at the top, or `'css'` to reuse your `scroll-padding-top`. Offsets add up in arrays. Align to the start, center, end or nearest edge on both axes, skip the scroll when the target is already visible with `when: 'needed'`, and land precisely even when images load on the way: the destination is measured on every frame.

### Any target, any pace

Scroll to `'bottom'`, move relatively with `'+=100%'`, page through a strip with `{ left: '+=100%' }`, and time it with a `duration`, a constant `speed` or a `maxDuration`. Easing takes a name, any CSS `cubic-bezier()` or your own function.

### Accessible like a native jump

Links move keyboard focus to their target on arrival and push the `#id` to the URL, so Tab continues from there and Back returns. Reduced motion jumps instead of animating.

### The visitor stays in control

A wheel, a touch or a key press stops the scroll at once, and a new scroll replaces the running one. Every scroll returns a promise of `true` (arrived) or `false` (interrupted).

### Follow every step

`onStart`, `onProgress` and `onEnd` follow a scroll from its first frame to its end, and `onEnd` says why it ended: `arrived`, `interrupted`, `replaced`, `cancelled` or `missing`. The same moments bubble as `scroll-to:start` and `scroll-to:end` events, and `data-scroll-to-state="scrolling"` marks the trigger and the scrolling element while it runs, so plain HTML and CSS can react too. Stop a scroll from anywhere with an `AbortSignal`.

### Write the defaults once

`createScrollTo({ offset: '#header' })` returns a scroller with shared options for every call, its own `auto()` for links, and one `destroy()` that stops what it started.

### Any container

Scroll the page or any box, and center the selected tab of a horizontal strip without moving the page. Triggers can carry their own offset, container, alignment and duration as attributes.

## API at a glance

| API                                | Purpose                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| `autoScrollTo(options?)`           | Handle same-page links and `[data-scroll-to]` with one listener. Returns `{ destroy }`. |
| `scrollTo(target, options?)`       | Scroll to an element, `#id`, selector, `'top'` or position. Resolves `true` on arrival. |
| `scrollPosition(target, options?)` | Where it would scroll, without moving.                                                  |
| `cancelScroll(container?)`         | Stop the running scroll.                                                                |
| `isScrolling(container?)`          | Whether a scroll is running.                                                            |
| `createScrollTo(defaults?)`        | A scroller with shared options: `{ to, position, cancel, isScrolling, auto, destroy }`. |
| `onStart`, `onProgress`, `onEnd`   | Options that follow a scroll; `onEnd` gets `{ arrived, reason, top, left, target }`.    |
| `signal`                           | An `AbortSignal` that stops the scroll.                                                 |
| `offset: 'auto' \| 'css' \| [...]` | Find stuck headers, read CSS scroll padding, or add offsets up.                         |
| `when: 'needed'`                   | Skip the scroll when the target is already visible.                                     |
| `speed`, `maxDuration`, `easing`   | Pace by pixels per second; easing takes names, `cubic-bezier()` or a function.          |
| `cubicBezier(x1, y1, x2, y2)`      | The easing function of a CSS curve.                                                     |
| `scroll-to:start`, `scroll-to:end` | Bubbling events on the target, with the same details as the callbacks.                  |

### Entrypoints

| Entrypoint                   | When to use                                    |
| ---------------------------- | ---------------------------------------------- |
| `@samline/scroll-to`         | ESM or CommonJS, every function.               |
| `@samline/scroll-to/vanilla` | `scrollTo` as the default export.              |
| `@samline/scroll-to/browser` | Classic script that defines `window.ScrollTo`. |

## Documentation

Read the [documentation](https://samline.github.io/scroll-to/docs/) for the full guides and API contracts, and explore [working examples](https://samline.github.io/scroll-to/examples/) with complete and separate source files.

| Guide                                                                             | What it covers                                                                           |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [Installation](https://samline.github.io/scroll-to/docs/getting-started/)         | npm, CDN and the first links.                                                            |
| [API reference](https://samline.github.io/scroll-to/docs/reference/api/)          | Every function, `createScrollTo`, the events, the types and `window.ScrollTo`.           |
| [Options](https://samline.github.io/scroll-to/docs/reference/configuration/)      | Options, targets and attributes.                                                         |
| [Layouts](https://samline.github.io/scroll-to/docs/guides/layouts/)               | Fixed headers, skip links, containers, tabs and history.                                 |
| [Aim and timing](https://samline.github.io/scroll-to/docs/guides/aim-and-timing/) | Every offset, relative targets and points, `when`, speed, durations and easing.          |
| [Lifecycle](https://samline.github.io/scroll-to/docs/guides/lifecycle/)           | Callbacks, end reasons, events, the state attribute, `AbortSignal` and `createScrollTo`. |
| [Frameworks](https://samline.github.io/scroll-to/docs/guides/frameworks/)         | React, Vue, Svelte, Astro and client-side routers.                                       |

## Changelog

Read [CHANGELOG.md](CHANGELOG.md) or the [published changelog](https://samline.github.io/scroll-to/docs/changelog/) for release history and explicitly marked breaking and behavior changes. Review the notes before upgrading.

## AI agent skill

The [Scroll To skill](https://samline.github.io/scroll-to/skills/scroll-to/SKILL.md) teaches verified package integration. Its maintained [repository source](skills/scroll-to/SKILL.md) and website download are the same file. Verify the installed package version before applying its guidance.

Download [SKILL.md](https://samline.github.io/scroll-to/skills/scroll-to/SKILL.md) into a `scroll-to/` folder in your agent's supported skill directory. For agents that discover project skills from `.agents/skills/`:

```sh
mkdir -p .agents/skills/scroll-to
curl --fail --location https://samline.github.io/scroll-to/skills/scroll-to/SKILL.md \
  --output .agents/skills/scroll-to/SKILL.md
```

Keep the filename `SKILL.md`; discovery paths and invocation syntax depend on the agent.

## License

MIT — [LICENSE.md](LICENSE.md).
