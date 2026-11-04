import { expect, mock, test } from 'claude-code/testing'

import { BLAST_TICKS, beat, FIRE, frame, STILL_AGE } from './scene'

const BAND = {
  plugin: 'blaine-mono',
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

const SUMMARY: { role: 'user'; text: string; toolUses: [] }[] = [{ role: 'user', text: 'the story so far', toolUses: [] }]

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

// The letters a frame carries in their own cells, in reading order.
const letters = (cells: string) =>
  String.fromCharCode(...new Uint32Array(Uint8Array.fromBase64(cells).buffer).filter((c, i) => i % 3 === 0 && c < 0x80))

// The column where the token count over the train starts.
function labelColumn(cells: string, columns: number) {
  const codes = new Uint32Array(Uint8Array.fromBase64(cells).buffer).filter((_, i) => i % 3 === 0)

  return codes.findIndex((c, i) => i >= columns && c < 0x80) % columns
}

// How many cell colours in a frame are Blaine on fire.
const fire = (cells: string) =>
  new Uint32Array(Uint8Array.fromBase64(cells).buffer).filter((c, i) => i % 3 !== 0 && FIRE.includes(c)).length

function sessionEngine(on: Parameters<Parameters<typeof test>[1]>[1]) {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'blaine' } }))
  on('store.get', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
}

test('context reads as a trip from Lud to Topeka, in letters', () => {
  const near = frame(80, 9, 0, false, { tokens: 16000, topeka: 160000 })
  const far = frame(80, 9, 0, false, { tokens: 150000, topeka: 160000 })

  expect(letters(frame(80, 9, 0, false, { tokens: 84000, topeka: 160000 }))).toBe('LUDTOPEKA 160k84k')
  expect(letters(frame(80, 9, 0, false))).toBe('LUDTOPEKA')
  expect(labelColumn(near, 80)).toBeLessThan(labelColumn(far, 80))
})

test('the windows go pink only near Topeka', () => {
  const pink = (cells: string) =>
    new Uint32Array(Uint8Array.fromBase64(cells).buffer).filter((c, i) => i % 3 !== 0 && c === 0xff5fa0).length

  expect(pink(frame(80, 9, 4, true, { tokens: 80000, topeka: 160000 }))).toBe(0)
  expect(pink(frame(80, 9, 4, true, { tokens: 140000, topeka: 160000 }))).toBeGreaterThan(0)
})

