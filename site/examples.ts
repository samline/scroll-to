// Copyable files are complete pages: they load the published browser bundle
// (window.ScrollTo handles links on its own) and scroll the page itself. The
// previews in examples/*.astro import the package and scroll inside a box.
const sections = (ids: string[]) =>
  ids
    .map(
      id =>
        `  <section id="${id}">\n    <h2>${id[0]!.toUpperCase()}${id.slice(1)}</h2>\n  </section>`
    )
    .join('\n')

export default [
  {
    id: 'header',
    tab: 'Fixed header',
    title: 'Anchors that land below a fixed header',
    description:
      'Same-page links scroll smoothly and stop below the header, move focus to the section and add a history entry, so Back works. The header height is read live.',
    files: {
      html: `<header id="header">
  <nav>
    <a href="#features">Features</a>
    <a href="#pricing">Pricing</a>
    <a href="#faq">FAQ</a>
  </nav>
</header>
<main>
${sections(['features', 'pricing', 'faq'])}
  <button type="button" data-scroll-to="top">Back to top</button>
</main>`,
      css: `body { margin: 0; font-family: system-ui, sans-serif; }
header { position: fixed; inset: 0 0 auto; z-index: 1; padding: 1rem 1.5rem; background: #fff; border-bottom: 1px solid #ddd; }
nav { display: flex; gap: 1rem; }
main { padding: 5rem 1.5rem 50vh; }
section { min-height: 70vh; border-top: 1px solid #ddd; }
section:focus { outline: none; }`,
      js: `// Called before the DOM is ready, this replaces the automatic start.
ScrollTo.auto({ offset: '#header' })`,
      esm: `import { autoScrollTo, scrollTo } from '@samline/scroll-to'

autoScrollTo({ offset: '#header' })`,
    },
  },
  {
    id: 'tabs',
    tab: 'Centered tabs',
    title: 'Keep the selected tab in the middle',
    description:
      'Inside a horizontal strip, data-scroll-to-container and data-scroll-to-inline="center" scroll only the strip, never the page.',
    files: {
      html: `<div class="tabs" id="tabs" role="tablist">
${Array.from({ length: 12 }, (_, i) => `  <button type="button" role="tab" id="tab-${i + 1}" aria-selected="${i === 0}">Topic ${i + 1}</button>`).join('\n')}
</div>`,
      css: `body { font-family: system-ui, sans-serif; }
.tabs { display: flex; gap: 0.5rem; max-width: 32rem; overflow-x: auto; padding: 0.5rem; border: 1px solid #ddd; }
.tabs button { flex: none; padding: 0.5rem 1rem; border: 1px solid #ccc; border-radius: 999px; background: #fff; }
.tabs [aria-selected='true'] { background: #78350f; border-color: #78350f; color: #fff; }`,
      js: `const tabs = document.querySelector('#tabs')

tabs.addEventListener('click', event => {
  const tab = event.target.closest('[role="tab"]')
  if (!tab) return
  tabs.querySelector('[aria-selected="true"]').setAttribute('aria-selected', 'false')
  tab.setAttribute('aria-selected', 'true')
  ScrollTo.scrollTo(tab, { container: tabs, inline: 'center', block: 'nearest' })
})`,
      esm: `import { autoScrollTo, scrollTo } from '@samline/scroll-to'

const tabs = document.querySelector('#tabs')

tabs.addEventListener('click', event => {
  const tab = event.target.closest('[role="tab"]')
  if (!tab) return
  tabs.querySelector('[aria-selected="true"]').setAttribute('aria-selected', 'false')
  tab.setAttribute('aria-selected', 'true')
  scrollTo(tab, { container: tabs, inline: 'center', block: 'nearest' })
})`,
    },
  },
  {
    id: 'await',
    tab: 'Wait for arrival',
    title: 'Do something once it arrives',
    description:
      'scrollTo returns a promise: true when it arrives, false when the visitor took over. Here the answer is highlighted only after the scroll ends.',
    files: {
      html: `<button type="button" id="show">Show the answer to question 4</button>
<main>
${Array.from({ length: 6 }, (_, i) => `  <article id="q${i + 1}"><h2>Question ${i + 1}</h2><p>Answer ${i + 1}.</p></article>`).join('\n')}
</main>
<p id="status" aria-live="polite"></p>`,
      css: `body { font-family: system-ui, sans-serif; }
#show { position: fixed; top: 1rem; right: 1rem; }
#status { position: fixed; bottom: 1rem; right: 1rem; margin: 0; }
article { min-height: 60vh; padding: 1rem; border-top: 1px solid #ddd; transition: background 0.6s; }
article.flash { background: #fff6c2; }`,
      js: `const status = document.querySelector('#status')

document.querySelector('#show').addEventListener('click', async () => {
  const answer = document.querySelector('#q4')
  const arrived = await ScrollTo.scrollTo(answer, { offset: 16, duration: 900 })
  status.textContent = arrived ? 'Arrived' : 'Interrupted'
  if (arrived) {
    answer.classList.add('flash')
    setTimeout(() => answer.classList.remove('flash'), 1200)
  }
})`,
      esm: `import { autoScrollTo, scrollTo } from '@samline/scroll-to'

const status = document.querySelector('#status')

document.querySelector('#show').addEventListener('click', async () => {
  const answer = document.querySelector('#q4')
  const arrived = await scrollTo(answer, { offset: 16, duration: 900 })
  status.textContent = arrived ? 'Arrived' : 'Interrupted'
  if (arrived) {
    answer.classList.add('flash')
    setTimeout(() => answer.classList.remove('flash'), 1200)
  }
})`,
    },
  },
  {
    id: 'progress',
    tab: 'Follow the scroll',
    title: 'Show progress and why it ended',
    description:
      'createScrollTo shares the duration and the callbacks: onProgress fills the bar, onEnd says why the scroll ended. Stop it with cancel(), take over with the wheel or touch, or let an AbortSignal give up after one second.',
    files: {
      html: `<div class="toolbar">
  <button type="button" id="go">Scroll to the end</button>
  <button type="button" id="stop">Stop</button>
  <button type="button" id="give-up">Give up after 1 s</button>
  <button type="button" id="back">Back to top</button>
  <output id="status" aria-live="polite">Ready</output>
  <div class="progress" aria-hidden="true"><span id="bar"></span></div>
</div>
<main>
${Array.from({ length: 8 }, (_, i) => `  <section id="part-${i + 1}"><h2>Part ${i + 1}</h2></section>`).join('\n')}
</main>`,
      css: `body { margin: 0; font-family: system-ui, sans-serif; }
.toolbar { position: fixed; inset: 0 0 auto; z-index: 1; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 0.75rem 1rem; background: #fff; border-bottom: 1px solid #ddd; }
.progress { position: absolute; inset: auto 0 0; height: 3px; }
#bar { display: block; height: 100%; background: #78350f; transform: scaleX(0); transform-origin: left; }
main { padding: 4rem 1rem 0; }
section { min-height: 80vh; border-top: 1px solid #ddd; }`,
      js: `const bar = document.querySelector('#bar')
const status = document.querySelector('#status')

// Defaults shared by every scroll below, callbacks included.
const scroller = ScrollTo.createScrollTo({
  duration: 2500,
  onStart: () => {
    status.textContent = 'Scrolling…'
  },
  onProgress: ({ eased }) => {
    bar.style.transform = \`scaleX(\${eased})\`
  },
  onEnd: ({ reason }) => {
    status.textContent = \`Ended: \${reason}\`
  },
})

document.querySelector('#go').addEventListener('click', () => scroller.to('#part-8'))
document.querySelector('#stop').addEventListener('click', () => scroller.cancel())
document
  .querySelector('#give-up')
  .addEventListener('click', () => scroller.to('#part-8', { signal: AbortSignal.timeout(1000) }))
document.querySelector('#back').addEventListener('click', () => scroller.to('top', { duration: 600 }))`,
      esm: `import { createScrollTo } from '@samline/scroll-to'

const bar = document.querySelector('#bar')
const status = document.querySelector('#status')

// Defaults shared by every scroll below, callbacks included.
const scroller = createScrollTo({
  duration: 2500,
  onStart: () => {
    status.textContent = 'Scrolling…'
  },
  onProgress: ({ eased }) => {
    bar.style.transform = \`scaleX(\${eased})\`
  },
  onEnd: ({ reason }) => {
    status.textContent = \`Ended: \${reason}\`
  },
})

document.querySelector('#go').addEventListener('click', () => scroller.to('#part-8'))
document.querySelector('#stop').addEventListener('click', () => scroller.cancel())
document
  .querySelector('#give-up')
  .addEventListener('click', () => scroller.to('#part-8', { signal: AbortSignal.timeout(1000) }))
document.querySelector('#back').addEventListener('click', () => scroller.to('top', { duration: 600 }))`,
    },
  },
  {
    id: 'events',
    tab: 'Events and state',
    title: 'React from HTML and CSS',
    description:
      'While a link scrolls, it and the page carry data-scroll-to-state="scrolling", so CSS can style them. Every scroll ends with a bubbling scroll-to:end event: one listener on the document logs where each one went and why it ended.',
    files: {
      html: `<header id="header">
  <nav>
    <a href="#intro">Intro</a>
    <a href="#plans">Plans</a>
    <a href="#contact">Contact</a>
  </nav>
  <ol id="log" aria-live="polite"></ol>
</header>
<main>
${sections(['intro', 'plans', 'contact'])}
</main>`,
      css: `body { margin: 0; font-family: system-ui, sans-serif; }
header { position: fixed; inset: 0 0 auto; z-index: 1; display: flex; justify-content: space-between; gap: 1rem; padding: 1rem 1.5rem; background: #fff; border-bottom: 1px solid #ddd; transition: border-color 0.2s; }
nav { display: flex; gap: 1rem; }
#log { margin: 0; font-size: 0.875rem; color: #555; }
main { padding: 5rem 1.5rem 50vh; }
section { min-height: 80vh; border-top: 1px solid #ddd; }
section:focus { outline: none; }
/* While a scroll runs: the page, and the link that started it. */
html[data-scroll-to-state='scrolling'] header { border-color: #78350f; }
a[data-scroll-to-state='scrolling'] { color: #78350f; text-decoration-style: wavy; }`,
      js: `ScrollTo.auto({ offset: '#header', duration: 900 })

const log = document.querySelector('#log')

document.addEventListener('scroll-to:end', event => {
  const { target, reason } = event.detail
  const item = document.createElement('li')
  item.textContent = \`\${target?.id ?? 'top'}: \${reason}\`
  log.prepend(item)
  while (log.children.length > 3) log.lastElementChild.remove()
})`,
      esm: `import { autoScrollTo } from '@samline/scroll-to'

autoScrollTo({ offset: '#header', duration: 900 })

const log = document.querySelector('#log')

document.addEventListener('scroll-to:end', event => {
  const { target, reason } = event.detail
  const item = document.createElement('li')
  item.textContent = \`\${target?.id ?? 'top'}: \${reason}\`
  log.prepend(item)
  while (log.children.length > 3) log.lastElementChild.remove()
})`,
    },
  },
  {
    id: 'stacked',
    tab: 'Stacked bars',
    title: 'Clear a header and the bar stuck below it',
    description:
      "offset: 'auto' finds every fixed and sticky bar stuck at the top and keeps space for all of them, measured on every frame. Hide the notice bar and the links land higher, with no change to the code.",
    files: {
      html: `<header id="header">
  <nav>
    <a href="#plans">Plans</a>
    <a href="#faq">FAQ</a>
    <a href="#contact">Contact</a>
  </nav>
  <button type="button" id="toggle" aria-pressed="true">Notice bar</button>
</header>
<main>
  <section id="intro"><h2>Intro</h2></section>
  <div class="notice" id="notice">Free shipping this week</div>
${sections(['plans', 'faq', 'contact'])}
</main>`,
      css: `body { margin: 0; font-family: system-ui, sans-serif; }
header { position: fixed; inset: 0 0 auto; z-index: 2; box-sizing: border-box; height: 3.5rem; display: flex; justify-content: space-between; align-items: center; padding: 0 1.5rem; background: #fff; border-bottom: 1px solid #ddd; }
nav { display: flex; gap: 1rem; }
main { padding-top: 3.5rem; padding-bottom: 50vh; }
.notice { position: sticky; top: 3.5rem; z-index: 1; padding: 0.5rem 1.5rem; background: #fff6c2; }
section { min-height: 70vh; padding: 0 1.5rem; border-top: 1px solid #ddd; }
section:focus { outline: none; }`,
      js: `ScrollTo.auto({ offset: 'auto' })

const toggle = document.querySelector('#toggle')
const notice = document.querySelector('#notice')

toggle.addEventListener('click', () => {
  notice.hidden = !notice.hidden
  toggle.setAttribute('aria-pressed', String(!notice.hidden))
})`,
      esm: `import { autoScrollTo } from '@samline/scroll-to'

autoScrollTo({ offset: 'auto' })

const toggle = document.querySelector('#toggle')
const notice = document.querySelector('#notice')

toggle.addEventListener('click', () => {
  notice.hidden = !notice.hidden
  toggle.setAttribute('aria-pressed', String(!notice.hidden))
})`,
    },
  },
  {
    id: 'pages',
    tab: 'Page a strip',
    title: 'Page through a strip, with any easing',
    description:
      "{ left: '+=100%' } moves the strip by its own width, wherever it is. speed keeps the pace steady and maxDuration caps it; pick an easing, including a CSS cubic-bezier() curve.",
    files: {
      html: `<div class="pager">
  <button type="button" id="prev">Previous</button>
  <label>Easing
    <select id="easing">
    <option value="ease-in-out">Ease in-out</option>
    <option value="ease-out-quint">Ease out quint</option>
    <option value="ease-out-back">Ease out back</option>
    <option value="cubic-bezier(0.2, 0.8, 0.2, 1)">cubic-bezier(0.2, 0.8, 0.2, 1)</option>
    <option value="linear">Linear</option>
    </select>
  </label>
  <button type="button" id="next">Next</button>
</div>
<div class="strip" id="strip">
${Array.from({ length: 12 }, (_, i) => `  <article>Card ${i + 1}</article>`).join('\n')}
</div>`,
      css: `body { font-family: system-ui, sans-serif; }
.pager { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; margin-bottom: 0.75rem; }
.strip { display: flex; gap: 1rem; max-width: 40rem; overflow-x: auto; padding: 0.5rem; border: 1px solid #ddd; }
.strip article { flex: 0 0 12rem; height: 8rem; display: grid; place-items: center; border-radius: 0.5rem; background: #f4ede6; }`,
      js: `const strip = document.querySelector('#strip')
const easing = document.querySelector('#easing')

const page = direction =>
  ScrollTo.scrollTo(
    { left: \`\${direction}=100%\` },
    { container: strip, easing: easing.value, speed: 1500, maxDuration: 900 }
  )

document.querySelector('#prev').addEventListener('click', () => page('-'))
document.querySelector('#next').addEventListener('click', () => page('+'))`,
      esm: `import { scrollTo } from '@samline/scroll-to'

const strip = document.querySelector('#strip')
const easing = document.querySelector('#easing')

const page = direction =>
  scrollTo(
    { left: \`\${direction}=100%\` },
    { container: strip, easing: easing.value, speed: 1500, maxDuration: 900 }
  )

document.querySelector('#prev').addEventListener('click', () => page('-'))
document.querySelector('#next').addEventListener('click', () => page('+'))`,
    },
  },
  {
    id: 'steps',
    tab: 'Next and previous',
    title: 'Step through sections',
    description:
      'data-scroll-to="next" and "prev" find the next or previous section below the header. Press Next several times quickly: the presses add up. data-scroll-to-focus="false" keeps focus on the button, so the keyboard can keep pressing it.',
    files: {
      html: `<header id="header">
  <button type="button" data-scroll-to="prev" data-scroll-to-focus="false">Previous chapter</button>
  <button type="button" data-scroll-to="next" data-scroll-to-focus="false">Next chapter</button>
</header>
<main class="chapters">
${Array.from({ length: 5 }, (_, i) => `  <section id="chapter-${i + 1}">\n    <h2>Chapter ${i + 1}</h2>\n  </section>`).join('\n')}
</main>`,
      css: `body { margin: 0; font-family: system-ui, sans-serif; }
header { position: fixed; inset: 0 0 auto; z-index: 1; box-sizing: border-box; height: 3.5rem; display: flex; gap: 0.5rem; align-items: center; padding: 0 1.5rem; background: #fff; border-bottom: 1px solid #ddd; }
.chapters { padding: 3.5rem 1.5rem 0; }
section { min-height: 90vh; border-top: 1px solid #ddd; }`,
      js: `ScrollTo.auto({ offset: 'auto', hash: false })`,
      esm: `import { autoScrollTo } from '@samline/scroll-to'

autoScrollTo({ offset: 'auto', hash: false })`,
    },
  },
  {
    id: 'faq',
    tab: 'Hidden answers',
    title: 'Links that open the answer first',
    description:
      'The answers sit inside closed <details> and a hidden="until-found" panel. Each link opens what hides its answer, then scrolls and moves focus there, like the browser does for fragment links. The panel gets a beforematch event, so your own state can follow.',
    files: {
      html: `<nav>
  <a href="#refunds">How do refunds work?</a>
  <a href="#shipping">When does it ship?</a>
  <a href="#warranty" data-scroll-to-hash="replace">Is there a warranty?</a>
</nav>
<main>
  <details>
    <summary>Payments</summary>
    <h3 id="refunds">Refunds</h3>
    <p>Refunds reach your card within five days.</p>
  </details>
  <details>
    <summary>Delivery</summary>
    <h3 id="shipping">Shipping</h3>
    <p>Orders ship the next working day.</p>
  </details>
  <div id="warranty-panel" hidden="until-found">
    <h3 id="warranty">Warranty</h3>
    <p>Two years, parts and labor.</p>
  </div>
</main>
<p id="log" aria-live="polite"></p>`,
      css: `body { font-family: system-ui, sans-serif; }
nav { display: flex; flex-direction: column; gap: 0.5rem; }
main { padding: 80vh 0; }
details, #warranty-panel { margin-block: 30vh; padding: 1rem; border: 1px solid #ddd; }
h3:focus { outline: 2px solid #78350f; outline-offset: 4px; }
#log { position: fixed; bottom: 1rem; right: 1rem; margin: 0; }`,
      js: `ScrollTo.auto({ offset: 16 })

const log = document.querySelector('#log')

document.querySelector('#warranty-panel').addEventListener('beforematch', () => {
  log.textContent = 'The warranty panel opened'
})`,
      esm: `import { autoScrollTo } from '@samline/scroll-to'

autoScrollTo({ offset: 16 })

const log = document.querySelector('#log')

document.querySelector('#warranty-panel').addEventListener('beforematch', () => {
  log.textContent = 'The warranty panel opened'
})`,
    },
  },
  {
    id: 'highlight',
    tab: 'Highlight',
    title: 'Show where the visitor landed',
    description:
      'Each term link scrolls to its definition and marks it with data-scroll-to-arrived for a moment, so the eye finds it even when it stops in the middle of the screen. While the scroll runs, the link fills from --scroll-to-progress. Both are plain CSS hooks, and reduced motion keeps only the color.',
    files: {
      html: `<nav>
  <a href="#cache" data-scroll-to-block="center">Cache</a>
  <a href="#latency" data-scroll-to-block="center">Latency</a>
  <a href="#throughput" data-scroll-to-block="center">Throughput</a>
</nav>
<dl>
  <dt id="cache">Cache</dt>
  <dd>A copy kept close by, so the next read is fast.</dd>
  <dt id="latency">Latency</dt>
  <dd>How long one request waits for its answer.</dd>
  <dt id="throughput">Throughput</dt>
  <dd>How many requests finish each second.</dd>
</dl>`,
      css: `body { font-family: system-ui, sans-serif; }
nav { position: fixed; top: 1rem; left: 1rem; display: flex; gap: 1rem; }
nav a {
  background: linear-gradient(#fde68a, #fde68a) no-repeat left / calc(var(--scroll-to-progress, 0) * 100%) 100%;
}
dl { padding: 100vh 1rem; }
dt { margin-top: 60vh; padding: 0.25rem 0.5rem; font-weight: 600; border-radius: 0.25rem; }
dt:focus { outline: 2px solid #78350f; outline-offset: 2px; }
dt[data-scroll-to-arrived] { background: #fde68a; }
@media (prefers-reduced-motion: no-preference) {
  dt { transition: background-color 0.6s; }
  dt[data-scroll-to-arrived] { animation: pulse 0.6s 2; }
}
@keyframes pulse { 50% { scale: 1.04; } }`,
      js: `ScrollTo.auto({ highlight: 1500, hash: false })`,
      esm: `import { autoScrollTo } from '@samline/scroll-to'

autoScrollTo({ highlight: 1500, hash: false })`,
    },
  },
  {
    id: 'back-to-top',
    tab: 'Back to top',
    title: 'A back-to-top button with a progress ring',
    description:
      'The button stays out of the way until the page is scrolled one screen down, then fades in. Its ring fills from --scroll-to-scrolled as you read. Pressing it scrolls to the top and moves focus there, so keyboard users do not stay on a button that hides. Without JavaScript it is a plain link to the top.',
    files: {
      html: `<main id="top">
  <h1>A long article</h1>
  <p>Scroll down: the button appears after one screen.</p>
</main>
<a class="back-to-top" href="#top" data-scroll-to-back-to-top aria-label="Back to top">
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2" />
  </svg>
</a>`,
      css: `body { font-family: system-ui, sans-serif; }
main { min-height: 400vh; padding: 1rem; }
.back-to-top {
  position: fixed; right: 1rem; bottom: 1rem;
  display: grid; place-items: center; width: 3rem; height: 3rem;
  border-radius: 50%; color: #78350f; background:
    radial-gradient(closest-side, #fff 85%, transparent 86%),
    conic-gradient(#78350f calc(var(--scroll-to-scrolled, 0) * 1turn), #e5e5e5 0);
}
/* Only hidden once the script says so: without JavaScript the link stays. */
.back-to-top[data-scroll-to-visible="false"] { visibility: hidden; opacity: 0; }
@media (prefers-reduced-motion: no-preference) {
  .back-to-top { transition: opacity 0.3s, visibility 0.3s; }
}`,
      js: `// The script turns [data-scroll-to-back-to-top] into a back-to-top button.
// Its value is the threshold: empty for one screen, or pixels such as "600".`,
      esm: `import { backToTop } from '@samline/scroll-to'

backToTop('.back-to-top', { target: '#top' })`,
    },
  },
  {
    id: 'nested',
    tab: 'Nested boxes',
    title: 'A card in a strip, further down the page',
    description:
      "With container: 'auto', a link scrolls every box around its target, then the page, like scrollIntoView but with the offset, easing and focus. The strip snaps, and its snapping is paused while it moves, so it does not stutter. Switch it to right to left: inline start becomes the right edge.",
    files: {
      html: `<header id="header">
  <a href="#card-2">Card 2</a>
  <a href="#card-7">Card 7</a>
  <a href="#card-11">Card 11</a>
  <button type="button" id="direction" aria-pressed="false">Right to left</button>
</header>
<main>
  <p class="intro">The shelf is further down. Its cards scroll sideways.</p>
  <section aria-labelledby="shelf-title">
    <h2 id="shelf-title">Shelf</h2>
    <div class="strip" id="strip" tabindex="0" aria-label="Cards">
      <article class="card" id="card-1">Card 1</article>
      <article class="card" id="card-2">Card 2</article>
      <article class="card" id="card-3">Card 3</article>
      <article class="card" id="card-4">Card 4</article>
      <article class="card" id="card-5">Card 5</article>
      <article class="card" id="card-6">Card 6</article>
      <article class="card" id="card-7">Card 7</article>
      <article class="card" id="card-8">Card 8</article>
      <article class="card" id="card-9">Card 9</article>
      <article class="card" id="card-10">Card 10</article>
      <article class="card" id="card-11">Card 11</article>
      <article class="card" id="card-12">Card 12</article>
    </div>
  </section>
</main>`,
      css: `body { font-family: system-ui, sans-serif; margin: 0; }
html { scroll-padding-top: 4rem; }
header { position: fixed; inset: 0 0 auto; display: flex; gap: 1rem; align-items: center; height: 3rem; padding: 0 1rem; background: #fff; border-bottom: 1px solid #ddd; }
main { padding: 4rem 1rem 60vh; }
.intro { min-height: 120vh; }
.strip { display: flex; gap: 1rem; max-width: 40rem; overflow-x: auto; padding: 1rem; scroll-snap-type: x mandatory; border: 1px solid #ddd; }
.card { flex: 0 0 12rem; height: 8rem; padding: 1rem; scroll-snap-align: start; border-radius: 0.5rem; background: #fef3c7; }
.card:focus { outline: 2px solid #78350f; outline-offset: 2px; }`,
      js: `ScrollTo.auto({ container: 'auto', offset: '#header', inline: 'start', hash: false })

const direction = document.querySelector('#direction')
const strip = document.querySelector('#strip')

direction.addEventListener('click', () => {
  const rtl = direction.getAttribute('aria-pressed') !== 'true'
  direction.setAttribute('aria-pressed', String(rtl))
  strip.dir = rtl ? 'rtl' : 'ltr'
})`,
      esm: `import { autoScrollTo } from '@samline/scroll-to'

autoScrollTo({ container: 'auto', offset: '#header', inline: 'start', hash: false })

const direction = document.querySelector('#direction')
const strip = document.querySelector('#strip')

direction.addEventListener('click', () => {
  const rtl = direction.getAttribute('aria-pressed') !== 'true'
  direction.setAttribute('aria-pressed', String(rtl))
  strip.dir = rtl ? 'rtl' : 'ltr'
})`,
    },
  },
]
