---
title: 'Configuration options'
titleAccent: 'options'
description: 'Every @samline/scroll-to option, callback and data-scroll-to attribute, with defaults, the state attribute and the events.'
locale: en
sidebar:
  group: reference
  order: 2
  label: Configuration
---

## Options

`scrollTo`, `scrollPosition` and `autoScrollTo` take the same options.

| Option          | Default                               | Description                                                                                                                                                                                                                                                                                                                                                       |
| --------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `container`     | the page                              | What scrolls: an element or a selector. Use it for boxes, tab strips and carousels.                                                                                                                                                                                                                                                                               |
| `offset`        | `0`                                   | Space kept above the target: pixels (`80` or `'80px'`), a percentage of the container height (`'10%'`), an element or selector whose height is used (`'#header'`), `'auto'` (fixed and sticky elements stuck at the top), `'css'` (`scroll-padding-top` plus `scroll-margin-top`), a function `({ container, target }) => number`, or an array of these, added up |
| `block`         | `'start'`                             | Vertical alignment: `start`, `center`, `end` or `nearest` (only scrolls when the target is not fully visible)                                                                                                                                                                                                                                                     |
| `inline`        | `'nearest'`                           | Horizontal alignment, same values                                                                                                                                                                                                                                                                                                                                 |
| `duration`      | `'auto'`                              | Milliseconds, or `'auto'`: half a millisecond per pixel, from 300 to 1000, or from `speed`                                                                                                                                                                                                                                                                        |
| `speed`         | none                                  | Pixels per second for an `'auto'` duration                                                                                                                                                                                                                                                                                                                        |
| `maxDuration`   | `1000` (none with `speed`)            | The longest an `'auto'` duration can last, in milliseconds                                                                                                                                                                                                                                                                                                        |
| `easing`        | `'ease-in-out'`                       | `'ease-in-out'`, `'ease-out'`, `'ease-out-quint'`, `'ease-in'`, `'ease-out-back'`, `'linear'`, a `'cubic-bezier(x1, y1, x2, y2)'` string or a function from 0–1 to 0–1                                                                                                                                                                                            |
| `sections`      | `'section'`                           | What `'next'` and `'prev'` step through, inside the container                                                                                                                                                                                                                                                                                                     |
| `reveal`        | `true`                                | Open closed `<details>` and `hidden="until-found"` content around the target before scrolling                                                                                                                                                                                                                                                                     |
| `when`          | `'always'`                            | `'needed'` does not move when the target element is already fully visible below the offset                                                                                                                                                                                                                                                                        |
| `behavior`      | `'smooth'`                            | `'instant'` jumps. Reduced motion always jumps.                                                                                                                                                                                                                                                                                                                   |
| `interruptible` | `true`                                | Stop when the visitor takes over: the wheel, a touch, a key that scrolls, or a mouse press outside links and buttons                                                                                                                                                                                                                                              |
| `focus`         | `false` (`true` for `autoScrollTo`)   | Move keyboard focus to the target on arrival. Targets that cannot take focus get `tabindex="-1"`.                                                                                                                                                                                                                                                                 |
| `hash`          | `false` (`'push'` for `autoScrollTo`) | Write the target's `#id` to the URL on arrival: `'push'` adds a history entry, `'replace'` does not                                                                                                                                                                                                                                                               |
| `signal`        | none                                  | An `AbortSignal`. Aborting it stops the scroll (`reason: 'cancelled'`); an aborted signal does not start one                                                                                                                                                                                                                                                      |
| `onStart`       | none                                  | `(detail) => void`, once before the first frame, with `{ target, container, trigger, top, left }`                                                                                                                                                                                                                                                                 |
| `onProgress`    | none                                  | `(detail) => void`, on every frame, with the same plus `progress` (time) and `eased` (distance), from `0` to `1`                                                                                                                                                                                                                                                  |
| `onEnd`         | none                                  | `(result) => void`, once when it ends, with the same plus `arrived` and `reason`: `arrived`, `interrupted`, `replaced`, `cancelled` or `missing`                                                                                                                                                                                                                  |

`autoScrollTo` also takes:

| Option        | Default                            | Description                                                                                                                  |
| ------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `selector`    | `'[data-scroll-to], a[href^="#"]'` | Triggers to handle. Use `'[data-scroll-to]'` to leave plain links alone, or add `'a[href*="#"]'` for full URLs to this page. |
| `scope`       | `document`                         | Where clicks are listened to                                                                                                 |
| `initialHash` | `true`                             | With an `offset`, align the URL's `#id` once the page loads, since the browser's own jump ignores the offset                 |

## Targets

| Value                      | Scrolls to                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| An element                 | That element                                                                              |
| `'#pricing'`               | The element with that id (ids with special characters work)                               |
| A selector                 | The first match                                                                           |
| `'top'`, `'#top'` or `'#'` | The top                                                                                   |
| `'bottom'`                 | The bottom                                                                                |
| `'next'`, `'prev'`         | The next or previous of `sections` from where it is now                                   |
| A number                   | That vertical position, in pixels                                                         |
| `'+=400'`, `'-=50%'`       | Relative to where it is now; `%` of the container height                                  |
| `{ top, left }`            | A point; each axis takes a number or a relative string, and `%` on `left` is of the width |

## Attributes

Set them on a trigger. They win over the options given to `autoScrollTo`.

| Attribute                  | Value                                    | Description                                      |
| -------------------------- | ---------------------------------------- | ------------------------------------------------ |
| `data-scroll-to`           | target                                   | The target. Empty on a link: its `href` is used. |
| `data-scroll-to-offset`    | pixels, `%`, a selector, `auto` or `css` | `offset`                                         |
| `data-scroll-to-container` | selector                                 | `container`                                      |
| `data-scroll-to-block`     | `start`, `center`, `end`, `nearest`      | `block`                                          |
| `data-scroll-to-inline`    | `start`, `center`, `end`, `nearest`      | `inline`                                         |
| `data-scroll-to-duration`  | milliseconds                             | `duration`                                       |
| `data-scroll-to-speed`     | pixels per second                        | `speed`                                          |
| `data-scroll-to-easing`    | a name or `cubic-bezier(…)`              | `easing`                                         |
| `data-scroll-to-when`      | `always`, `needed`                       | `when`                                           |
| `data-scroll-to-sections`  | selector                                 | `sections`                                       |
| `data-scroll-to-focus`     | `true`, `false`                          | `focus`                                          |
| `data-scroll-to-hash`      | `push`, `replace`, `false`               | `hash`                                           |
| `data-scroll-to-reveal`    | `true`, `false`                          | `reveal`                                         |

## State and events

| Name                               | Where                                                                  | When                  |
| ---------------------------------- | ---------------------------------------------------------------------- | --------------------- |
| `data-scroll-to-state="scrolling"` | The scrolling element (`<html>` for the page) and the clicked trigger  | While the scroll runs |
| `scroll-to:start`                  | The target, or the scrolling element for positions                     | When it starts        |
| `scroll-to:end`                    | The target, or the scrolling element for positions and missing targets | When it ends, once    |

The events bubble and carry the same details as the callbacks. [Lifecycle and events](../../guides/lifecycle/) shows how to use them.

## Clicks

Clicks with a modifier key or a middle button, and clicks whose default another script already prevented, are left alone. Links to other pages and to ids that do not exist keep their normal behavior.
