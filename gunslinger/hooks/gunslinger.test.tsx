import { expect, mock, test } from 'claude-code/testing'

import { CARD_TICKS, DEALT, FIRE, frame, IDLE_GAP, WAKE_TICKS, wakeAt } from './scene'

const TICK_MS = 66
const FLASH = 0xfff3b0 // The muzzle flash's core.
const GLOW = 0x9dff8a // A slow mutant's eyes.
const SKULL = 0xf2ede0
const ALERT = 0xff6040

const BAND = {
  plugin: 'gunslinger',
  component: 'AbovePrompt',
  requestId: 'band',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const MILLION = { tokens: 312000, window: 1000000, compactAt: 1000000 }
const SUMMARY = [{ role: 'user', text: 'The story so far.', toolUses: [] }] as const
const COMPACT = { trigger: 'auto', messages: SUMMARY } as const // The event as the engine raises it.

function hookEngine(on: Parameters<Parameters<typeof test>[1]>[1], settings = {}) {
  const blits: string[] = []

  on('turn.start', () => ({ turnId: 't' }))
  on('turn.complete', () => ({ text: '' }))
  on('settings.read', () => ({ value: settings }))
  on('ui.blit', (_, e) => {
    blits.push(e.cells ?? '')

    return { value: {} }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  return blits
}

const decode = (cells: string) => new Uint32Array(Uint8Array.fromBase64(cells).buffer)

// The letters a frame carries in their own cells, in reading order.
const letters = (cells: string) => String.fromCharCode(...decode(cells).filter((c, i) => i % 3 === 0 && c < 0x80))

// How many pixels or letters in a frame are this colour.
const count = (cells: string, color: number) => decode(cells).filter((c, i) => i % 3 !== 0 && c === color).length

// The column where the token count over Roland starts.
function labelColumn(cells: string, columns: number) {
  const codes = decode(cells).filter((_, i) => i % 3 === 0)

  return codes.findIndex((c, i) => i >= columns && c < 0x80) % columns
}

function sessionEngine(on: Parameters<Parameters<typeof test>[1]>[1]) {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'gunslinger' } }))
  on('store.get', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
}

test('Roland carries the token count, the man in black the window', () => {
  const near = frame(80, 9, 0, false, { ...MILLION, tokens: 50000 })
  const far = frame(80, 9, 0, false, { ...MILLION, tokens: 900000 })

  expect(letters(frame(80, 9, 0, false, MILLION))).toBe('MAN IN BLACK 1M312k')
  expect(letters(frame(80, 9, 0, false))).toBe('MAN IN BLACK')
  expect(labelColumn(near, 80)).toBeLessThan(labelColumn(far, 80))
})

test('the golgotha marks compaction only when it falls short of the window', () => {
  expect(count(frame(80, 9, 0, false, MILLION), SKULL)).toBe(0)
  expect(count(frame(80, 9, 0, false, { ...MILLION, compactAt: 950000 }), SKULL)).toBeGreaterThan(0)
})

test('the signs go red only near compaction', () => {
  expect(count(frame(80, 9, 0, false, { ...MILLION, tokens: 500000 }), ALERT)).toBe(0)
  expect(count(frame(80, 9, 0, false, { ...MILLION, tokens: 850000 }), ALERT)).toBeGreaterThan(0)
})

test('a draw fires once, a slow mutant only for an error', () => {
  const at = (phase: number, kind: 'error' | 'idle') => frame(80, 9, 100 + phase, true, MILLION, { at: 100, kind })

  expect(count(at(FIRE, 'idle'), FLASH)).toBeGreaterThan(0)
  expect(count(at(FIRE + 6, 'idle'), FLASH)).toBe(0)
  expect(count(at(0, 'error'), GLOW)).toBeGreaterThan(0)
  expect(count(at(0, 'idle'), GLOW)).toBe(0)
  expect(count(frame(80, 9, 104, true, MILLION), FLASH)).toBe(0)
})

test('the palaver deals the five cards in order at night, then dawn comes up on bones', () => {
  const SUN = 0xfffdf2
  const cardAt = (n: number) => letters(frame(80, 9, 10 + n * CARD_TICKS + DEALT, true, MILLION, undefined, { at: 10 }))
  const wake = (since: number) => frame(80, 9, 500 + since, true, MILLION, undefined, { at: 10, doneAt: 500 })

  expect([0, 1, 2, 3, 4, 9].map(cardAt)).toEqual(
    ['THE SAILOR', 'THE PRISONER', 'THE LADY OF SHADOWS', 'DEATH', 'THE TOWER', 'THE TOWER'].map(
      name => `MAN IN BLACK 1M${name}`,
    ),
  )
  expect(letters(frame(80, 9, 10 + DEALT - 1, true, MILLION, undefined, { at: 10 }))).toBe('MAN IN BLACK 1M')
  expect(count(frame(80, 9, 20, true, MILLION, undefined, { at: 10 }), SUN)).toBe(0)
  expect(letters(wake(0))).toBe('MAN IN BLACK 1MTEN YEARS LATER')
  expect(count(wake(0), SKULL)).toBeGreaterThan(0) // His bones, where he sat.
  expect(count(wake(WAKE_TICKS - 1), SUN)).toBeGreaterThan(0)
  expect(letters(wake(WAKE_TICKS))).toBe('MAN IN BLACK 1M312k')
})

