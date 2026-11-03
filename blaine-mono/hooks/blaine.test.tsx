import { expect, mock, test } from 'claude-code/testing'

import { BLAST_TICKS, FIRE, frame, STILL_AGE } from './scene'

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

test('automatic compaction is Topeka: he goes up where he stands, and the next one leaves Lud', async ($, on) => {
  const clock = mock.clock(on)
  const blits = hookEngine(on)
  sessionEngine(on)
  on('session.usage', () => ({ value: { context: { tokens: 920000, window: 1000000, percent: 92 } } }))
  on('session.compact', () => ({ messages: SUMMARY, tokensAfter: 40000 }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await $.session.compact({ trigger: 'auto', messages: SUMMARY })
  await clock.advance(660)
  expect(fire(blits.at(-1) as string)).toBeGreaterThan(0)

  await clock.advance(BLAST_TICKS * 66 + 660)
  const settled = blits.length
  await clock.advance(1000)
  expect(blits.length).toBe(settled) // The timer stopped with the blast.
  await ui.unmount()

  const next = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const cells = (await next.find({ type: 'Raster' }))?.props.cells as string
  expect(fire(cells)).toBe(0)
  expect(letters(cells)).toBe('LUDTOPEKA 1M40k')
  await next.unmount()
})

test('he stays whole for a compaction that was held back, asked for, or not his', async ($, on) => {
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
  await $.session.compact({ trigger: 'manual', messages: SUMMARY })
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
