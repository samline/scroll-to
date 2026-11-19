---
title: 'Queues and guided tours'
titleAccent: 'guided tours'
description: 'Queue scrolls one after another with queue, and build guided tours, demos and kiosks with scrollSequence: play, pause, next, prev and loop.'
locale: en
sidebar:
  group: api
  order: 3
---

## One after another

A new scroll on a container replaces the running one: the first ends with `reason: 'replaced'` and the new one starts from wherever the first had reached. With `queue: true`, the new scroll waits instead, and starts once the running one ends:

```js
import { scrollTo } from '@samline/scroll-to'

scrollTo('#intro')
scrollTo('#features', { queue: true })
scrollTo('#pricing', { queue: true }) // waits for both
```

Each queued scroll keeps its own options and its own promise, which resolves when it ends. On a trigger, add `data-scroll-to-queue`:

```html
<button type="button" data-scroll-to="next" data-scroll-to-queue>Next section</button>
```

### When the line is cleared

The waiting scrolls never start, and end without moving, when:

| What happens                                              | They end with   |
| --------------------------------------------------------- | --------------- |
| A scroll **without** `queue` starts                       | `'replaced'`    |
| The visitor takes over the running scroll                 | `'interrupted'` |
| `cancelScroll()`, or the running scroll's `signal` aborts | `'cancelled'`   |

Their promises resolve to `false`, and `onEnd` and `scroll-to:end` report the reason as usual. A running scroll that arrives, or whose target is missing, lets the next one start.

Queues are kept per container. With `container: 'auto'`, a queued scroll waits for the page's scroll.

## Guided tours

`scrollSequence` walks through a list of stops, for product tours, demos, presentations and kiosks. It comes from its own entry, so pages that do not use it do not load it:

```js
import { scrollSequence } from '@samline/scroll-to/sequence'

const tour = scrollSequence(
  ['#welcome', '#search', { target: '#reports', pause: 4000 }, '#share'],
  {
    offset: '#header',
    pause: 2000,
  }
)

play.addEventListener('click', () => tour.toggle())
next.addEventListener('click', () => tour.next())
prev.addEventListener('click', () => tour.prev())
```

With the browser bundle it is `ScrollTo.scrollSequence`.

### Steps

Each step is a target (anything `scrollTo` takes) or an object with a `target`, its own `pause`, and any scroll option, which wins over the sequence's options for that step:

```js
scrollSequence([
  '#intro',
  { target: '#chart', block: 'center', pause: 5000 },
  { target: '#table', duration: 1200, highlight: true },
])
```

### Playing

| Method      | What it does                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------ |
| `play()`    | Moves on by itself from the next step, staying `pause` ms on each. From the end, it starts over. |
| `pause()`   | Stops moving on. A scroll on its way still arrives.                                              |
| `toggle()`  | `play()` or `pause()`                                                                            |
| `next()`    | Scrolls to the next step. Resolves `true` on arrival, `false` past the last step without `loop`. |
| `prev()`    | Scrolls to the previous step                                                                     |
| `goTo(i)`   | Scrolls to step `i`, clamped to the list                                                         |
| `destroy()` | Stops playing and stops its scroll (`'cancelled'`). Idempotent; later calls do nothing.          |

`index` (`-1` before the first step), `playing` and `length` read where it is. Stepping by hand while it plays keeps it playing: the pause starts again from the step you chose.

| Option     | Default | Description                                               |
| ---------- | ------- | --------------------------------------------------------- |
| `pause`    | `2000`  | How long each step stays while playing, in milliseconds   |
| `loop`     | `false` | After the last step, start again from the first           |
| `autoplay` | `false` | Start playing at once                                     |
| `onChange` | none    | `({ index, playing, step }) => void`, when either changes |

Every other option is a scroll option for every step: `offset`, `container`, `duration`, `easing`, `highlight` and the rest.

### The visitor stays in control

A tour pauses on its own when the visitor scrolls, touches the page or presses a key that scrolls (`'interrupted'`), and when another scroll replaces its own, such as a click on a link (`'replaced'`). It does not move focus unless a step asks for `focus: true`.

Content that moves by itself for more than five seconds needs a way to pause it (WCAG 2.2.2). Always show a Pause button next to a playing tour, and keep its label in sync with `onChange`:

```js
const tour = scrollSequence(stops, {
  onChange: ({ index, playing }) => {
    play.textContent = playing ? 'Pause' : 'Play'
    play.setAttribute('aria-pressed', String(playing))
    status.textContent = `Stop ${index + 1} of ${tour.length}`
  },
})
```

Put the counter in an `aria-live="polite"` region so screen readers hear where the tour is. With reduced motion every step jumps instead of scrolling, and the tour keeps its timing.
