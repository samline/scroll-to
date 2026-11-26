---
title: 'Framework integrations'
titleAccent: 'integrations'
description: Use @samline/scroll-to in React, Vue, Svelte, Astro, Shopify and WordPress, and alongside client-side routers that handle hashes themselves.
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

## Shopify

Load the pinned classic script once from theme assets. Copy the `dist/browser/scroll-to.global.js` to `assets/scroll-to.global.js` from the matching published release (`@samline/scroll-to@1.6.0`), then include it once in `layout/theme.liquid` before `</body>`:

```liquid
{{ 'scroll-to.global.js' | asset_url | script_tag }}
```

Mark up any section with the `data-scroll-to*` attributes; the script defines `window.ScrollTo`. A deferred `<script src="{{ 'scroll-to.global.js' | asset_url }}" defer></script>` works the same.

```liquid
<a href="#returns">Returns policy</a>
<h2 id="returns">Returns</h2>
```

The script starts its click handling on load, and the listener sits on `document`, so links inside a section the theme editor adds or removes work without `shopify:section:load` or `shopify:section:unload` handlers. Back-to-top buttons (`data-scroll-to-back-to-top`) are collected when `ScrollTo.auto()` runs; after a section adds one, call `ScrollTo.auto(options)` again, which destroys the previous run first. See [Shopify's section events](https://shopify.dev/docs/storefronts/themes/best-practices/editor/integrate-sections-and-blocks).

## WordPress

Enqueue the pinned script from your theme or plugin, copied from the matching published release (`@samline/scroll-to@1.6.0`), in the `wp_enqueue_scripts` hook. The `strategy` argument needs WordPress 6.3 or later.

```php
add_action('wp_enqueue_scripts', function () {
  wp_enqueue_script('scroll-to', plugins_url('assets/scroll-to.global.js', __FILE__), [], '1.6.0', [
    'in_footer' => true,
    'strategy' => 'defer',
  ]);
});
```

The script handles clicks on `[data-scroll-to]` and same-page `#id` links on load, so the markup can live in a block, a template or a shortcode output. To use your own options, add `data-manual` to the script tag and call `ScrollTo.auto(options)`. See [wp_enqueue_script](https://developer.wordpress.org/reference/functions/wp_enqueue_script/).

## Client-side routers

Routers that handle `#hash` links themselves (for example in React Router or Vue Router scroll behavior) call `preventDefault()` first; scroll-to then leaves those clicks alone. To use it from the router instead, call `scrollTo(location.hash, { offset })` in the router's scroll hook, or limit `autoScrollTo` with `selector: '[data-scroll-to]'`.