test('Topeka is the whole window, not the compaction point', async ($, on) => {
  hookEngine(on)
  sessionEngine(on)
  on('session.usage', () => ({
    value: {
      context: {
        tokens: 84000,
        window: 1000000,
        percent: 8,
        breakdown: { rawMaxTokens: 1000000, autoCompactThreshold: 967000 },
      },
    },
  }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(letters((await ui.find({ type: 'Raster' }))?.props.cells as string)).toBe('LUDTOPEKA 1M84k')
  await ui.unmount()
})

test('Topeka follows the window setting, even where the session started under an older one', async ($, on) => {
  hookEngine(on, { autoCompactWindow: 1000000 })
  sessionEngine(on)
  on('session.usage', () => ({
    value: {
      context: {
        tokens: 84000,
        window: 1000000,
        percent: 8,
        breakdown: { rawMaxTokens: 350000, autoCompactThreshold: 317000 },
      },
    },
  }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(letters((await ui.find({ type: 'Raster' }))?.props.cells as string)).toBe('LUDTOPEKA 1M84k')
  await ui.unmount()
})

test('a smaller window setting moves Topeka in, and a larger one stops at the model', async ($, on) => {
  const settings = { autoCompactWindow: 350000 }
  hookEngine(on, settings)
  sessionEngine(on)
  on('session.usage', () => ({ value: { context: { tokens: 84000, window: 200000, percent: 42 } } }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  let ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(letters((await ui.find({ type: 'Raster' }))?.props.cells as string)).toBe('LUDTOPEKA 200k84k')
  await ui.unmount()

  settings.autoCompactWindow = 100000
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(letters((await ui.find({ type: 'Raster' }))?.props.cells as string)).toBe('LUDTOPEKA 100k84k')
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

  expect(letters((await ui.find({ type: 'Raster' }))?.props.cells as string)).toBe('LUDTOPEKA')
  await ui.unmount()
})

test('a frame packs one glyph and two colours per cell', () => {
  const bytes = Uint8Array.fromBase64(frame(40, 6, 3, true))

  expect(bytes.length).toBe(40 * 6 * 12)
  expect(new Uint32Array(bytes.buffer)[40 * 3]).toBe(0x2580) // Row 0 carries the signs.
})

test('the scene moves from tick to tick and rests when parked', () => {
  expect(frame(80, 9, 1, true)).not.toBe(frame(80, 9, 2, true))
  expect(frame(80, 9, 5, false)).toBe(frame(80, 9, 5, false))
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
    { ...BAND, surface: 'terminal', props: { ...BAND.props, maxRows: 5 } },
    { ...BAND, surface: 'terminal', props: { ...BAND.props, bodyColumns: 39 } },
    { ...BAND, surface: 'desktop' },
  ] as const) {
    const ui = await $.ui.mount(target)

    expect(await ui.find({ type: 'Raster' })).toBeUndefined()
    await ui.unmount()
  }
})

test('the train runs for a turn and stops with it', async ($, on) => {
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

test('/blaine hides the train, remembers it, and brings it back', async ($, on) => {
  hookEngine(on)
  const store = new Map<string, unknown>()
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'blaine' } }))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)

    return { value: undefined }
  })
  on('ui.invalidate', () => ({ value: undefined }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const hidden = await $.command.run({ command: 'blaine', args: '' })
  expect(hidden.text).toContain('parked')
  expect(store.get('isHidden')).toBe(true)
  let ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await ui.unmount()

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await ui.unmount()

  const shown = await $.command.run({ command: 'blaine', args: '' })
  expect(shown.text).toContain('back on the rails')
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

test('a blast starts small, fills the band, burns out, and takes the train with it', () => {
  const reading = { tokens: 900000, topeka: 1000000 }
  const at = (age: number) => fire(frame(80, 9, 4, true, reading, { age, trip: 0.9 }))

  expect(fire(frame(80, 9, 4, true, reading))).toBe(0)
  expect(at(1)).toBeGreaterThan(0)
  expect(at(16)).toBeGreaterThan(at(1))
  expect(at(BLAST_TICKS - 1)).toBeLessThan(at(16))
  expect(at(STILL_AGE)).toBeGreaterThan(0)
})

test('a blast drops the token count and stays on the band at its edges', () => {
  const reading = { tokens: 1000000, topeka: 1000000 }

  expect(letters(frame(80, 9, 4, true, reading, { age: 10, trip: 1 }))).toBe('LUDTOPEKA 1M')
  for (const [columns, rows] of [
    [40, 6],
    [41, 7],
    [512, 9],
  ] as const) {
    for (const trip of [0, 1]) {
      const bytes = Uint8Array.fromBase64(frame(columns, rows, 4, true, reading, { age: 20, trip }))

      expect(bytes.length).toBe(columns * rows * 12)
    }
  }
})

test('Blaine goes up once when the context reaches Topeka', async ($, on) => {
  const clock = mock.clock(on)
  const blits = hookEngine(on)
  sessionEngine(on)
  let tokens = 900000
  on('session.usage', () => ({ value: { context: { tokens, window: 1000000, percent: 90 } } }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await clock.advance(660)
  expect(blits.length).toBe(0)

  tokens = 1000000
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await clock.advance(660)
  expect(blits.length).toBeGreaterThan(0)
  expect(fire(blits.at(-1) as string)).toBeGreaterThan(0)

  await clock.advance(BLAST_TICKS * 66 + 660)
  const settled = blits.length
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await clock.advance(660)
  expect(blits.length).toBe(settled)

  tokens = 40000
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  tokens = 1000000
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await clock.advance(660)
  expect(blits.length).toBeGreaterThan(settled)
  await clock.advance(BLAST_TICKS * 66 + 660)
  await ui.unmount()
})

const BEFORE = { tokens: 300000, topeka: 1000000 }
const AFTER = { tokens: 40000, topeka: 1000000 }
const ASKING = { at: 0, trip: 0.3 }
const DONE = { at: 0, trip: 0.3, doneAt: 0, before: 300000, after: 40000 }

// The first tick of each act of a riddling, and the tick it is over.
function acts(riddling: typeof DONE) {
  const starts: Record<string, number> = {}
  for (let t = riddling.at; ; t += 1) {
    const act = beat(t, riddling)
    if (act === undefined) return { ...starts, over: t }
    starts[act.phase] ??= t
  }
}

// The column of Blaine's light on the route map.
const light = (cells: string) =>
  new Uint32Array(Uint8Array.fromBase64(cells).buffer).filter((_, i) => i % 3 === 0).slice(0, 80).indexOf(0x2588)

test('while the summary is written the riddles go on, and each one brings Topeka closer', () => {
  const at = (t: number) => frame(80, 9, t, true, BEFORE, undefined, ASKING)

  expect(beat(100000, ASKING)?.phase).toBe('ask')
  expect(letters(at(10))).toContain('CANDLETON')
  expect(letters(at(10))).toContain('TOPEKA 1M')
  expect(letters(at(10))).toContain('JAKE: WHAT HAS A NECK BUT NO HEAD?')
  expect(letters(at(10))).not.toContain('BLAINE')
  expect(letters(at(30))).toContain('BLAINE: A BOTTLE. TOO EASY!')
  expect(letters(at(70))).toContain('SUSANNAH: WHAT HAS TEETH BUT CANNOT BITE?')
  expect(light(at(4))).toBeGreaterThan(0)
  expect(light(at(124))).toBeGreaterThan(light(at(4)))
  expect(light(at(244))).toBeGreaterThan(light(at(124)))
})

test('once the summary is back Eddie tells his joke, Blaine breaks, crashes at Topeka, and the next train leaves Lud', () => {
  const s = acts(DONE)
  const at = (t: number, reading = BEFORE) => frame(80, 9, t, true, reading, undefined, DONE)

  expect(s).toEqual({ ask: 0, duck: 38, frantic: 68, glide: 116, blast: 134, wake: 179, arrive: 254, over: 278 })
  expect(letters(at(s.duck - 1))).toContain('BLAINE: A BOTTLE. TOO EASY!') // His last answer is read first.
  expect(letters(at(s.duck + 6))).toContain("EDDIE: WHAT'S THE DIFFERENCE BETWEEN A DUCK?")
  expect(letters(at(s.duck + 20))).toContain('BLAINE: ..')
  expect(letters(at(s.frantic + 44))).toContain('blaine: why... am i... pink')
  expect(letters(at(s.frantic + 44))).toContain('little blaine: hold on to something!')
  expect(letters(at(s.glide + 5))).toBe('') // The engines are out and the map has blown.
  expect(fire(at(s.blast + 10, AFTER))).toBeGreaterThan(0)
  expect(letters(at(s.blast + 10, AFTER))).toBe('LUDTOPEKA 1M')

  const wake = letters(at(s.wake + 40, AFTER))
  for (const words of ['END OF THE LINE', '300k DOWN TO 40k', '4:14', '70']) expect(wake).toContain(words)
  expect(letters(at(s.arrive + 10, AFTER))).toBe('LUDTOPEKA 1M40k')
  expect(at(s.over, AFTER)).toBe(frame(80, 9, s.over, true, AFTER))
})

test('the riddling fits every band it draws on', () => {
  const s = acts(DONE)

  for (const [columns, rows] of [
    [40, 6],
    [41, 7],
    [80, 8],
    [512, 9],
  ] as const) {
    for (const t of [30, s.duck + 20, s.frantic + 30, s.glide + 5, s.blast + 10, s.wake + 70, s.arrive + 10]) {
      expect(Uint8Array.fromBase64(frame(columns, rows, t, true, AFTER, undefined, DONE)).length).toBe(columns * rows * 12)
    }
  }
  expect(letters(frame(80, 8, 30, true, BEFORE, undefined, ASKING))).toContain('BLAINE: A BOTTLE') // One row: the answer in the question's place.
  expect(letters(frame(80, 8, 30, true, BEFORE, undefined, ASKING))).not.toContain('JAKE')
  expect(letters(frame(80, 7, 30, true, BEFORE, undefined, ASKING))).not.toContain('JAKE') // No row: the route map alone.
  expect(letters(frame(40, 6, s.wake + 40, true, AFTER, undefined, DONE))).toContain('END OF THE LINE')
})

test('every compaction, asked for or automatic, is the riddling, the crash at Topeka, and the next train out of Lud', async ($, on) => {
  const clock = mock.clock(on)
  const blits = hookEngine(on)
  sessionEngine(on)
  let finish = () => {}
  on('session.usage', () => ({ value: { context: { tokens: 920000, window: 1000000, percent: 92 } } }))
  on(
    'session.compact',
    () => new Promise(resolve => (finish = () => resolve({ messages: SUMMARY, tokensBefore: 920000, tokensAfter: 40000 }))),
  )
  const last = () => letters(blits.at(-1) ?? '')

  for (const trigger of ['auto', 'manual'] as const) {
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    await $.turn.start({ turnId: 't' })

    const compacting = $.session.compact({ trigger, messages: SUMMARY })
    await clock.advance(66 * 10)
    expect(last()).toContain('JAKE: WHAT HAS A NECK BUT NO HEAD?')
    await clock.advance(66 * 120)
    expect(last()).not.toContain('DUCK') // No joke until the summary is back.

    finish()
    expect((await compacting).tokensAfter).toBe(40000) // The compaction comes through untouched.
    await $.turn.complete({ reason: 'aborted', text: '' })
    await clock.advance(66 * 140)
    expect(fire(blits.at(-1) as string)).toBeGreaterThan(0) // It runs on past the turn, to Topeka.
    await clock.advance(66 * 60)
    expect(last()).toContain('END OF THE LINE')
    expect(last()).toContain('920k DOWN TO 40k')

    await clock.advance(66 * 90)
    const settled = blits.length
    await clock.advance(1000)
    expect(blits.length).toBe(settled) // The clock stops with the riddling.
    await ui.unmount()

    const next = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const cells = (await next.find({ type: 'Raster' }))?.props.cells as string
    expect(fire(cells)).toBe(0)
    expect(letters(cells)).toBe('LUDTOPEKA 1M40k')
    await next.unmount()
  }
})

test('reduced motion holds one riddle and its answer still while the summary is written', async ($, on) => {
  const clock = mock.clock(on)
  const blits = hookEngine(on, { prefersReducedMotion: true })
  sessionEngine(on)
  let finish = () => {}
  on('session.usage', () => ({ value: { context: { tokens: 920000, window: 1000000, percent: 92 } } }))
  on('session.compact', () => new Promise(resolve => (finish = () => resolve({ messages: SUMMARY, tokensAfter: 40000 }))))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const compacting = $.session.compact({ trigger: 'manual', messages: SUMMARY })
  await clock.advance(1000)

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const still = letters((await ui.find({ type: 'Raster' }))?.props.cells as string)
  expect(still).toContain('JAKE: WHAT HAS A NECK BUT NO HEAD?')
  expect(still).toContain('BLAINE: A BOTTLE. TOO EASY!')
  expect(blits.length).toBe(0)
  await ui.unmount()

  finish()
  await compacting
})

test('he stays whole for a compaction that was held back, or one not his', async ($, on) => {
  const clock = mock.clock(on)
  const blits = hookEngine(on)
  sessionEngine(on)
  let answer: { skip: string } | { messages: typeof SUMMARY } = { skip: 'held by a PreCompact hook' }
  on('session.usage', () => ({ value: { context: { tokens: 920000, window: 1000000, percent: 92 } } }))
  on('session.compact', () => answer)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await $.session.compact({ trigger: 'auto', messages: SUMMARY })
  answer = { messages: SUMMARY }
  await $.session.compact({ trigger: 'precompute', messages: SUMMARY })
  await $.session.compact({ trigger: 'auto', agentId: 'a1', messages: SUMMARY })
  await clock.advance(660)

  expect(blits.length).toBe(0)
  await ui.unmount()
})

test('a blast cannot get in the way of the compaction', async ($, on) => {
  sessionEngine(on)
  on('session.usage', () => ({ value: { context: { tokens: 920000, window: 1000000, percent: 92 } } }))
  on('session.compact', () => ({ messages: SUMMARY, tokensAfter: 40000 }))
  on('settings.read', () => {
    throw new Error('no settings')
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  expect((await $.session.compact({ trigger: 'auto', messages: SUMMARY })).tokensAfter).toBe(40000)
})

test('reduced motion holds the blast still, then clears it', async ($, on) => {
  const clock = mock.clock(on)
  const blits = hookEngine(on, { prefersReducedMotion: true })
  sessionEngine(on)
  on('session.usage', () => ({ value: { context: { tokens: 920000, window: 1000000, percent: 92 } } }))
  on('session.compact', () => ({ messages: SUMMARY, tokensAfter: 40000 }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.compact({ trigger: 'auto', messages: SUMMARY })

  let ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(fire((await ui.find({ type: 'Raster' }))?.props.cells as string)).toBeGreaterThan(0)
  await ui.unmount()

  await clock.advance(BLAST_TICKS * 66 + 66)
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(fire((await ui.find({ type: 'Raster' }))?.props.cells as string)).toBe(0)
  expect(blits.length).toBe(0)
  await ui.unmount()
})

test('the cost, the 5 hour limit and its reset sit between Lud and Topeka, pink once the limit is nearly gone', () => {
  const top = (world: object, columns = 80) => frame(columns, 9, 4, true, { tokens: 84000, topeka: 160000 }, undefined, undefined, world)
  const pink = (cells: string) => new Uint32Array(Uint8Array.fromBase64(cells).buffer).filter((c, i) => i % 3 === 1 && c === 0xff5fa0).length

  expect(letters(top({ cost: 2.4, limit: 12.4, resetMin: 130 }))).toBe('LUD$2.40 5H 12% 2h10mTOPEKA 160k84k')
  expect(letters(top({ cost: 1234.5, limit: 3, resetMin: 45.4 }))).toBe('LUD$1235 5H 3% 45mTOPEKA 160k84k')
  expect(letters(top({ limit: 9, resetMin: 61 }))).toBe('LUD5H 9% 1h01mTOPEKA 160k84k')
  expect(letters(top({ limit: 9, resetMin: 100 }))).toBe('LUD5H 9% 1h40mTOPEKA 160k84k')
  expect(letters(top({ limit: 9 }))).toBe('LUD5H 9%TOPEKA 160k84k')
  expect(letters(top({ cost: 7 }))).toBe('LUD$7.00TOPEKA 160k84k')
  expect(letters(top({ cost: 1e15, limit: 100, resetMin: 600 }, 40))).toBe('LUDTOPEKA 160k84k') // No room: the ends win.
  expect(pink(top({ limit: 50 }))).toBe(pink(top({})))
  expect(pink(top({ limit: 85 }))).toBeGreaterThan(pink(top({ limit: 50 })))
})

test('the band reads the cost, the 5 hour limit and the minutes to its reset from the engine', async ($, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 5, 1, 12) })
  hookEngine(on)
  sessionEngine(on)
  on('session.usage', () => ({
    value: {
      context: { tokens: 84000, window: 1000000, percent: 8 },
      rateLimits: [
        { kind: 'seven_day', percentUsed: 5, resetsAt: '2026-06-05T00:00:00Z' },
        { kind: 'five_hour', percentUsed: 62, resetsAt: '2026-06-01T14:05:00Z' },
      ],
      cost: { usd: 3.5 },
    },
  }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(letters((await ui.find({ type: 'Raster' }))?.props.cells as string)).toBe('LUD$3.50 5H 62% 2h05mTOPEKA 1M84k')
  await ui.unmount()
  void clock
})

test('without a limit or a cost the band is as it was', async ($, on) => {
  hookEngine(on)
  sessionEngine(on)
  on('session.usage', () => ({ value: { context: { tokens: 84000, window: 1000000, percent: 8 }, rateLimits: [] } }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(letters((await ui.find({ type: 'Raster' }))?.props.cells as string)).toBe('LUDTOPEKA 1M84k')
  await ui.unmount()
})
