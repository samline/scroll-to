---
title: 'Accessibility and motion'
titleAccent: 'motion'
description: How @samline/scroll-to keeps focus, history and reduced motion right on every scroll, and what your page still provides.
locale: en
sidebar:
  group: guides
  order: 3
  label: Accessibility
---

## Responsibilities

Scroll To animates a jump without losing what a native jump does. Links handled by `autoScrollTo()` move keyboard focus to the target on arrival and push its `#id` to the URL, so keyboard and screen reader users continue from the section they chose and Back works. Your page provides real `#id` targets, meaningful link text and a visible focus style.

## Keyboard and focus

- Targets that cannot take focus get `tabindex="-1"`, so focus can land on a section or heading. Hide the ring on those only if your design shows another cue.
- Clicks with a modifier key, or whose default was already prevented, are left to the browser.
- `scrollTo()` from your own code does not move focus unless you pass `focus: true`. Pass it when the scroll follows a user action, such as a skip link or a "Back to top" button.

## Motion and state

- With `prefers-reduced-motion: reduce` every scroll jumps at once. The promise still resolves to `true`, and focus and the hash still change.
- Any wheel, touch, key press or mouse press stops a scroll in progress, so visitors never fight the animation.
- Keep `duration` short; long glides are disorienting on large pages.

## Layout and contrast

Fixed headers must not cover the target: pass the header as `offset`, so the section and its focus ring land below it. See [Layouts and focus](../layouts/) for skip links and headers.
