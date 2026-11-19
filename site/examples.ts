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
      'createScrollTo shares the duration and the callbacks: onProgress fills the bar, onEnd says why the scroll ended. Use the wheel or touch while it moves to interrupt it, or let an AbortSignal give up after one second.',
    files: {
      html: `<div class="toolbar">
  <button type="button" id="go">Scroll to the end</button>
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
]
