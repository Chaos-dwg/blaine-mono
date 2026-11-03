import type { CoreEngineInterface, Register, Timer } from 'claude-code'

import { BLAST_TICKS, frame, MIN_ROWS, STILL_AGE, tripOf } from './scene'
import type { Reading } from './scene'

const KEY = 'waste-lands'
const HIDDEN = 'isHidden' // Kept across sessions in $.store.
const ROWS = 9
const MIN_COLUMNS = 40
const MAX_COLUMNS = 512 // A Raster's own limit.
const TICK_MS = 66 // Fifteen frames a second is plenty for 8-bit, and cheap.

let reading: Reading | undefined

// Topeka is the end of the window: the model's, or a smaller one the settings ask for. The engine's
// compaction figures won't do: a running session keeps the window it started with, and the threshold
// it reports leaves out CLAUDE_AUTOCOMPACT_PCT_OVERRIDE.
async function measure($: CoreEngineInterface) {
  const { context } = await $.session.usage()
  const limit = await $.settings.read({ key: 'autoCompactWindow' })

  if (context.tokens !== undefined) {
    reading = { tokens: context.tokens, topeka: Math.min(context.window, typeof limit === 'number' ? limit : Infinity) }
    $.ui.invalidate('ui.render')
  }
}

let site: { requestId: string; columns: number; rows: number } | undefined
let t = 0
let tick: Timer | undefined
let isHidden = false
let isTurning = false
let wasAtTopeka = false
let blast: { start: number; trip: number; isStill: boolean } | undefined

// The world stops for a blast, and its age counts on from the ticks.
function draw(columns: number, rows: number, isMoving: boolean) {
  return frame(
    columns,
    rows,
    blast?.start ?? t,
    isMoving && blast === undefined,
    reading,
    blast && { age: blast.isStill ? STILL_AGE : t - blast.start, trip: blast.trip },
  )
}

function run($: CoreEngineInterface) {
  tick ??= $.clock.every(TICK_MS, () => {
    t += 1

    if (site !== undefined) {
      const { requestId, columns, rows } = site
      void $.ui.blit({ requestId, key: KEY, cells: draw(columns, rows, true) })
    }
  })
}

function rest() {
  if (!isTurning && blast === undefined) {
    tick?.cancel()
    tick = undefined
  }
}

async function explode($: CoreEngineInterface, trip: number) {
  const isStill = Boolean(await $.settings.read({ key: 'prefersReducedMotion' }))

  if (blast !== undefined) return

  blast = { start: t, trip, isStill }
  $.clock.after(BLAST_TICKS * TICK_MS, () => {
    blast = undefined
    rest()
    $.ui.invalidate('ui.render')
  })

  if (!isStill) run($)
  $.ui.invalidate('ui.render')
}

async function watch($: CoreEngineInterface) {
  await measure($).catch(() => undefined)
  const trip = tripOf(reading)
  const isAtTopeka = trip >= 1

  if (isAtTopeka && !wasAtTopeka) await explode($, trip).catch(() => undefined)
  wasAtTopeka = isAtTopeka
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'blaine', description: 'Show or hide the Blaine train above the prompt' })
    isHidden = (await $.store.get(HIDDEN)) === true
    await watch($) // A reload or a resumed session has a reading already.

    return next(e)
  })

  on('command.run', { command: 'blaine' }, async $ => {
    isHidden = !isHidden
    await $.store.set(HIDDEN, isHidden)
    $.ui.invalidate('ui.render')

    return { text: isHidden ? 'Blaine is parked. /blaine brings him back.' : 'Blaine is back on the rails.' }
  })

  on('session.measure', async ($, e, next) => {
    await watch($)

    return next(e)
  })

  // Each step of a turn may have grown the context, so Blaine moves on as it works.
  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined) {
      await watch($)
    }

    return next(e)
  })

  // Compaction at the engine's threshold is Topeka, wherever on the line he stands: nothing reaches
  // the very end of a window. A PreCompact hook can hold one back, which answers with a skip.
  on('session.compact', { trigger: 'auto' }, async ($, e, next) => {
    const result = await next(e)

    if (e.agentId === undefined && result.skip === undefined) {
      const trip = tripOf(reading)
      reading = reading && { ...reading, tokens: result.tokensAfter ?? 0 }
      await explode($, trip).catch(() => undefined)
    }

    return result
  })

  on('turn.start', async ($, e, next) => {
    const isStill = await $.settings.read({ key: 'prefersReducedMotion' })

    if (e.agentId === undefined) {
      isTurning = true

      if (!isStill) run($)
    }

    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) {
      isTurning = false
      rest()
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const rows = Math.min(ROWS, e.props.maxRows)
    const columns = Math.min(MAX_COLUMNS, e.props.bodyColumns)

    if (isHidden || e.surface !== 'terminal' || e.props.hasSurvey || rows < MIN_ROWS || columns < MIN_COLUMNS) {
      site = undefined

      return next(e)
    }

    site = { requestId: e.requestId, columns, rows }
    const { Box, Raster } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {await next(e)}
        <Raster key={KEY} columns={columns} rows={rows} cells={draw(columns, rows, e.props.isWorking)} />
      </Box>
    )
  })
}
