import { expect, mock, test } from 'claude-code/testing'

import { CARD_TICKS, daylight, DEALT, FIRE, FLARE_TICKS, foesFor, frame, IDLE_GAP, shotEnds, VOLLEY, WAKE_TICKS, wakeAt } from './scene'
import { VERBS, VERSE } from './voice'

const TICK_MS = 66
const at = (hour: number, minute = 0) => new Date(2026, 5, 1, hour, minute).getTime() // Local time, whatever the machine's zone.
const NOON = at(12)
const MIDNIGHT = at(23)
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

    return <Text>{e.component === 'Spinner' ? (e.props.message ?? e.props.word) : 'engine'}</Text>
  })

  return blits
}

const SPINNER = {
  plugin: 'gunslinger',
  component: 'Spinner',
  requestId: 'main',
  props: { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' },
} as const

const spoken = async (ui: { find: (q: { type: 'Text' }) => Promise<{ text?: string } | undefined> }) =>
  (await ui.find({ type: 'Text' }))?.text

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
  const clock = mock.clock(on, { now: NOON })
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
  const clock = mock.clock(on, { now: NOON })
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
  const clock = mock.clock(on, { now: NOON })
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
  const clock = mock.clock(on, { now: NOON })
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
  const clock = mock.clock(on, { now: NOON })
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

test('a compaction the API refuses runs once, reaches the API untouched, and fails as it would without him', async ($, on) => {
  const clock = mock.clock(on, { now: NOON })
  const blits = hookEngine(on)
  const sent: unknown[] = []
  on('session.compact', (_, e) => {
    sent.push(e)
    return Promise.reject(new Error('API Error: flagged'))
  })
  on('ui.invalidate', () => ({ value: undefined }))
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const asked = { ...COMPACT, instructions: 'keep the stuff so far' }

  const failure = await $.session.compact(asked).then(
    () => undefined,
    (error: unknown) => error,
  )
  await clock.advance(1000)

  expect(failure).toBeInstanceOf(Error) // The kit words it its own way; the point is it still fails.
  expect(sent).toEqual([asked]) // One request, word for word what was asked: the mod adds nothing to it.
  expect(blits.some(cells => letters(cells).includes('YEARS'))).toBe(false)
  const settled = blits.length
  await clock.advance(1000)
  expect(blits.length).toBe(settled) // Back on the trail, clock stopped.
  await ui.unmount()
})

test('a precompute or a subagent compaction leaves Roland on the trail', async ($, on) => {
  const clock = mock.clock(on, { now: NOON })
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

test('the spinner speaks for Roland only while his band shows, and leaves the engine its messages', async ($, on) => {
  hookEngine(on)
  sessionEngine(on)
  on('store.set', () => ({ value: undefined }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const spinner = await $.ui.mount({ ...SPINNER, surface: 'terminal' })
  expect(await spoken(spinner)).toBe('Sauteing') // No band drawn yet: the engine's own word.

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await spinner.redraw()
  const said = await spoken(spinner)
  expect(VERBS).toContain(said)
  await spinner.redraw()
  expect(await spoken(spinner)).toBe(said) // The same word holds the same verb.

  await spinner.redraw({ ...SPINNER.props, message: 'Retrying in 5s' })
  expect(await spoken(spinner)).toBe('Retrying in 5s')

  const desktop = await $.ui.mount({ ...SPINNER, surface: 'desktop', props: { ...SPINNER.props, word: 'Creating notes.md' } })
  expect(await spoken(desktop)).toBe('Creating notes.md')

  await $.command.run({ command: 'gunslinger', args: '' })
  await spinner.redraw(SPINNER.props)
  expect(await spoken(spinner)).toBe('Sauteing') // Parked: the Blaine set comes back.

  await desktop.unmount()
  await band.unmount()
  await spinner.unmount()
})

test('at the golgotha the spinner speaks the verse a line a card, then goes back to the trail', async ($, on) => {
  const clock = mock.clock(on, { now: NOON })
  hookEngine(on)
  let finish = (_: { messages: typeof SUMMARY }) => {}
  on('session.compact', () => new Promise(resolve => (finish = resolve)))
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const spinner = await $.ui.mount({ ...SPINNER, surface: 'terminal', props: { ...SPINNER.props, message: 'Compacting conversation' } })

  const compacting = $.session.compact(COMPACT)
  await clock.advance(TICK_MS)
  expect(await spoken(spinner)).toBe(VERSE[0])
  await clock.advance(TICK_MS * CARD_TICKS)
  expect(await spoken(spinner)).toBe(VERSE[1])
  await clock.advance(TICK_MS * CARD_TICKS * 3)
  expect(await spoken(spinner)).toBe(VERSE[2]) // Holds while the summary is still being written.

  finish({ messages: SUMMARY })
  await compacting
  expect(await spoken(spinner)).toBe(VERSE[3])

  await clock.advance(TICK_MS * (CARD_TICKS * 5 + WAKE_TICKS))
  expect(await spoken(spinner)).toBe('Compacting conversation') // Palaver over: messages pass untouched again.

  await spinner.unmount()
  await band.unmount()
})

test('reduced motion holds the scene still', async ($, on) => {
  const clock = mock.clock(on, { now: NOON })
  const blits = hookEngine(on, { prefersReducedMotion: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await $.turn.start({ turnId: 't' })
  await clock.advance(1000)

  expect(blits.length).toBe(0)
  await ui.unmount()
})

// Colours a frame is counted by.
const SUN = 0xfffdf2
const MOON = 0xe8ecf8
const MAN_IN_BLACK = 0x15121c
const LOBSTROSITY = 0xc4552b
const FIRE_COLORS = [0xff7a1a, 0xffd84a, 0x4a3220, 0x6a645a] // Flame, flame tip, log, ash.
const sum = (cells: string, colors: number[]) => colors.reduce((n, color) => n + count(cells, color), 0)
const brightness = (cells: string) =>
  decode(cells).reduce((n, c, i) => (i % 3 === 2 ? n + (c >> 16) + ((c >> 8) & 255) + (c & 255) : n), 0)

test('the sky follows the local clock: day, an hour of dusk, night, an hour of dawn', () => {
  const sky = (hour: number) => frame(80, 9, 4, true, MILLION, undefined, undefined, { hour })

  expect([5, 5.5, 6, 13, 20, 20.5, 21, 23].map(daylight).map(light => Math.round(light * 100))).toEqual([22, 61, 100, 100, 100, 61, 22, 22])
  expect(count(sky(13), SUN)).toBeGreaterThan(0)
  expect(count(sky(23), SUN)).toBe(0)
  expect(count(sky(23), MOON)).toBeGreaterThan(0)
  expect(brightness(sky(20.2))).toBeLessThan(brightness(sky(19)))
  expect(brightness(sky(20.8))).toBeLessThan(brightness(sky(20.2)))
  expect(brightness(sky(5.7))).toBeGreaterThan(brightness(sky(5.2)))
  expect(frame(80, 9, 4, true, MILLION)).toBe(sky(13)) // No clock reading is a day.
})

test('at night he camps alone by his fire, and the man in black has only a fire far off', () => {
  const night = (hour: number, t = 4) => frame(80, 9, t, true, MILLION, undefined, undefined, { hour })

  expect(count(night(13), MAN_IN_BLACK)).toBeGreaterThan(0)
  expect(count(night(23), MAN_IN_BLACK)).toBe(0)
  expect(sum(night(13), FIRE_COLORS)).toBe(0)
  expect(sum(night(23), FIRE_COLORS)).toBeGreaterThan(0)
  expect(night(23)).toBe(night(22.5)) // The same camp, the ground not passing.
  expect(night(23, 4)).not.toBe(night(23, 6)) // The flames move.
  expect(letters(night(23))).toBe('MAN IN BLACK 1M312k')
})

test('his fire is the 5 hour limit: big when fresh, down to embers when it is spent', () => {
  const fire = (limit?: number) => sum(frame(80, 9, 4, true, MILLION, undefined, undefined, { hour: 23, limit }), FIRE_COLORS)

  expect(fire(10)).toBeGreaterThan(fire(50))
  expect(fire(50)).toBeGreaterThan(fire(75))
  expect(fire(75)).toBeGreaterThan(fire(95))
  expect(fire(95)).toBeGreaterThan(sum(frame(80, 9, 4, true, MILLION, undefined, undefined, { hour: 13 }), FIRE_COLORS)) // Embers still glow.
  expect(fire(undefined)).toBe(fire(50)) // No limit to read: an ordinary fire.
})

test('the cost and the limit are written on the left, red once the limit is nearly gone', () => {
  const top = (world: object) => frame(80, 9, 4, true, MILLION, undefined, undefined, world)

  expect(letters(top({ cost: 2.4, limit: 12.4 })).startsWith('$2.40 5H 12%')).toBe(true)
  expect(letters(top({ cost: 1234.5 })).startsWith('$1235')).toBe(true)
  expect(letters(top({ limit: 5 })).startsWith('5H 5%')).toBe(true)
  expect(count(top({ limit: 50 }), ALERT)).toBe(0)
  expect(count(top({ limit: 85 }), ALERT)).toBeGreaterThan(0)
  expect(letters(frame(40, 9, 4, true, MILLION, undefined, undefined, { cost: 12.5, limit: 85 }))).toBe('$12.50 5H 85%MAN IN BLACK 1M312k')
  expect(letters(frame(40, 9, 4, true, MILLION, undefined, undefined, { cost: 1e15, limit: 100 }))).toBe('MAN IN BLACK 1M312k') // No room: the sign wins.
})

test('at night a tool error brings a lobstrosity out of the dark, and the harder the limit is pressed the more come', () => {
  const crawl = (foes: number, phase: number, kind: 'error' | 'idle' = 'error') =>
    frame(80, 9, 100 + phase, true, MILLION, { at: 100, kind, foes }, undefined, { hour: 23 })

  expect([0, 49, 50, 79, 80, 100].map(foesFor)).toEqual([1, 1, 2, 2, 3, 3])
  expect(foesFor(undefined)).toBe(1)
  expect(count(crawl(1, 1), LOBSTROSITY)).toBeGreaterThan(0)
  expect(count(crawl(3, 1), LOBSTROSITY)).toBeGreaterThan(count(crawl(2, 1), LOBSTROSITY))
  expect(count(crawl(2, 1), LOBSTROSITY)).toBeGreaterThan(count(crawl(1, 1), LOBSTROSITY))
  expect(count(crawl(1, 1, 'idle'), LOBSTROSITY)).toBeGreaterThan(0) // Out of the dark, an idle draw is a lobstrosity too.
  expect(count(frame(80, 9, 101, true, MILLION, { at: 100, kind: 'error' }, undefined, { hour: 13 }), LOBSTROSITY)).toBe(0) // By day it is the mutant.
  expect(count(crawl(1, FIRE + 4), LOBSTROSITY)).toBeGreaterThan(0) // It lies where it fell...
  expect(count(crawl(1, shotEnds({ at: 0, kind: 'error' })), LOBSTROSITY)).toBe(0) // ...until the draw is over.
})

test('more foes are a longer volley: a shot for each, VOLLEY ticks apart', () => {
  const flash = (foes: number, phase: number) =>
    count(frame(80, 9, 100 + phase, true, MILLION, { at: 100, kind: 'error', foes }, undefined, { hour: 13 }), FLASH)

  expect([1, 2, 3].map(foes => shotEnds({ at: 0, kind: 'error', foes }))).toEqual([18, 18 + VOLLEY, 18 + 2 * VOLLEY])
  expect(flash(1, FIRE + VOLLEY)).toBe(0)
  expect(flash(2, FIRE + VOLLEY)).toBeGreaterThan(0)
  expect(flash(3, FIRE + 2 * VOLLEY)).toBeGreaterThan(0)
  expect(flash(2, FIRE + 2 * VOLLEY)).toBe(0)
})

test('the golgotha ends in the sky the clock has, not always in noon', () => {
  const wake = (hour: number) => frame(80, 9, 500 + WAKE_TICKS - 1, true, MILLION, undefined, { at: 10, doneAt: 500 }, { hour })

  expect(count(wake(13), SUN)).toBeGreaterThan(0)
  expect(count(wake(23), SUN)).toBe(0)
})

test('the band reads the cost, the 5 hour limit and the local hour from the engine', async ($, on) => {
  hookEngine(on)
  sessionEngine(on)
  on('session.usage', () => ({
    value: {
      context: { tokens: 84000, window: 1000000, percent: 8 },
      rateLimits: [{ kind: 'seven_day', percentUsed: 5 }, { kind: 'five_hour', percentUsed: 62 }],
      cost: { usd: 3.5 },
    },
  }))
  mock.clock(on, { now: MIDNIGHT })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const cells = (await ui.find({ type: 'Raster' }))?.props.cells as string

  expect(letters(cells)).toBe('$3.50 5H 62%MAN IN BLACK 1M84k') // The 5 hour window, not the 7 day one.
  expect(count(cells, MAN_IN_BLACK)).toBe(0) // Eleven at night: camped.
  expect(count(cells, MOON)).toBeGreaterThan(0)
  await ui.unmount()
})

test('by day the band walks, and without a limit or a cost it writes none', async ($, on) => {
  hookEngine(on)
  sessionEngine(on)
  on('session.usage', () => ({ value: { context: { tokens: 84000, window: 1000000, percent: 8 }, rateLimits: [] } }))
  mock.clock(on, { now: at(11, 30) })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const cells = (await ui.find({ type: 'Raster' }))?.props.cells as string

  expect(letters(cells)).toBe('MAN IN BLACK 1M84k')
  expect(count(cells, MAN_IN_BLACK)).toBeGreaterThan(0)
  await ui.unmount()
})

test('with the limit nearly spent, idle draws come twice as often and three lobstrosities come at once', async ($, on) => {
  const clock = mock.clock(on, { now: MIDNIGHT })
  const blits = hookEngine(on)
  sessionEngine(on)
  on('session.usage', () => ({
    value: { context: { tokens: 84000, window: 1000000, percent: 8 }, rateLimits: [{ kind: 'five_hour', percentUsed: 90 }] },
  }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await $.turn.start({ turnId: 't' })
  await clock.advance(TICK_MS * (IDLE_GAP / 2 - 1))
  expect(blits.some(cells => count(cells, LOBSTROSITY) > 0)).toBe(false)

  await clock.advance(TICK_MS * 2) // Half the usual wait.
  const crawl = blits.filter(cells => count(cells, LOBSTROSITY) > 0)
  expect(crawl.length).toBeGreaterThan(0)
  const one = frame(80, 9, 100, true, MILLION, { at: 99, kind: 'idle', foes: 1 }, undefined, { hour: 23 })
  expect(Math.max(...crawl.map(cells => count(cells, LOBSTROSITY)))).toBeGreaterThan(count(one, LOBSTROSITY))
  await $.turn.complete({ reason: 'aborted', text: '' })
  await ui.unmount()
})

test('the sun keeps going down while the session sits idle', async ($, on) => {
  const clock = mock.clock(on, { now: at(19, 30) })
  hookEngine(on)
  sessionEngine(on)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  let ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(count((await ui.find({ type: 'Raster' }))?.props.cells as string, MAN_IN_BLACK)).toBeGreaterThan(0)
  await ui.unmount()

  await clock.advance(3.5 * 3600 * 1000) // Eleven at night, and no turn has run.
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(count((await ui.find({ type: 'Raster' }))?.props.cells as string, MAN_IN_BLACK)).toBe(0)
  await ui.unmount()
})

test('when the 5 hour limit resets his fire leaps up and throws sparks, then settles', () => {
  const fire = (flare?: number, limit = 95) => frame(80, 9, 4, true, MILLION, undefined, undefined, { hour: 23, limit, flare })

  expect(sum(fire(0), FIRE_COLORS)).toBeGreaterThan(sum(fire(), FIRE_COLORS)) // Embers to a blaze.
  expect(sum(fire(0, 10), FIRE_COLORS)).toBeGreaterThan(sum(fire(undefined, 10), FIRE_COLORS)) // Sparks over even a big fire.
  expect(brightness(fire(0))).toBeGreaterThan(brightness(fire(FLARE_TICKS - 1))) // The glow dies back...
  expect(fire(FLARE_TICKS)).toBe(fire()) // ...to the fire the limit allows.
  expect(frame(80, 9, 4, true, MILLION, undefined, undefined, { hour: 13, limit: 95, flare: 0 })).toBe(
    frame(80, 9, 4, true, MILLION, undefined, undefined, { hour: 13, limit: 95 }),
  ) // By day there is no fire to flare.
})

test('a limit that drops by a tenth or more is a reset: the fire flares, then the clock stops', async ($, on) => {
  const clock = mock.clock(on, { now: MIDNIGHT })
  const blits = hookEngine(on)
  sessionEngine(on)
  let limit = 99
  on('session.usage', () => ({
    value: { context: { tokens: 84000, window: 1000000, percent: 8 }, rateLimits: [{ kind: 'five_hour', percentUsed: limit }] },
  }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const embers = sum((await ui.find({ type: 'Raster' }))?.props.cells as string, FIRE_COLORS)

  limit = 95 // Not a reset: nothing flares.
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await clock.advance(TICK_MS * 3)
  expect(blits.length).toBe(0)

  limit = 80
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await clock.advance(TICK_MS * 3)
  const calm = sum(frame(80, 9, 4, true, { tokens: 84000, window: 1000000, compactAt: 1000000 }, undefined, undefined, { hour: 23, limit: 80 }), FIRE_COLORS)
  expect(sum(blits.at(-1) as string, FIRE_COLORS)).toBeGreaterThan(calm) // Bigger than the fire 80 percent allows.
  expect(embers).toBeLessThan(calm)

  await clock.advance(TICK_MS * 20)
  expect(blits.length).toBeGreaterThan(10) // Still flaring, not stopped at the first tick.
  await clock.advance(TICK_MS * (FLARE_TICKS + 5))
  const settled = blits.length
  await clock.advance(1000)
  expect(blits.length).toBe(settled) // The clock stopped with the flare.
  await ui.unmount()
})