test('each card flies face down from his hand, turns, and lands face up in the spread', () => {
  const CARD_BACK = 0xc8302c // The red of the backs; the Sailor's face has none.
  const at = (s: number) => frame(80, 9, 10 + s, true, MILLION, undefined, { at: 10 })
  const backAt = (s: number) => {
    const codes = decode(at(s))
    const columns = new Set<number>()
    codes.forEach((c, i) => i % 3 !== 0 && c === CARD_BACK && columns.add(Math.floor(i / 3) % 80))
    return Math.min(...columns)
  }

  expect(count(at(1), CARD_BACK)).toBeGreaterThan(0)
  expect(backAt(6)).toBeLessThan(backAt(1)) // The Sailor goes left, away from his hand.
  expect(count(at(DEALT), CARD_BACK)).toBe(0)
})

test('a compaction that finishes early deals the rest quickly, and the Tower still closes the reading', () => {
  const palaver = { at: 0, doneAt: 5 }
  const ends = wakeAt(palaver) ?? Infinity
  const label = (t: number) => letters(frame(80, 9, t, true, MILLION, undefined, palaver))
  const seen = Array.from({ length: ends }, (_, t) => label(t).slice('MAN IN BLACK 1M'.length)).filter(
    (name, t, all) => name !== '' && name !== all[t - 1],
  )

  expect(seen).toEqual(['THE SAILOR', 'THE PRISONER', 'THE LADY OF SHADOWS', 'DEATH', 'THE TOWER'])
  expect(ends).toBeLessThan(2 * CARD_TICKS) // Not the three seconds a card each it takes while the summary runs.
  expect(label(ends)).toBe('MAN IN BLACK 1MTEN YEARS LATER')
})

test('a frame packs one glyph and two colours per cell', () => {
  const bytes = Uint8Array.fromBase64(frame(40, 7, 3, true))

  expect(bytes.length).toBe(40 * 7 * 12)
  expect(new Uint32Array(bytes.buffer)[0]).toBe(0x2580) // The sign sits at the right; row 0 starts with sky.
})

test('the scene moves from tick to tick and rests when parked', () => {
  expect(frame(80, 9, 1, true)).not.toBe(frame(80, 9, 2, true))
  expect(frame(80, 9, 5, false)).toBe(frame(80, 9, 5, false))
})

