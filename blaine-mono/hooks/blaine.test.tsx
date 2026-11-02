import { expect, mock, test } from 'claude-code/testing'

import { frame } from './scene'

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

function hookEngine(on: Parameters<Parameters<typeof test>[1]>[1], settings = {}) {
  const blits: number[] = []

  on('turn.start', () => ({ turnId: 't' }))
  on('turn.complete', () => ({ text: '' }))
  on('settings.read', () => ({ value: settings }))
  on('ui.blit', (_, e) => {
    blits.push(e.cells?.length ?? 0)

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

test('the band reads the context window and the compaction point', async ($, on) => {
  hookEngine(on)
  sessionEngine(on)
  on('session.usage', () => ({
    value: { context: { tokens: 84000, window: 200000, percent: 42, breakdown: { autoCompactThreshold: 160000 } } },
  }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(letters((await ui.find({ type: 'Raster' }))?.props.cells as string)).toBe('LUDTOPEKA 160k84k')
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
