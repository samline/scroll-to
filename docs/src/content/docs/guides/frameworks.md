---
title: 'Framework integrations'
titleAccent: 'integrations'
description: Use @samline/scroll-to in React, Vue, Svelte and Astro, and alongside client-side routers that handle hashes themselves.
locale: en
sidebar:
  group: guides
  order: 6
---

`scrollTo` is a plain function that returns a promise, so it works anywhere. `autoScrollTo` and `createScrollTo` return `{ destroy }` for your unmount hook, and a `signal` stops a scroll when the component goes away.

## React

```jsx
import { scrollTo } from '@samline/scroll-to'

export function BackToTop() {
  return (
    <button type="button" onClick={() => scrollTo('top')}>
      Back to top
    </button>
  )
}
```

```jsx
import { autoScrollTo } from '@samline/scroll-to'
import { useEffect } from 'react'

export function SmoothAnchors() {
  useEffect(() => autoScrollTo({ offset: '#header' }).destroy, [])
  return null
}
```

Stop a scroll that is still running when the component unmounts, so its callbacks never touch a removed element:

```jsx
import { scrollTo } from '@samline/scroll-to'
import { useEffect } from 'react'

export function ScrollToResults({ query }) {
  useEffect(() => {
    const controller = new AbortController()
    scrollTo('#results', { signal: controller.signal })
    return () => controller.abort()
  }, [query])
  return null
}
```

Share options across a component tree with one `createScrollTo` instance:

```jsx
import { createScrollTo } from '@samline/scroll-to'
import { useEffect } from 'react'

export const scroller = createScrollTo({ offset: '#header', duration: 600 })

export function SmoothAnchors() {
  useEffect(() => scroller.auto().destroy, [])
  return null
}
```

## Vue

```vue
<script setup>
import { autoScrollTo } from '@samline/scroll-to'
import { onBeforeUnmount, onMounted } from 'vue'

let controller
onMounted(() => (controller = autoScrollTo({ offset: '#header' })))
onBeforeUnmount(() => controller?.destroy())
</script>
```

## Svelte

```svelte
<script>
  import { autoScrollTo } from '@samline/scroll-to'
  import { onMount } from 'svelte'

  onMount(() => autoScrollTo({ offset: '#header' }).destroy)
</script>
```

## Astro

```astro
<script>
  import { autoScrollTo } from '@samline/scroll-to'

  autoScrollTo({ offset: '#header' })
</script>
```

The listener sits on `document`, so it keeps working across Astro view transitions, swup, Turbo or htmx page swaps without starting it again.

## Client-side routers

Routers that handle `#hash` links themselves (for example in React Router or Vue Router scroll behavior) call `preventDefault()` first; scroll-to then leaves those clicks alone. To use it from the router instead, call `scrollTo(location.hash, { offset })` in the router's scroll hook, or limit `autoScrollTo` with `selector: '[data-scroll-to]'`.
