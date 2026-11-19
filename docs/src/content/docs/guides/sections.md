---
title: 'Sections and hidden content'
titleAccent: 'hidden content'
description: 'Step through sections with next and prev, open closed details and hidden="until-found" content, and set focus, hash and reveal per link.'
locale: en
sidebar:
  group: guides
  order: 4
---

## Next and previous

`'next'` and `'prev'` are targets: the next or previous section from where the container is now. They work in HTML and in code.

```html
<nav class="steps">
  <button type="button" data-scroll-to="prev">Previous section</button>
  <button type="button" data-scroll-to="next">Next section</button>
</nav>
```

```js
import { scrollTo } from '@samline/scroll-to'

document.addEventListener('keydown', event => {
  if (event.key === 'j') scrollTo('next', { offset: '#header' })
  if (event.key === 'k') scrollTo('prev', { offset: '#header' })
})
```

### Which section is next

The sections are the elements that match `sections` (default `'section'`) inside the container, in page order. For each one, the package works out where the container would scroll to show it, with your `offset`, `block` and `inline`:

- `'next'` is the **first** section that would move the container forward.
- `'prev'` is the **last** section that would move it back.

Because it compares destinations, the offset is part of the answer: with a fixed header and `offset: '#header'`, a section that is already right below the header counts as the current one, not the next. Sections that are hidden (no size) are skipped, and so are sections the container cannot scroll to any more, such as the last short ones at the bottom of the page. When there is nothing to step to, the scroll ends with `reason: 'missing'`, the promise resolves to `false`, and a trigger's click is left alone.

### Quick presses add up

A press while a scroll is still on its way to a section steps on from **that** section, not from wherever the page happens to be mid-way. Pressing Next three times quickly moves three sections.

### Choose the sections

Pass any selector as `sections`, or set `data-scroll-to-sections` on a trigger:

```html
<button type="button" data-scroll-to="next" data-scroll-to-sections=".chapter">Next chapter</button>
```

```js
autoScrollTo({ offset: 'auto', sections: 'section, .chapter' })
```

### Slides in a strip

In a horizontal container, the same targets step sideways. Align the slides with `inline`:

```js
const slides = document.querySelector('.slides')
const options = { container: slides, sections: '.slide', inline: 'start', block: 'nearest' }

next.addEventListener('click', () => scrollTo('next', options))
prev.addEventListener('click', () => scrollTo('prev', options))
```

To move by a fixed distance instead of to the next element, use a relative target such as `{ left: '+=100%' }` ([Aim and timing](../aim-and-timing/)).

## Hidden targets

A link to an answer inside a closed `<details>` lands on nothing: the answer has no size until it is open. Before it scrolls, scroll-to opens what hides the target, the way the browser does for a fragment link:

- every closed `<details>` around the target, **unless** the target is inside its `<summary>`, which is visible already;
- every `hidden="until-found"` ancestor: it receives a `beforematch` event, then loses its `hidden` attribute.

```html
<a href="#refunds">How do refunds work?</a>

<details>
  <summary>Payments</summary>
  <h3 id="refunds">Refunds</h3>
  <p>…</p>
</details>
```

Listen to `beforematch` to keep your own state in sync, for example an accordion that tracks which panel is open:

```js
panel.addEventListener('beforematch', () => setOpen(panel.id))
```

Only ancestors are opened: a link to the `<details>` element itself scrolls to it as it is. `scrollPosition` never opens anything; it only measures.

To leave hidden content closed, pass `reveal: false`, or set `data-scroll-to-reveal="false"` on a trigger.

## Per-link focus, hash and reveal

`autoScrollTo` moves focus and pushes the hash for every link. Change that for one trigger with attributes:

| Attribute               | Values                              | Default for `autoScrollTo` |
| ----------------------- | ----------------------------------- | -------------------------- |
| `data-scroll-to-focus`  | `true`, `false` (or empty for true) | `true`                     |
| `data-scroll-to-hash`   | `push`, `replace`, `false`          | `push`                     |
| `data-scroll-to-reveal` | `true`, `false`                     | `true`                     |

```html
<!-- A "Back to top" that leaves focus and the address alone. -->
<button type="button" data-scroll-to="top" data-scroll-to-focus="false" data-scroll-to-hash="false">
  Back to top
</button>

<!-- A table of contents that updates the address without filling the history. -->
<a href="#install" data-scroll-to-hash="replace">Install</a>
```

Unknown values are ignored and the option given to `autoScrollTo` stays.

## What stops a scroll

The visitor stays in control: the scroll stops (`reason: 'interrupted'`) as soon as they take over.

| Input             | Stops the scroll                                                            |
| ----------------- | --------------------------------------------------------------------------- |
| Wheel or trackpad | Always                                                                      |
| Touch             | Always                                                                      |
| Keys              | Only keys that scroll: arrows, Page Up, Page Down, Home, End and Space      |
| Mouse press       | Only outside links, buttons and form controls: on the scrollbar, or to drag |

Pressing Next again, tabbing, or clicking a link does not stop the scroll; a new scroll replaces it instead (`reason: 'replaced'`). A "Stop" button therefore needs its own code: `cancelScroll()`, or `abort()` on a `signal`. Pass `interruptible: false` for scrolls that must finish.
