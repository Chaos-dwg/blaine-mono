import { expect, mock, test } from 'claude-code/testing'

import { frame, rowsFor } from './office'

const PANE = {
  plugin: 'agent-office',
  component: 'Pane',
  requestId: 'agent-office',
  props: {
    title: 'Office',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const SPAWN = {
  tool_use_id: 'call-1',
  prompt: 'Count the files\nand report back',
  description: 'Count files',
  subagentType: 'Explore',
  provider: { plugin: 'engine' },
  background: false,
  fork: false,
} as const

function hookEngine(on: Parameters<Parameters<typeof test>[1]>[1], settings = {}) {
  const blits: number[] = []
  let spawned = 0

  on('turn.start', () => ({ turnId: 't' }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', () => ({ result: {} }))
  on('settings.read', () => ({ value: settings }))
  on('agent.list', () => ({ value: [] }))
  on('agent.spawn', () => ({ model: 'haiku', agentId: `a${(spawned += 1)}` }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.blit', () => {
    blits.push(1)

    return { value: {} }
  })

  return blits
}

test('a frame packs every cell and writes the name in letters', () => {
  const rows = rowsFor(50, 1)
  const bytes = Uint8Array.fromBase64(frame(50, rows, [{ name: 'Explore', isWorking: true, tokens: 0 }], 3, 0.5))
  const words = new Uint32Array(bytes.buffer)
  const letters = String.fromCharCode(...words.filter((_, i) => i % 3 === 0).filter(c => c < 0x80))

  expect(bytes.length).toBe(50 * rows * 12)
  expect(letters).toBe('LUDTOPEKAExplore')
})

test('a name a cell cannot hold is made safe', () => {
  const bytes = Uint8Array.fromBase64(frame(50, rowsFor(50, 1), [{ name: 'Blaine🚂', isWorking: true, tokens: 0 }], 3, 0.5))
  const codes = new Uint32Array(bytes.buffer).filter((_, i) => i % 3 === 0)

  expect(codes.every(c => c === 0x2580 || (c >= 0x20 && c <= 0x7e))).toBe(true)
})

test('an agent gets a desk, and what it was told and answered shows on every surface', async ($, on) => {
  mock.clock(on)
  hookEngine(on)

  await $.turn.start({ turnId: 't' })
  await $.agent.spawn(SPAWN)
  await $.tool.call({ tool: 'Grep', pattern: 'blaine', agentId: 'a1' })
  await $.turn.complete({ turnId: 'a', agentId: 'a1', answer: '42 files\nmore detail', durationMs: 1, isAborted: false, reason: 'answer' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect((await ui.find({ type: 'Text', text: /Claude > Explore/ }))?.text).toBe('Claude > Explore: Count the files')
    expect((await ui.find({ type: 'Text', text: /Explore > Claude/ }))?.text).toBe('Explore > Claude: 42 files')
    expect((await ui.find({ type: 'Text', text: /^Explore: / }))?.text).toBe('Explore: Done')
    await ui.unmount()
  }
})

test('context reads as a trip to Topeka, in words as well as pixels', async ($, on) => {
  mock.clock(on)
  hookEngine(on)
  on('session.usage', () => ({
    value: { context: { tokens: 450000, window: 1000000, percent: 45, breakdown: { autoCompactThreshold: 900000 } } },
  }))

  await $.turn.start({ turnId: 't' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await ui.find({ type: 'Text', text: /^Context/ }))?.text).toBe('Context 45%: 450k of 1M')
  expect((await ui.find({ type: 'Text', text: /^Topeka/ }))?.text).toBe('Topeka (compaction) in 450k')
  expect(await ui.find({ type: 'Text', text: /pink/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /^Claude: / }))?.text).toBe('Claude: Thinking, 450k')
  await ui.unmount()
})

test('nearing Topeka turns the lights pink and says so', async ($, on) => {
  mock.clock(on)
  hookEngine(on)
  on('session.usage', () => ({
    value: { context: { tokens: 810000, window: 1000000, percent: 81, breakdown: { autoCompactThreshold: 900000 } } },
  }))

  await $.turn.start({ turnId: 't' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await ui.find({ type: 'Text', text: /pink/ }))?.text).toContain('Compaction is close')
  await ui.unmount()
  expect(frame(50, 14, [], 0, 0.9)).not.toBe(frame(50, 14, [], 0, 0.1))
})

test('the office still works when usage cannot be read', async ($, on) => {
  mock.clock(on)
  hookEngine(on)
  on('session.usage', () => {
    throw new Error('no reading')
  })

  await $.turn.start({ turnId: 't' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await ui.find({ type: 'Text', text: /^Context/ }))?.text).toBe('Context: no reading yet')
  await ui.unmount()
})

test('a narrow dock seats two across and the room grows with the team', () => {
  expect(rowsFor(23, 4)).toBe(14)
  expect(rowsFor(23, 5)).toBe(20)
  expect(rowsFor(23, 40)).toBe(20)
})

test('a hand-back is heard once, and twins are told apart', async ($, on) => {
  mock.clock(on)
  hookEngine(on)

  await $.turn.start({ turnId: 't' })
  await $.agent.spawn(SPAWN)
  await $.agent.spawn(SPAWN)
  await $.tool.call({ tool: 'SubagentHandback', report: 'Four files in hooks', agentId: 'a1' })
  await $.turn.complete({ turnId: 'a', agentId: 'a1', answer: 'Four files in hooks', durationMs: 1, isAborted: false, reason: 'answer' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await ui.find({ type: 'Text', text: /Explore > Claude: Four files/ }))?.text).toBe('Explore > Claude: Four files in hooks')
  expect((await ui.find({ type: 'Text', text: /^Explore 2: / }))?.text).toBe('Explore 2: Count files')
  await ui.unmount()
})

test('the newest words stay in view', async ($, on) => {
  mock.clock(on)
  hookEngine(on)

  await $.turn.start({ turnId: 't' })
  await $.agent.spawn(SPAWN)

  for (let n = 1; n <= 12; n += 1) {
    await $.tool.call({ tool: 'SubagentHandback', report: `Report number ${n} of the run`, agentId: 'a1' })
  }

  const props = { ...PANE.props, scroll: { offset: 0, bodyRows: 12 } }
  const ui = await $.ui.mount({ ...PANE, props, surface: 'desktop' })

  expect(await ui.find({ type: 'Text', text: /Report number 12 / })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Report number 1 / })).toBeUndefined()
  await ui.unmount()
})

test('the room draws on the terminal only', async ($, on) => {
  hookEngine(on)
  const terminal = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await terminal.find({ type: 'Raster' }))?.type).toBe('Raster')
  await terminal.unmount()

  const desktop = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await desktop.find({ type: 'Raster' })).toBeUndefined()
  expect((await desktop.find({ type: 'Text', text: /Nobody/ }))?.text).toBe('Nobody is in yet.')
  await desktop.unmount()
})

test('the room moves only while somebody works', async ($, on) => {
  const clock = mock.clock(on)
  const blits = hookEngine(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await clock.advance(1000)
  expect(blits.length).toBe(0)

  await $.turn.start({ turnId: 't' })
  await clock.advance(1000)
  const running = blits.length
  expect(running).toBeGreaterThan(0)

  await $.turn.complete({ turnId: 't', answer: '', durationMs: 1, isAborted: true, reason: 'aborted' })
  await clock.advance(1000)
  expect(blits.length).toBe(running)
  await ui.unmount()
})

test('reduced motion holds the room still', async ($, on) => {
  const clock = mock.clock(on)
  const blits = hookEngine(on, { prefersReducedMotion: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await $.turn.start({ turnId: 't' })
  await clock.advance(1000)

  expect(blits.length).toBe(0)
  await ui.unmount()
})
