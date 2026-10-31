import { atom, read, update } from 'claude-code'
import type { CoreEngineInterface, Register, Timer } from 'claude-code'

import type { Desk, Gauge, Line } from '../types'
import { frame, isAlert, MAX_ROWS, rowsFor, SHIRTS, SLOT } from './office'
import type { Flight } from './office'

const PANE = 'agent-office'
const KEY = 'room'
const MAIN = 'main'
const MAIN_NAME = 'Claude'
const PANE_COLUMNS = 50 // Four desks a row.
const PANE_ROWS = MAX_ROWS + 12
const MAX_COLUMNS = 512 // A Raster's own limit.
const TICK_MS = 125 // Eight frames a second suits people at desks.
const LOG_LINES = 50
const WRAP_SLACK = 6 // Word wrap wastes a few cells; this keeps a line to two rows.

// Change a tag when its fields change: it declines what an earlier version stored.
const desks = atom({ plugin: 'agent-office', key: 'desks' } as const, [], { shape: 'desks-2' })
const log = atom({ plugin: 'agent-office', key: 'log' } as const, [], { shape: 'log-1' })
const gauge = atom({ plugin: 'agent-office', key: 'gauge' } as const, null, { shape: 'gauge-1' })

const SHIRT_NAMES = SHIRTS.map(color => `#${color.toString(16).padStart(6, '0')}`)

let t = 0
let tick: Timer | undefined
let size: { columns: number; rows: number } | undefined
let flight: Flight | undefined
let isOpened = false
let topeka: number | undefined

const short = (tokens: number) =>
  tokens >= 1e6 ? `${(tokens / 1e6).toFixed(1).replace('.0', '')}M` : `${Math.round(tokens / 1000)}k`

const tripOf = (reading: Gauge | null) => (reading === null ? 0 : reading.tokens / reading.topeka)

function words(reading: Gauge | null): string[] {
  if (reading === null) return ['Context: no reading yet']

  const { tokens, window, topeka } = reading
  const left = topeka - tokens

  return [
    `Context ${Math.round((tokens / window) * 100)}%: ${short(tokens)} of ${short(window)}`,
    left > 0 ? `Topeka (compaction) in ${short(left)}` : 'Blaine has reached Topeka: compaction is due',
    ...(left > 0 && isAlert(tokens / topeka) ? ['Little Blaine: the lights went pink. Compaction is close.'] : []),
  ]
}

const firstLine = (text: string) => text.trim().split('\n')[0].slice(0, 120)

function activity(e: unknown): string {
  const { tool, description, file_path: path, pattern, command } = e as Record<string, string | undefined>
  const detail = description ?? path?.split(/[\\/]/).pop() ?? pattern ?? command ?? ''

  return `${tool} ${detail}`.trim().slice(0, 80)
}

// shortcut: the hand-back tool's input has no published type, so its longest string is
// taken as the report; read the real field once one is documented.
function report(e: unknown): string {
  const { tool, tool_use_id: id, agentId, ...input } = e as Record<string, unknown>
  const strings = Object.values(input).filter(v => typeof v === 'string') as string[]

  return strings.sort((a, b) => b.length - a.length)[0] ?? ''
}

// The plain reading is free, so this runs on every step; the compaction point is asked for once.
async function measure($: CoreEngineInterface) {
  const { context } = await $.session.usage(topeka === undefined ? { breakdown: 'summary' } : undefined)
  topeka = context.breakdown?.autoCompactThreshold ?? topeka ?? context.window
  const reading: Gauge = { tokens: context.tokens ?? 0, window: context.window, topeka }

  await update($, gauge, () => reading)
  await update($, desks, list => list.map(desk => (desk.id === MAIN ? { ...desk, tokens: reading.tokens } : desk)))
}

function open($: CoreEngineInterface) {
  isOpened = true

  return $.ui.open({ id: PANE, title: 'Office', columns: PANE_COLUMNS, rows: PANE_ROWS })
}

// The clock runs only while somebody works, so an empty office costs nothing.
async function sync($: CoreEngineInterface) {
  const isBusy = (await read($, desks)).some(desk => desk.isWorking)

  if (!isBusy) {
    tick?.cancel()
    tick = undefined
  } else if (tick === undefined && !(await $.settings.read({ key: 'prefersReducedMotion' }))) {
    tick = $.clock.every(TICK_MS, async () => {
      t += 1

      if (size !== undefined) {
        const { columns, rows } = size
        const trip = tripOf(await read($, gauge))
        void $.ui.blit({ requestId: PANE, key: KEY, cells: frame(columns, rows, await read($, desks), t, trip, flight) })
      }
    })
  }
}

function sit($: CoreEngineInterface, desk: Desk) {
  return update($, desks, list => {
    if (list.some(one => one.id === desk.id)) {
      return list.map(one => (one.id === desk.id ? { ...one, isWorking: true, doing: desk.doing } : one))
    }

    // Two agents of a type need telling apart at a glance.
    const twins = list.filter(one => one.name.split(' ')[0] === desk.name).length

    return [...list, twins === 0 ? desk : { ...desk, name: `${desk.name} ${twins + 1}` }]
  })
}