test('the band reads the context window and the compaction point', async ($, on) => {
  hookEngine(on)
  sessionEngine(on)
  on('session.usage', () => ({
    value: { context: { tokens: 84000, window: 1000000, percent: 8, breakdown: { autoCompactThreshold: 950000 } } },
  }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const cells = (await ui.find({ type: 'Raster' }))?.props.cells as string

  expect(letters(cells)).toBe('MAN IN BLACK 1M84k')
  expect(count(cells, SKULL)).toBeGreaterThan(0)
  await ui.unmount()
})

test('the band still draws when usage cannot be read', async ($, on) => {
  hookEngine(on)
  sessionEngine(on)
  on('session.usage', () => {
    throw new Error('no reading')
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(letters((await ui.find({ type: 'Raster' }))?.props.cells as string)).toBe('MAN IN BLACK')
  await ui.unmount()
})

test('the band keeps what the engine draws and adds the scene on the terminal', async ($, on) => {
  hookEngine(on)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  expect((await ui.find({ type: 'Raster' }))?.type).toBe('Raster')
  await ui.unmount()
})

test('the band stands aside for a survey, a small window and other surfaces', async ($, on) => {
  hookEngine(on)

  for (const target of [
    { ...BAND, surface: 'terminal', props: { ...BAND.props, hasSurvey: true } },
    { ...BAND, surface: 'terminal', props: { ...BAND.props, maxRows: 6 } },
    { ...BAND, surface: 'terminal', props: { ...BAND.props, bodyColumns: 39 } },
    { ...BAND, surface: 'desktop' },
  ] as const) {
    const ui = await $.ui.mount(target)

    expect(await ui.find({ type: 'Raster' })).toBeUndefined()
    await ui.unmount()
  }
})

test('Roland walks for a turn and stops with it', async ($, on) => {
  const clock = mock.clock(on)
  const blits = hookEngine(on)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await clock.advance(1000)
  expect(blits.length).toBe(0)

  await $.turn.start({ turnId: 't' })
  await clock.advance(660)
  const running = blits.length
  expect(running).toBeGreaterThan(0)

  await $.turn.complete({ reason: 'aborted', text: '' })
  await clock.advance(1000)
  expect(blits.length).toBe(running)
  await ui.unmount()
})

test('a tool error brings a slow mutant, and Roland draws on it', async ($, on) => {
  const clock = mock.clock(on)
  const blits = hookEngine(on)
  on('tool.call', () => ({ result: { stdout: '', stderr: 'boom', interrupted: false }, text: 'boom', isError: true }))
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await $.turn.start({ turnId: 't' })
  await clock.advance(TICK_MS * 3)
  expect(blits.some(cells => count(cells, GLOW) > 0)).toBe(false)

  const result = await $.tool.call({ tool: 'Bash', command: 'false' })
  expect(result.isError).toBe(true) // The error still reaches the model untouched.
  await clock.advance(TICK_MS * (FIRE + 2))

  expect(blits.some(cells => count(cells, GLOW) > 0)).toBe(true)
  expect(blits.some(cells => count(cells, FLASH) > 0)).toBe(true)
  await $.turn.complete({ reason: 'aborted', text: '' })
  await ui.unmount()
})

test('a long turn brings an idle draw every so often', async ($, on) => {
  const clock = mock.clock(on)
  const blits = hookEngine(on)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await $.turn.start({ turnId: 't' })
  await clock.advance(TICK_MS * (IDLE_GAP - 1))
  expect(blits.some(cells => count(cells, FLASH) > 0)).toBe(false)

  await clock.advance(TICK_MS * (FIRE + 2))
  expect(blits.some(cells => count(cells, FLASH) > 0)).toBe(true)
  expect(blits.some(cells => count(cells, GLOW) > 0)).toBe(false)
  await $.turn.complete({ reason: 'aborted', text: '' })
  await ui.unmount()
})

test('a compaction between turns holds palaver at the golgotha, then dawn, then the clock stops', async ($, on) => {
  const clock = mock.clock(on)
  const blits = hookEngine(on)
  let finish = (_: { messages: typeof SUMMARY }) => {}
  on('session.compact', () => new Promise(resolve => (finish = resolve)))
  on('ui.invalidate', () => ({ value: undefined }))
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const last = () => letters(blits.at(-1) ?? '')

  const compacting = $.session.compact(COMPACT)
  await clock.advance(TICK_MS * (DEALT + 2))
  expect(last()).toContain('THE SAILOR')
  await clock.advance(TICK_MS * CARD_TICKS * 5)
  expect(last()).toContain('THE TOWER')

  finish({ messages: SUMMARY })
  expect((await compacting).messages).toEqual(SUMMARY) // The compaction comes through untouched.
  await clock.advance(TICK_MS * 2)
  expect(last()).toContain('TEN YEARS LATER')

  await clock.advance(TICK_MS * WAKE_TICKS)
  expect(last()).not.toContain('YEARS')
  const settled = blits.length
  await clock.advance(1000)
  expect(blits.length).toBe(settled)
  await ui.unmount()
})

test('a skipped compaction ends the palaver without the long night', async ($, on) => {
  const clock = mock.clock(on)
  const blits = hookEngine(on)
  on('session.compact', () => ({ skip: 'not now' }))
  on('ui.invalidate', () => ({ value: undefined }))
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect((await $.session.compact(COMPACT)).skip).toBe('not now')
  await clock.advance(1000)

  expect(blits.some(cells => letters(cells).includes('YEARS'))).toBe(false)
  expect(letters((await ui.find({ type: 'Raster' }))?.props.cells as string)).toBe('MAN IN BLACK')
  await ui.unmount()
})

test('a precompute or a subagent compaction leaves Roland on the trail', async ($, on) => {
  const clock = mock.clock(on)
  const blits = hookEngine(on)
  let finish = (_: { messages: typeof SUMMARY }) => {}
  on('session.compact', () => new Promise(resolve => (finish = resolve)))
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  for (const e of [{ ...COMPACT, trigger: 'precompute' }, { ...COMPACT, agentId: 'a1' }] as const) {
    const compacting = $.session.compact(e)
    await clock.advance(1000)
    finish({ messages: SUMMARY })
    await compacting
  }

  expect(blits.length).toBe(0)
  await ui.unmount()
})

test('/gunslinger hides him, remembers it, and brings him back', async ($, on) => {
  hookEngine(on)
  const store = new Map<string, unknown>()
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'gunslinger' } }))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)

    return { value: undefined }
  })
  on('ui.invalidate', () => ({ value: undefined }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const hidden = await $.command.run({ command: 'gunslinger', args: '' })
  expect(hidden.text).toContain('makes camp')
  expect(store.get('isHidden')).toBe(true)
  let ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await ui.unmount()

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await ui.unmount()

  const shown = await $.command.run({ command: 'gunslinger', args: '' })
  expect(shown.text).toContain('the gunslinger followed')
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Raster' }))?.type).toBe('Raster')
  await ui.unmount()
})

test('reduced motion holds the scene still', async ($, on) => {
  const clock = mock.clock(on)
  const blits = hookEngine(on, { prefersReducedMotion: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await $.turn.start({ turnId: 't' })
  await clock.advance(1000)

  expect(blits.length).toBe(0)
  await ui.unmount()
})
