import { isBrowser } from '@samline/internal'

import type {
  ScrollEndReason,
  ScrollResult,
  ScrollTarget,
  ScrollToOptions,
} from '../core/scroll-to.js'
import { scrollTo } from '../vanilla/scroll-to.js'

/** One stop of a sequence: a target, with its own options and pause. */
export interface SequenceStep extends ScrollToOptions {
  target: ScrollTarget
  /** How long to stay on this step while playing, in milliseconds. */
  pause?: number
}

export interface ScrollSequenceOptions extends ScrollToOptions {
  /** How long each step stays while playing, in milliseconds. Defaults to `2000`. */
  pause?: number
  /** Start again from the first step after the last one. Defaults to `false`. */
  loop?: boolean
  /** Start playing at once. Defaults to `false`. */
  autoplay?: boolean
  /** Called when the step or the playing state changes. */
  onChange?: (state: SequenceState) => void
}

/** Where a sequence is: passed to `onChange`. */
export interface SequenceState {
  /** The current step, or `-1` before the first one. */
  index: number
  /** Whether it moves on by itself. */
  playing: boolean
  /** The current step, or `null` before the first one. */
  step: SequenceStep | null
}

export interface ScrollSequence {
  /** Move on by itself, from the next step, waiting `pause` on each. */
  play: () => void
  /** Stop moving on. A scroll on its way still arrives. */
  pause: () => void
  /** `play()` or `pause()`. */
  toggle: () => void
  /** Scroll to the next step. Resolves to `true` when it arrives. */
  next: () => Promise<boolean>
  /** Scroll to the previous step. */
  prev: () => Promise<boolean>
  /** Scroll to the step at `index`. */
  goTo: (index: number) => Promise<boolean>
  /** The current step, or `-1` before the first one. */
  readonly index: number
  /** Whether it is playing. */
  readonly playing: boolean
  /** The number of steps. */
  readonly length: number
  /** Stop playing and stop its scroll. Later calls do nothing. */
  destroy: () => void
}

/**
 * A guided tour through `steps`: targets or `{ target, pause, ...options }`.
 * Play it, pause it or step through it by hand. While playing, each step
 * waits `pause` milliseconds before the next. When the visitor takes over the
 * scroll, or another scroll replaces it, it pauses.
 */
export const scrollSequence = (
  steps: ReadonlyArray<ScrollTarget | SequenceStep>,
  {
    pause: wait = 2000,
    loop = false,
    autoplay = false,
    onChange,
    ...options
  }: ScrollSequenceOptions = {}
): ScrollSequence => {
  const list: SequenceStep[] = steps.map(step =>
    typeof step === 'object' && step !== null && 'target' in step
      ? (step as SequenceStep)
      : { target: step as ScrollTarget }
  )
  const owner = isBrowser() ? new AbortController() : null
  let index = -1
  let playing = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let turn = 0

  const alive = () => !!owner && !owner.signal.aborted
  const notify = () => onChange?.({ index, playing, step: list[index] ?? null })
  const setPlaying = (value: boolean) => {
    clearTimeout(timer)
    if (playing === value) return
    playing = value
    notify()
  }

  /** The step after `from`, wrapping with `loop`; `-1` past the end. */
  const after = (from: number) => (from + 1 < list.length ? from + 1 : loop ? 0 : -1)

  const go = async (target: number): Promise<boolean> => {
    if (!alive() || !list.length) return false
    clearTimeout(timer)
    const mine = ++turn
    index = Math.max(0, Math.min(list.length - 1, target))
    notify()
    const { target: where, pause, ...own } = list[index]!
    let reason = 'arrived' as ScrollEndReason
    const onEnd = own.onEnd ?? options.onEnd
    const arrived = await scrollTo(where, {
      ...options,
      ...own,
      signal: owner!.signal,
      onEnd: (result: ScrollResult) => {
        reason = result.reason
        onEnd?.(result)
      },
    })
    // A newer step, a pause or destroy() took over meanwhile.
    if (mine !== turn || !alive()) return arrived
    if (reason === 'interrupted' || reason === 'replaced') setPlaying(false)
    if (!playing) return arrived
    const upcoming = after(index)
    if (upcoming < 0) setPlaying(false)
    else timer = setTimeout(() => void go(upcoming), pause ?? wait)
    return arrived
  }

  const play = () => {
    if (!alive() || playing || !list.length) return
    playing = true
    notify()
    // From the start when it has not begun or has finished.
    void go(index < 0 || after(index) < 0 ? 0 : after(index))
  }
  const stop = () => setPlaying(false)

  if (autoplay) play()

  return {
    play,
    pause: stop,
    toggle: () => (playing ? stop() : play()),
    next: () => {
      const upcoming = after(index)
      return upcoming < 0 ? Promise.resolve(false) : go(upcoming)
    },
    prev: () => {
      const previous = index > 0 ? index - 1 : loop ? list.length - 1 : -1
      return previous < 0 ? Promise.resolve(false) : go(previous)
    },
    goTo: target => go(target),
    get index() {
      return index
    },
    get playing() {
      return playing
    },
    get length() {
      return list.length
    },
    destroy: () => {
      if (!alive()) return
      clearTimeout(timer)
      playing = false
      turn++
      owner!.abort()
    },
  }
}