async function say($: CoreEngineInterface, fromId: string, toId: string, text: string) {
  const list = await read($, desks)
  const from = list.findIndex(desk => desk.id === fromId)
  const to = list.findIndex(desk => desk.id === toId)
  const line: Line = {
    from: list[from]?.name ?? MAIN_NAME,
    to: list[to]?.name ?? toId,
    text: firstLine(text),
  }

  // A report can reach us twice: by the hand-back tool and as the turn's answer.
  await update($, log, lines =>
    lines.some(one => one.from === line.from && one.text === line.text) ? lines : [...lines, line].slice(-LOG_LINES),
  )

  if (from >= 0 && to >= 0) {
    flight = { from, to, at: t }
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'office', description: 'Open the agent office beside the chat' })

    return next(e)
  })

  on('command.run', { command: 'office' }, async $ => {
    await measure($).catch(() => undefined)
    await open($)

    return { text: 'Office opened.' }
  })

  on('prompt.submit', async ($, e, next) => {
    // A new request from the person clears out whoever has gone home.
    if (e.isMeta !== true) {
      await update($, desks, list => list.filter(desk => desk.id === MAIN || desk.isWorking))
    }

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await sit($, { id: MAIN, name: MAIN_NAME, parentId: MAIN, isWorking: true, doing: 'Thinking', tokens: 0 })
      await measure($).catch(() => undefined)
    } else {
      // Engine forks and workflow agents have ids the list does not name: they get no desk.
      const info = (await $.agent.list()).find(agent => agent.id === e.agentId)

      if (info !== undefined) {
        await sit($, {
          id: info.id,
          name: info.name ?? info.type,
          parentId: info.parentId ?? MAIN,
          isWorking: true,
          doing: info.description,
          tokens: 0,
        })
      }
    }

    await sync($)

    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    if (!isOpened) {
      void open($)
    }

    const spawned = await next(e)

    if ('agentId' in spawned && spawned.agentId !== undefined) {
      const parentId = e.parentAgentId ?? MAIN
      await sit($, { id: spawned.agentId, name: e.subagentType, parentId, isWorking: true, doing: e.description, tokens: 0 })
      await say($, parentId, spawned.agentId, e.prompt)
      await sync($)
    }

    return spawned
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId ?? MAIN
    const desk = (await read($, desks)).find(one => one.id === id)

    if (desk !== undefined && (e.tool as string) === 'SubagentHandback') {
      await say($, id, desk.parentId, report(e))
    }

    await update($, desks, list => list.map(one => (one.id === id ? { ...one, doing: activity(e) } : one)))

    if (id === MAIN) {
      await measure($).catch(() => undefined)
    }

    return next(e)
  })

  on('session.send', async ($, e, next) => {
    const to = (await read($, desks)).find(desk => desk.name === e.to || desk.id === e.to)
    await say($, e.agentId ?? MAIN, to?.id ?? e.to, e.text)

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    topeka = undefined // The model or the window may have changed.
    await measure($).catch(() => undefined)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId ?? MAIN
    const doing = e.isAborted ? 'Stopped' : 'Done'
    const desk = (await read($, desks)).find(one => one.id === id)
    // A turn's cache reads repeat across its requests, so they would count the same text many times.
    const { input_tokens: read_ = 0, cache_creation_input_tokens: wrote = 0, output_tokens: said = 0 } = e.usage ?? {}
    const tokens = read_ + wrote + said
    await update($, desks, list =>
      list.map(one => (one.id === id ? { ...one, isWorking: false, doing, tokens: one.id === MAIN ? one.tokens : tokens } : one)),
    )

    if (desk !== undefined && e.agentId !== undefined && e.answer !== '') {
      await say($, id, desk.parentId, e.answer)
    }

    await sync($)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const seats = await read($, desks)
    const lines = await read($, log)
    const reading = await read($, gauge)
    const summary = words(reading)
    const trip = tripOf(reading)
    const width = Math.min(MAX_COLUMNS, e.props.bodyColumns)
    const Room = e.surface === 'terminal' && width >= SLOT ? $.ui.resolve(e).Raster : undefined
    const rows = rowsFor(width, seats.length)
    const free = e.props.scroll.bodyRows - (Room === undefined ? 0 : rows) - seats.length - summary.length - 2

    size = Room === undefined ? undefined : { columns: width, rows }

    return (
      <Box flexDirection="column">
        {Room !== undefined && <Room key={KEY} columns={width} rows={rows} cells={frame(width, rows, seats, t, trip, flight)} />}
        {summary.map((text, i) => (
          <Text bold={i === 0} color={isAlert(trip) ? '#ff5fa0' : undefined}>
            {text}
          </Text>
        ))}
        {seats.length === 0 && <Text dimColor>Nobody is in yet.</Text>}
        {seats.map((desk, i) => (
          <Text color={SHIRT_NAMES[i % SHIRT_NAMES.length]} bold={desk.isWorking}>
            {`${desk.name}: ${desk.doing}${desk.tokens > 0 ? `, ${short(desk.tokens)}` : ''}`.slice(0, width)}
          </Text>
        ))}
        {lines.length > 0 && <Text dimColor>{'-'.repeat(Math.min(width, 40))}</Text>}
        {lines.slice(-Math.max(1, free >> 1)).map(line => (
          <Text>{`${line.from} > ${line.to}: ${line.text}`.slice(0, width * 2 - WRAP_SLACK)}</Text>
        ))}
      </Box>
    )
  })
}
